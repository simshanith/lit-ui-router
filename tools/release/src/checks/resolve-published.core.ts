// Pure logic for resolve-published.ts: which versions to wait for, and the wait itself over an injected registry read.

import { messageOf } from '@tools/shared/errors.ts';
import { Duration, Effect, Schedule } from 'effect';
import * as v from 'valibot';

import type { PublishedVersions } from './published-versions.core.ts';
import { releaseOf } from './ledger-check-runs.core.ts';

type Tags = Record<string, string>;

export type Target = { name: string; version: string };

/**
 * How long to keep re-reading npm. The wait between reads doubles from
 * `baseMs` and stops growing at `capMs`. No new wait starts after `budgetMs`.
 */
export const WAIT_FOR_LISTING = {
  baseMs: 2000,
  capMs: 25_000,
  budgetMs: 300_000,
} as const;

/** Parses `JUST_PUBLISHED`; undefined when it is blank, malformed, or names no publishable package. */
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
 * The package versions npm must list before the wait ends; empty when
 * nothing was just published. Covers the just-published package and every
 * other package already on npm, each at its checked-out version, and skips
 * those a dist-tag already points at.
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

/**
 * {@link WAIT_FOR_LISTING} as a schedule, with each wait jittered ×0.8–1.2.
 * A 429's longer Retry-After replaces the wait, up to the budget.
 */
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
 * Re-reads the pending packages until npm lists each one or the schedule
 * ends; `first` is the read already made. `unlisted` holds whatever npm
 * still lacks. Fails only when the last read itself failed.
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
