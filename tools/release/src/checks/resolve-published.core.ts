// Pure logic for resolve-published.ts: which versions to wait for, and the wait itself over an injected registry read.

import { messageOf } from '@tools/shared/errors.ts';
import { Duration, Effect, Schedule } from 'effect';
import * as v from 'valibot';

import type { PublishedVersions } from './published-versions.core.ts';
import { releaseOf } from './ledger-check-runs.core.ts';

type Tags = Record<string, string>;

export type Target = { name: string; version: string };

/** Delays 2, 4, 8, 16 s, then 25 s each, all jittered ×0.8–1.2 (≤ 30 s); the last read starts by 5½ min. */
export const WAIT_FOR_LISTING = {
  baseMs: 2000,
  capMs: 25_000,
  budgetMs: 300_000,
} as const;

/** The `<name>@<version>` a post-publish run names, or undefined when blank, unparseable, or not a publishable member. */
export function awaitedRelease(
  release: string,
  publishable: readonly string[],
): Target | undefined {
  const parsed = releaseOf(release.trim());

  return parsed && publishable.includes(parsed.name) ? parsed : undefined;
}

/** Whether any dist-tag points at `version`. */
export function isListed(tags: Tags | undefined, version: string): boolean {
  return Object.values(tags ?? {}).includes(version);
}

/**
 * What a post-publish run waits for: the checked-out version of the named
 * package and of every package already on npm, where no dist-tag lists it
 * yet. No release named means no wait.
 */
export function pendingTargets(
  release: Target | undefined,
  members: readonly { name: string; version: string | undefined }[],
  first: PublishedVersions,
): Target[] {
  if (!release) return [];

  const targets = members.flatMap(({ name, version }): Target[] => {
    // The diff compares against the checked-out manifest, which may be past the dispatched version.
    if (name === release.name) {
      return [{ name, version: version ?? release.version }];
    }

    const onNpm = Object.keys(first[name] ?? {}).length > 0;

    return onNpm && version !== undefined ? [{ name, version }] : [];
  });

  return targets.filter(({ name, version }) => !isListed(first[name], version));
}

export class NotListed extends Error {
  readonly pending: readonly Target[];

  constructor(pending: readonly Target[]) {
    super('versions not on any dist-tag yet');
    this.pending = pending;
  }
}

export const specsOf = (targets: readonly Target[]): string =>
  targets.map(({ name, version }) => `${name}@${version}`).join(', ');

/** One scheduled retry: why the last round fell short, and when the next read starts. */
export type Retry = {
  cause: unknown;
  round: number;
  elapsedMs: number;
  delayMs: number;
};

const seconds = (ms: number): string => `${Math.round(ms / 1000)} s`;

/** The log line for a retry: still unlisted, or a failed read. */
export function retryMessage({
  cause,
  round,
  elapsedMs,
  delayMs,
}: Retry): string {
  const when = `round ${round}, ${seconds(elapsedMs)} into the wait; next read in ${seconds(delayMs)}`;

  return cause instanceof NotListed
    ? `npm doesn't list ${specsOf(cause.pending)} yet (${when})`
    : `npm dist-tags read failed: ${messageOf(cause)} (${when})`;
}

// npm-registry-fetch's HttpErrorGeneral carries `statusCode` and `headers.raw()`.
const RateLimited = v.object({
  statusCode: v.literal(429),
  headers: v.object({
    'retry-after': v.tuple([v.pipe(v.string(), v.toNumber(), v.minValue(0))]),
  }),
});

/** A 429's Retry-After in ms; undefined for any other cause or an HTTP-date. */
export function retryAfterMs(cause: unknown): number | undefined {
  const parsed = v.safeParse(RateLimited, cause);

  if (!parsed.success) return undefined;

  const [after] = parsed.output.headers['retry-after'];

  return Number.isFinite(after) ? after * 1000 : undefined;
}

/** Exponential from `baseMs`, capped at `capMs`, jittered, ended once `budgetMs` has elapsed; a 429's Retry-After wins up to the budget. */
export function listingSchedule(onRetry: (retry: Retry) => void) {
  const { baseMs, capMs, budgetMs } = WAIT_FOR_LISTING;

  return Schedule.exponential(Duration.millis(baseMs)).pipe(
    Schedule.modifyDelay(({ duration }) =>
      Effect.succeed(Math.min(Duration.toMillis(duration), capMs)),
    ),
    Schedule.jittered,
    Schedule.modifyDelay(({ input, elapsed, duration }) => {
      const after = retryAfterMs(input);

      return Effect.succeed(
        after === undefined
          ? duration
          : Math.max(
              Math.min(after, budgetMs - elapsed),
              Duration.toMillis(duration),
            ),
      );
    }),
    Schedule.upTo({ duration: Duration.millis(budgetMs) }),
    Schedule.tap(({ input, attempt, elapsed, duration }) =>
      Effect.sync(() =>
        onRetry({
          cause: input,
          round: attempt,
          elapsedMs: elapsed,
          delayMs: Duration.toMillis(duration),
        }),
      ),
    ),
  );
}

type Listings = { versions: PublishedVersions; unlisted: Target[] };

/**
 * Re-reads only the pending packages, in parallel, until a dist-tag lists
 * each or the schedule ends; round 1 is `first`. `unlisted` names what npm
 * still lags on; a read failure that ends the wait fails the effect.
 */
export function waitForListings(
  read: (name: string) => Promise<Tags>,
  pending: readonly Target[],
  first: PublishedVersions,
  onRetry: (retry: Retry) => void = () => {},
): Effect.Effect<Listings, unknown> {
  const versions = { ...first };
  let left = [...pending];
  let reread = false;

  const reads = Effect.tryPromise({
    try: () => Promise.all(left.map(({ name }) => read(name))),
    catch: (cause) => cause,
  });

  const check = Effect.gen(function* () {
    if (reread) {
      const tags = yield* reads;

      left.forEach(({ name }, index) => {
        versions[name] = tags[index] ?? {};
      });
    }

    reread = true;
    left = left.filter(
      ({ name, version }) => !isListed(versions[name], version),
    );

    if (left.length > 0) yield* Effect.fail(new NotListed(left));
  });

  return check.pipe(
    Effect.retry({ schedule: listingSchedule(onRetry) }),
    Effect.as<Listings>({ versions, unlisted: [] }),
    Effect.catchIf(
      (cause): cause is NotListed => cause instanceof NotListed,
      () => Effect.succeed<Listings>({ versions, unlisted: left }),
    ),
  );
}
