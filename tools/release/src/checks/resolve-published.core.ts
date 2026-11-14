// Pure logic for resolve-published.ts: which release to wait for, and the wait itself over an injected registry read.

import { type RetryOptions, withRetry } from '../lib/retry.ts';
import { releaseOf } from './ledger-check-runs.core.ts';

type Tags = Record<string, string>;

/** 5 s doubling over 7 reads: about 5¼ minutes of waiting, inside the npm job's 15-minute timeout. */
export const WAIT_FOR_LISTING = { attempts: 7, baseDelayMs: 5000 } as const;

/** The `<name>@<version>` to wait for, or undefined when blank, unparseable, or not a publishable member. */
export function awaitedRelease(
  release: string,
  publishable: readonly string[],
): { name: string; version: string } | undefined {
  const parsed = releaseOf(release.trim());

  return parsed && publishable.includes(parsed.name) ? parsed : undefined;
}

class NotListed extends Error {
  readonly tags: Tags;

  constructor(tags: Tags) {
    super('version not on any dist-tag yet');
    this.tags = tags;
  }
}

/** Re-reads the dist-tags until one points at `version`; `listed: false` carries the last read once the budget runs out. */
export async function waitForListing(
  read: () => Promise<Tags>,
  version: string,
  options: RetryOptions = WAIT_FOR_LISTING,
): Promise<{ tags: Tags; listed: boolean }> {
  const readListed = async () => {
    const tags = await read();

    if (!Object.values(tags).includes(version)) throw new NotListed(tags);

    return tags;
  };

  try {
    return { tags: await withRetry(readListed, options), listed: true };
  } catch (cause) {
    if (cause instanceof NotListed) return { tags: cause.tags, listed: false };

    throw cause;
  }
}
