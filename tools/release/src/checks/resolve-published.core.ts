// Pure logic for resolve-published.ts: which versions to wait for, and the wait itself over an injected registry read.

import { messageOf } from '@tools/shared/errors.ts';
import { Duration, Effect, Schedule } from 'effect';
import * as v from 'valibot';

import type { PublishedVersions } from './published-versions.core.ts';
import { releaseOf } from './ledger-check-runs.core.ts';

type Tags = Record<string, string>;

export type Target = { name: string; version: string };

/**
 * How long to keep re-reading npm, for both the dist-tags and the tarballs. The wait between reads doubles from
 * `baseMs` and stops growing at `capMs`. No new wait starts after `budgetMs`.
 */
export const WAIT_FOR_LISTING = {
  baseMs: 2000,
  capMs: 25_000,
  budgetMs: 300_000,
} as const;

/** Parses `RELEASED_PACKAGE_VERSION`; undefined when it is blank, malformed, or names no publishable package. */
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
 * The package versions npm must list and serve before the wait ends; empty
 * when nothing was just published. Covers the just-published package and
 * every other package already on npm, each at its checked-out version.
 */
export function awaitedTargets(
  release: Target | undefined,
  members: readonly { name: string; version: string | undefined }[],
  first: PublishedVersions,
): Target[] {
  if (!release) return [];

  return members.flatMap(({ name, version }): Target[] => {
    // The diff compares against the checked-out manifest, which may be past the dispatched version.
    if (name === release.name) {
      return [{ name, version: version ?? release.version }];
    }

    const onNpm = Object.keys(first[name] ?? {}).length > 0;

    return onNpm && version !== undefined ? [{ name, version }] : [];
  });
}

/** Targets the last round found not yet listed, or listed with no tarball served. */
export class NotReady extends Error {
  readonly unlisted: readonly Target[];
  readonly unserved: readonly Target[];

  constructor(unlisted: readonly Target[], unserved: readonly Target[]) {
    super('versions not listed or not served yet');
    this.unlisted = unlisted;
    this.unserved = unserved;
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

/** What a round still lacks, as one clause. */
export function lackingMessage({ unlisted, unserved }: NotReady): string {
  return [
    unlisted.length > 0 ? `npm doesn't list ${specsOf(unlisted)} yet` : '',
    unserved.length > 0
      ? `npm doesn't serve the tarball of ${specsOf(unserved)} yet`
      : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/** The log line for a retry: still not ready, or a failed read. */
export function retryMessage({
  cause,
  round,
  elapsedMs,
  delayMs,
}: Retry): string {
  const when = `round ${round}, ${seconds(elapsedMs)} into the wait; next read in ${seconds(delayMs)}`;

  return cause instanceof NotReady
    ? `${lackingMessage(cause)} (${when})`
    : `npm registry read failed: ${messageOf(cause)} (${when})`;
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

type Listings = {
  versions: PublishedVersions;
  unlisted: Target[];
  unserved: Target[];
};

/** Reads that resolve the wait: a package's dist-tags, and whether a version's tarball responds. */
export type Registry = {
  read: (name: string) => Promise<Tags>;
  served: (target: Target) => Promise<boolean>;
};

const attempt = <A>(io: () => Promise<A>) =>
  Effect.tryPromise({ try: io, catch: (cause) => cause });

/**
 * Re-reads the awaited packages until npm lists each one and serves its
 * tarball, or the schedule ends; `first` is the dist-tags read already made.
 * `unlisted` and `unserved` hold whatever npm still lacks. Fails only when
 * the last read itself failed.
 */
export function waitForListings(
  { read, served }: Registry,
  awaited: readonly Target[],
  first: PublishedVersions,
  onRetry: (retry: Retry) => void = () => {},
): Effect.Effect<Listings, unknown> {
  const versions = { ...first };

  const listed = ({ name, version }: Target) =>
    isListed(versions[name], version);

  let left = [...awaited];
  let reread = false;

  const check = Effect.gen(function* () {
    const unlisted = left.filter((target) => !listed(target));

    if (reread && unlisted.length > 0) {
      const tags = yield* attempt(() =>
        Promise.all(unlisted.map(({ name }) => read(name))),
      );

      unlisted.forEach(({ name }, index) => {
        versions[name] = tags[index] ?? {};
      });
    }

    reread = true;

    const ready = left.filter(listed);
    const responds = yield* attempt(() => Promise.all(ready.map(served)));
    const unserved = ready.filter((_, index) => !responds[index]);

    left = left.filter(
      (target) => !listed(target) || unserved.includes(target),
    );

    if (left.length > 0) {
      yield* Effect.fail(
        new NotReady(
          left.filter((target) => !listed(target)),
          unserved,
        ),
      );
    }
  });

  const remaining = (): Listings => ({
    versions,
    unlisted: left.filter((target) => !listed(target)),
    unserved: left.filter(listed),
  });

  return check.pipe(
    Effect.retry({ schedule: listingSchedule(onRetry) }),
    Effect.map(remaining),
    Effect.catchIf(
      (cause): cause is NotReady => cause instanceof NotReady,
      () => Effect.succeed(remaining()),
    ),
  );
}
