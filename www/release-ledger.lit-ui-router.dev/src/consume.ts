// The queue consumer, the ledger's only D1 writer: per claim, observe the tag,
// npm and GitHub, fold the observation through the core, and write the outcome
// in one D1 batch. A message is acked only after its batch commits.
import { Effect, Option, Schema } from 'effect';
import { D1Client } from '@effect/sql-d1';
import {
  type DistTagOutcome,
  type Envelope,
  fold,
  moveDistTag,
  removeDistTag,
  type VersionRow,
} from '@tools/release-ledger';

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
import { type FoldStatements, foldStatements } from './ledger-statements.ts';
import { Observer, type Sources } from './observe.ts';

export const CLAIMS_QUEUE = 'release-ledger-claims';

export const DEAD_LETTER_QUEUE = 'release-ledger-claims-dlq';

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
  { npm, distTags }: Sources,
  target: VersionRow | undefined,
  envelope: Envelope,
) =>
  Effect.gen(function* () {
    if (distTags === null) return [];

    const current = yield* findDistTags({ name: envelope.name });
    const recorded = new Map(current.map((row) => [row.tag, row]));
    const outcomes: DistTagOutcome[] = [];

    for (const [tag, version] of Object.entries(distTags)) {
      if (version !== envelope.version) continue;

      outcomes.push(moveDistTag(recorded.get(tag), target, tag, envelope));
    }

    // without the version on npm, an empty dist-tags answer proves nothing
    const dropped =
      npm === null ? [] : current.filter((row) => !(row.tag in distTags));

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

const handleClaim = (message: LedgerMessage, claim: Claim) =>
  Effect.gen(function* () {
    if (Option.isSome(yield* findClaim({ message_id: message.id }))) {
      return ACK;
    }

    const before = Option.getOrUndefined(
      yield* findVersion({ name: claim.name, version: claim.version }),
    );

    const sources = yield* (yield* Observer).observe(claim.name, claim.version);
    const { tag, npm, gh } = sources;

    const envelope = envelopeOf(claim);
    const folded = fold(before, { tag, npm, gh }, envelope);

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

    const { write, distTags, ledger, ...outcome } = foldStatements(
      folded,
      tags,
      message.id,
    );

    const statements = [
      pipelineInsert(pipelineEventOf(message, claim, outcome)),
      ...(write === undefined ? [] : [write]),
      ...distTags,
      ...ledger,
    ];

    const sql = yield* D1Client.D1Client;

    yield* sql.batch(statements.map((statement) => toSql(sql, statement)));

    return ACK;
  }).pipe(
    Effect.catchTag('ObservationError', (error) =>
      Effect.as(
        Effect.logWarning(`${error.source}: ${error.reason}`),
        retryAfter(error.retryAfter),
      ),
    ),
  );

/** Redelivery backoff in seconds; `max_retries` in wrangler.jsonc bounds the window. */
export const QUEUE_BACKOFF = { base: 30, cap: 3600 } as const;

/** Queues reject a `delaySeconds` above 12 hours. */
export const QUEUE_MAX_DELAY_SECONDS = 43_200;

/** The ceiling for a 1-based attempt: `base` doubled per attempt, up to `cap`. */
export const queueCeiling = (attempts: number): number =>
  Math.min(
    QUEUE_BACKOFF.cap,
    QUEUE_BACKOFF.base * 2 ** Math.max(0, attempts - 1),
  );

/** Equal jitter over the ceiling's upper half; a rate limit's own wait wins. Queues only have a fixed `retry_delay`. */
export function queueDelaySeconds(
  attempts: number,
  retryAfter?: number,
  random: () => number = Math.random,
): number {
  const top = queueCeiling(attempts);
  const wait = retryAfter ?? top / 2 + (random() * top) / 2;

  return Math.min(QUEUE_MAX_DELAY_SECONDS, Math.ceil(wait));
}

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

/** A body that is not a claim never will be; it goes to `dead_letters` without retries. */
const decodeOrBury = (queue: string, message: LedgerMessage) =>
  decodeClaim(message.body).pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        Effect.andThen(
          Effect.logError(
            `message ${message.id} is not a claim, dead-lettered: ${error.message}`,
          ),
          bury(queue, message),
        ),
      onSuccess: (claim) => handleClaim(message, claim),
    }),
  );

/** One queue invocation; messages run one after another. */
export const consume = (batch: LedgerBatch) =>
  Effect.forEach(
    batch.messages,
    (message) =>
      settled(
        message,
        batch.queue === DEAD_LETTER_QUEUE
          ? bury(batch.queue, message)
          : decodeOrBury(batch.queue, message),
      ),
    { discard: true },
  );
