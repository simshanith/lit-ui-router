// The queue consumer, the ledger's only D1 writer: per claim, observe the tag,
// npm and GitHub, fold the observation through the core, and write the outcome
// in one D1 batch. A message is acked only after its batch commits.
import { Effect, Option, Schema } from 'effect';
import { D1Client } from '@effect/sql-d1';

import { queueDelaySeconds } from './backoff.ts';
import { Claim } from './claim.ts';
import {
  findClaim,
  findDistTags,
  findVersion,
  insertDeadLetter,
  type PipelineEvent,
  pipelineInsert,
  toSql,
} from './ledger-sql.ts';
import { Observer, type Sources } from './observe.ts';
import {
  type DistTagOutcome,
  type Envelope,
  fold,
  type FoldStatements,
  foldStatements,
  moveDistTag,
  type Observation,
  removeDistTag,
  type VersionRow,
} from './release-ledger.core.ts';

export const CLAIMS_QUEUE = 'release-ledger-claims';

export const DEAD_LETTER_QUEUE = 'release-ledger-claims-dlq';

/** Folds per message, back to back, before a row that keeps moving sends it back to the queue. */
export const FOLD_ATTEMPTS = 3;

/** The slice of a Workers queue message the consumer uses. */
export interface LedgerMessage {
  readonly id: string;
  readonly timestamp: Date;
  readonly attempts: number;
  readonly body: unknown;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}

export interface LedgerBatch {
  readonly queue: string;
  readonly messages: readonly LedgerMessage[];
}

/** `retryAfter`: seconds a rate limit asked for, which wins over the backoff. */
type Verdict = { kind: 'ack' } | { kind: 'retry'; retryAfter?: number };

const ACK: Verdict = { kind: 'ack' };

const RETRY: Verdict = { kind: 'retry' };

const retryAfter = (seconds: number | undefined): Verdict =>
  seconds === undefined ? RETRY : { kind: 'retry', retryAfter: seconds };

const decodeClaim = Schema.decodeUnknownEffect(Claim);

/** What the sources say, as the core folds it; a source that 404s reports `null`. */
export function observationOf(sources: Sources, claim: Claim): Observation {
  const { tag, npm, gh } = sources;

  return {
    tag,
    // npm keeps no record of the dist-tag; only the publish-npm claim knows
    npm: npm && {
      ...npm,
      ...(claim.distTag !== undefined && { distTag: claim.distTag }),
    },
    gh,
  };
}

/** The audit columns: an Actions run, or the Cron Trigger's sweep. */
function auditOf({ origin }: Claim) {
  return origin.kind === 'run'
    ? {
        source: origin.jobWorkflowRef,
        runId: origin.runId,
        runAttempt: Number(origin.runAttempt),
        runUrl: `https://github.com/${origin.repository}/actions/runs/${origin.runId}/attempts/${origin.runAttempt}`,
      }
    : {
        source: `scheduled ${origin.cron}`,
        runId: origin.scheduledAt,
        runAttempt: 1,
        runUrl: null,
      };
}

const envelopeOf = (claim: Claim): Envelope => ({
  name: claim.name,
  version: claim.version,
  at: claim.receivedAt,
  source: auditOf(claim).source,
  run_url: auditOf(claim).runUrl,
});

function pipelineEventOf(
  message: LedgerMessage,
  claim: Claim,
  { outcome, reason }: Pick<FoldStatements, 'outcome' | 'reason'>,
): PipelineEvent {
  const audit = auditOf(claim);

  return {
    message_id: message.id,
    received_at: claim.receivedAt,
    repository: claim.origin.repository,
    job_workflow_ref: audit.source,
    run_id: audit.runId,
    run_attempt: audit.runAttempt,
    sha: claim.origin.sha,
    payload: JSON.stringify(Schema.encodeSync(Claim)(claim)),
    outcome,
    reason,
  };
}

