// The Cron Trigger's sweep: list the repository's tags and enqueue an ordinary
// claim for each release tag, so the ledger heals without an Actions run.
import { Effect, Option, Schema } from 'effect';

import { type Claim, type LedgerQueue, Release } from './claim.ts';
import { listTags, type ObserverEnv } from './observe.ts';

/** Queues take at most 100 messages per batch. */
export const SEND_BATCH_LIMIT = 100;

export interface SweepEnv extends ObserverEnv {
  LEDGER_QUEUE: Pick<LedgerQueue, 'sendBatch'>;
}

export interface SweepRun {
  cron: string;
  scheduledAt: string;
}

export interface TagRef {
  readonly ref: string;
  readonly object: { readonly sha: string };
}

/** A release tag's `<name>@<version>` and the sha its ref points at. */
export interface ReleaseTag {
  readonly name: Claim['name'];
  readonly version: Claim['version'];
  readonly sha: string;
}

const decodeRelease = Schema.decodeUnknownOption(Release);

/** Every tag that names a `<name>@<version>`; other tags are skipped. */
export function releaseTags(refs: readonly TagRef[]): ReleaseTag[] {
  return refs.flatMap(({ ref, object }) => {
    const tag = ref.replace(/^refs\/tags\//, '');
    const at = tag.lastIndexOf('@');

    const release = decodeRelease({
      name: tag.slice(0, at),
      version: tag.slice(at + 1),
    });

    if (at <= 0 || Option.isNone(release)) return [];

    return [{ ...release.value, sha: object.sha }];
  });
}

/** One claim per release tag. */
export function sweepClaims(
  refs: readonly TagRef[],
  repository: string,
  run: SweepRun,
): Claim[] {
  return releaseTags(refs).map(({ name, version, sha }): Claim => ({
    receivedAt: run.scheduledAt,
    name,
    version,
    origin: {
      kind: 'sweep',
      repository,
      cron: run.cron,
      scheduledAt: run.scheduledAt,
      sha,
    },
  }));
}

export const sweep = (env: SweepEnv, run: SweepRun) =>
  Effect.gen(function* () {
    const claims = sweepClaims(yield* listTags(env), env.OIDC_REPOSITORY, run);

    for (let start = 0; start < claims.length; start += SEND_BATCH_LIMIT) {
      const chunk = claims.slice(start, start + SEND_BATCH_LIMIT);

      yield* Effect.promise(() =>
        env.LEDGER_QUEUE.sendBatch(chunk.map((body) => ({ body }))),
      );
    }

    yield* Effect.logInfo(`swept ${claims.length} release tags`);
  });
