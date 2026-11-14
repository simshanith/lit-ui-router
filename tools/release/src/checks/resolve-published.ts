#!/usr/bin/env node
// Resolve each publishable package's dist-tags into published-versions.json —
// the registry-reading half of check:published-diff, split out so the diff
// itself can be a cached turbo task. npm enforces per-version tarball
// immutability (and we practice it as publishers: a published version is never
// mutated), so the only registry state that can move is the dist-tag pointers
// captured here; with this file in the check task's inputs, its cache key is
// sound.

import pacote from 'pacote';

import type { PublishedVersions } from './published-versions.core.ts';
import { writePublishedVersions } from './published-versions.ts';
import {
  WAIT_FOR_LISTING,
  awaitedRelease,
  waitForListing,
} from './resolve-published.core.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { logWarning } from '@tools/shared/gha.ts';
import { isPublishable, loadWorkspace } from '@tools/shared/workspace.ts';
import { failMain } from '../lib/fail-main.ts';

/** `name`'s dist-tags, or `{}` when never published. */
async function publishedTags(name: string): Promise<Record<string, string>> {
  try {
    // npm serves max-age=300; without revalidation a poll re-reads pacote's disk cache.
    const packument = await pacote.packument(name, { preferOnline: true });

    return { ...packument['dist-tags'] };
  } catch (error) {
    // An unpublished package is a real answer here; anything else (network,
    // 5xx, auth) must throw rather than silently report "unpublished".
    // SAFETY: pacote rejects with Errors that carry npm's `code`
    if ((error as { code?: string }).code === 'E404') return {};
    throw error;
  }
}

/** `name`'s dist-tags once one points at `version`, or the last read when npm still lags after the wait. */
async function listedTags(
  name: string,
  version: string,
): Promise<Record<string, string>> {
  const { tags, listed } = await waitForListing(
    () => publishedTags(name),
    version,
    {
      ...WAIT_FOR_LISTING,
      onRetry: (_, attempt) =>
        console.log(
          `npm doesn't list ${name}@${version} yet (read ${attempt} of ${WAIT_FOR_LISTING.attempts}); waiting`,
        ),
    },
  );

  if (!listed) {
    logWarning(
      `npm's dist-tags for ${name} still don't list ${version} after the wait; published-diff compares against what npm lists`,
    );
  }

  return tags;
}

async function main() {
  const { members } = await loadWorkspace(workspaceRoot);
  const publishable = members.filter(isPublishable);
  const release = process.env.RELEASE?.trim() ?? '';

  const awaited = awaitedRelease(
    release,
    publishable.map(({ name }) => name),
  );

  const versions: PublishedVersions = {};
  const summary: string[] = [];

  if (release !== '' && !awaited) {
    logWarning(
      `RELEASE ${release} is not <name>@<version> of a publishable package; resolving without waiting`,
    );
  }

  for (const { name } of publishable) {
    const tags =
      name === awaited?.name
        ? await listedTags(name, awaited.version)
        : await publishedTags(name);

    versions[name] = tags;

    const specs = Object.entries(tags)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([tag, version]) => `${tag}@${version}`);

    summary.push(
      `${name}: ${specs.length === 0 ? 'unpublished' : specs.join(' ')}`,
    );
  }

  await writePublishedVersions(versions);
  console.log(
    `resolved dist-tags → published-versions.json: ${summary.join(', ')}`,
  );
}

main().catch(failMain);
