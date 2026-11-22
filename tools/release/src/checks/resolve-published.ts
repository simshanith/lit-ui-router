#!/usr/bin/env node
// Resolve each publishable package's dist-tags into published-versions.json —
// the registry-reading half of check:published-diff, split out so the diff
// itself can be a cached turbo task. npm enforces per-version tarball
// immutability (and we practice it as publishers: a published version is never
// mutated), so the only registry state that can move is the dist-tag pointers
// captured here; with this file in the check task's inputs, its cache key is
// sound.

import { Effect } from 'effect';
import pacote from 'pacote';

import type { PublishedVersions } from './published-versions.core.ts';
import { writePublishedVersions } from './published-versions.ts';
import {
  type Target,
  awaitedRelease,
  awaitedTargets,
  retryMessage,
  specsOf,
  waitForListings,
} from './resolve-published.core.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { logWarning } from '@tools/shared/gha.ts';
import { isPublishable, loadWorkspace } from '@tools/shared/workspace.ts';
import { failMain } from '../lib/fail-main.ts';

/** `name`'s dist-tags, or `{}` when never published. */
async function publishedTags(name: string): Promise<Record<string, string>> {
  try {
    const packument = await pacote.packument(name);

    return { ...packument['dist-tags'] };
  } catch (error) {
    // An unpublished package is a real answer here; anything else (network,
    // 5xx, auth) must throw rather than silently report "unpublished".
    // SAFETY: pacote rejects with Errors that carry npm's `code`
    if ((error as { code?: string }).code === 'E404') return {};
    throw error;
  }
}

/** Whether npm serves `target`'s tarball yet; throws on anything but 2xx or 404. */
async function tarballServed({ name, version }: Target): Promise<boolean> {
  const { dist } = await pacote.manifest(`${name}@${version}`);
  const response = await fetch(dist.tarball, { method: 'HEAD' });

  if (response.ok) return true;

  if (response.status === 404) return false;

  const retryAfter = response.headers.get('retry-after');

  // The npm-registry-fetch error shape retryAfterMs reads.
  throw Object.assign(
    new Error(`HEAD ${dist.tarball}: HTTP ${response.status}`),
    {
      statusCode: response.status,
      headers: { 'retry-after': retryAfter === null ? [] : [retryAfter] },
    },
  );
}

async function main() {
  const { members } = await loadWorkspace(workspaceRoot);
  const publishable = members.filter(isPublishable);
  const released = process.env.RELEASED_PACKAGE_VERSION?.trim() ?? '';

  const named = awaitedRelease(
    released,
    publishable.map(({ name }) => name),
  );

  if (released !== '' && !named) {
    logWarning(
      `RELEASED_PACKAGE_VERSION ${released} is not <name>@<version> of a publishable package; resolving without waiting`,
    );
  }

  const first: PublishedVersions = {};

  for (const { name } of publishable) first[name] = await publishedTags(name);

  const awaited = awaitedTargets(
    named,
    publishable.map(({ name, manifest }) => ({
      name,
      version: manifest.version,
    })),
    first,
  );

  const { versions, unlisted, unserved } = await Effect.runPromise(
    waitForListings(
      { read: publishedTags, served: tarballServed },
      awaited,
      first,
      (retry) => console.log(retryMessage(retry)),
    ),
  );

  if (unserved.length > 0) {
    throw new Error(
      `npm lists ${specsOf(unserved)} but still doesn't serve the tarball after the wait; published-diff can't fetch it`,
    );
  }

  if (unlisted.length > 0) {
    logWarning(
      `npm's dist-tags still don't list ${specsOf(unlisted)} after the wait; published-diff compares against what npm lists`,
    );
  }

  const summary = Object.entries(versions).map(([name, tags]) => {
    const specs = Object.entries(tags)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([tag, version]) => `${tag}@${version}`);

    return `${name}: ${specs.length === 0 ? 'unpublished' : specs.join(' ')}`;
  });

  await writePublishedVersions(versions);
  console.log(
    `resolved dist-tags → published-versions.json: ${summary.join(', ')}`,
  );
}

main().catch(failMain);
