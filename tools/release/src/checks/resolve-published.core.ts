// Pure logic for resolve-published.ts: which versions to wait for, and the wait itself over an injected registry read.

import { messageOf } from '@tools/shared/errors.ts';

import { type RetryOptions, withRetry } from '../lib/retry.ts';
import type { PublishedVersions } from './published-versions.core.ts';
import { releaseOf } from './ledger-check-runs.core.ts';

type Tags = Record<string, string>;

export type Target = { name: string; version: string };

/** 5 s doubling over 7 reads: about 5¼ minutes of waiting, inside the npm job's 15-minute timeout. */
export const WAIT_FOR_LISTING = { attempts: 7, baseDelayMs: 5000 } as const;

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

/** The log line for a retry: still unlisted, or a failed read. */
export function retryMessage(
  cause: unknown,
  attempt: number,
  attempts: number,
): string {
  return cause instanceof NotListed
    ? `npm doesn't list ${specsOf(cause.pending)} yet (read ${attempt} of ${attempts}); waiting`
    : `npm dist-tags read ${attempt} of ${attempts} failed: ${messageOf(cause)}; retrying`;
}

/**
 * Re-reads only the pending packages, under one shared budget, until a
 * dist-tag lists each; read 1 is `first`, so the budget counts it.
 * `unlisted` names what npm still lags on once the budget runs out.
 */
export async function waitForListings(
  read: (name: string) => Promise<Tags>,
  pending: readonly Target[],
  first: PublishedVersions,
  options: RetryOptions = WAIT_FOR_LISTING,
): Promise<{ versions: PublishedVersions; unlisted: Target[] }> {
  const versions = { ...first };
  let left = [...pending];
  let reread = false;

  const check = async () => {
    if (reread) {
      const reads = await Promise.all(left.map(({ name }) => read(name)));

      left.forEach(({ name }, index) => {
        versions[name] = reads[index] ?? {};
      });
    }

    reread = true;
    left = left.filter(
      ({ name, version }) => !isListed(versions[name], version),
    );

    if (left.length > 0) throw new NotListed(left);
  };

  try {
    await withRetry(check, options);

    return { versions, unlisted: [] };
  } catch (cause) {
    if (cause instanceof NotListed) return { versions, unlisted: left };

    throw cause;
  }
}