/** Moves for each npm dist-tag on this version, removals for tags npm dropped. */
const distTagChanges = (
  sources: Sources,
  target: VersionRow | undefined,
  envelope: Envelope,
) =>
  Effect.gen(function* () {
    const current = yield* findDistTags({ name: envelope.name });
    const recorded = new Map(current.map((row) => [row.tag, row]));
    const outcomes: DistTagOutcome[] = [];

    for (const [tag, version] of Object.entries(sources.distTags)) {
      if (version !== envelope.version) continue;

      outcomes.push(moveDistTag(recorded.get(tag), target, tag, envelope));
    }

    // without the version on npm, an empty dist-tags answer proves nothing
    const dropped =
      sources.npm === null
        ? []
        : current.filter((row) => !(row.tag in sources.distTags));

    for (const row of dropped) {
      const pointed =
        row.version === envelope.version
          ? target
          : Option.getOrUndefined(
              yield* findVersion({ name: row.name, version: row.version }),
            );

      outcomes.push(removeDistTag(row, pointed, row.tag, envelope));
    }

    for (const outcome of outcomes) {
      if (outcome.kind === 'rejected') {
        yield* Effect.logWarning(`dist-tag: ${outcome.reason}`);
      }
    }

    return outcomes;
  });

/** One read, observe, fold and write; `undefined` when a row moved before the write. */
const foldOnce = (message: LedgerMessage, claim: Claim) =>
  Effect.gen(function* () {
    const before = Option.getOrUndefined(
      yield* findVersion({ name: claim.name, version: claim.version }),
    );

    const sources = yield* (yield* Observer).observe(claim.name, claim.version);

    const envelope = envelopeOf(claim);
    const folded = fold(before, observationOf(sources, claim), envelope);

    if (folded.outcome === 'rejected') {
      yield* Effect.logWarning(
        `${claim.name}@${claim.version} rejected: ${folded.reason}`,
      );
    }

    const tags =
      folded.outcome === 'rejected'
        ? []
        : yield* distTagChanges(
            sources,
            folded.outcome === 'applied' ? folded.row : before,
            envelope,
          );

    const { guard, write, distTags, ledger, ...outcome } = foldStatements(
      folded,
      tags,
      message.id,
    );

    const statements = [
      pipelineInsert(pipelineEventOf(message, claim, outcome), guard),
      ...(write === undefined ? [] : [write]),
      ...distTags,
      ...ledger,
    ];

    const sql = yield* D1Client.D1Client;

    yield* sql.batch(statements.map((statement) => toSql(sql, statement)));

    // no claim row: a row moved after the read, and nothing was written
    const landed = Option.isSome(yield* findClaim({ message_id: message.id }));

    return landed ? ACK : undefined;
  });

const handleClaim = (message: LedgerMessage) =>
  Effect.gen(function* () {
    const claim = yield* decodeClaim(message.body);

    if (Option.isSome(yield* findClaim({ message_id: message.id }))) {
      return ACK;
    }

    for (let attempt = 1; attempt <= FOLD_ATTEMPTS; attempt += 1) {
      const verdict = yield* foldOnce(message, claim);

      if (verdict !== undefined) return verdict;

      yield* Effect.logWarning(
        `${claim.name}@${claim.version} moved during fold ${attempt}`,
      );
    }

    return RETRY;
  }).pipe(
    Effect.catchTag('ObservationError', (error) =>
      Effect.as(
        Effect.logWarning(`${error.source}: ${error.reason}`),
        retryAfter(error.retryAfter),
      ),
    ),
  );

const settle = (message: LedgerMessage, verdict: Verdict): void => {
  if (verdict.kind === 'ack') {
    message.ack();
  } else {
    message.retry({
      delaySeconds: queueDelaySeconds(message.attempts, verdict.retryAfter),
    });
  }
};

/** Any failure retries the message; exhausted retries go to the dead-letter queue. */
const settled = <E, R>(
  message: LedgerMessage,
  handle: Effect.Effect<Verdict, E, R>,
) =>
  handle.pipe(
    Effect.catchCause((cause) =>
      Effect.as(Effect.logError(`message ${message.id} failed`, cause), RETRY),
    ),
    Effect.map((verdict) => settle(message, verdict)),
  );

const bury = (queue: string, message: LedgerMessage) =>
  Effect.gen(function* () {
    const sql = yield* D1Client.D1Client;

    yield* insertDeadLetter(sql, {
      message_id: message.id,
      queue,
      attempts: message.attempts,
      body: JSON.stringify(message.body),
      received_at: message.timestamp.toISOString(),
    });

    return ACK;
  });

/** One queue invocation; messages run one after another. */
export const consume = (batch: LedgerBatch) =>
  Effect.forEach(
    batch.messages,
    (message) =>
      settled(
        message,
        batch.queue === DEAD_LETTER_QUEUE
          ? bury(batch.queue, message)
          : handleClaim(message),
      ),
    { discard: true },
  );
