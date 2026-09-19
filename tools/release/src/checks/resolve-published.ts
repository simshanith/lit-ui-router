#!/usr/bin/env node
// Resolve each publishable package's dist-tags into published-versions.json —
// the registry-reading half of check:published-diff, split out so the diff
// itself can be a cached turbo task. npm enforces per-version tarball
// immutability (and we practice it as publishers: a published version is never
// mutated), so the only registry state that can move is the dist-tag pointers
// captured here; with this file in the check task's inputs, its cache key is
// sound. Which tag each package is compared against is decided downstream,
// from the local version — no registry lookup needed for that.

import pacote from 'pacote';

import type { PublishedVersions } from './published-versions.core.ts';
import { writePublishedVersions } from './published-versions.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { isPublishable, loadWorkspace } from '@tools/shared/workspace.ts';

/** `name`'s dist-tags, or `{}` when never published. */
async function publishedTags(name: string): Promise<Record<string, string>> {
  try {
    const packument = await pacote.packument(name);
    return { ...packument['dist-tags'] };
  } catch (error) {
    // An unpublished package is a real answer here; anything else (network,
    // 5xx, auth) must throw rather than silently report "unpublished".
    if ((error as { code?: string }).code === 'E404') return {};
    throw error;
  }
}

async function main() {
  const { members } = await loadWorkspace(workspaceRoot);
  const publishable = members.filter(isPublishable);
  const versions: PublishedVersions = {};
  for (const { name } of publishable) {
    versions[name] = await publishedTags(name);
  }
  await writePublishedVersions(versions);
  const summary = publishable
    .map(({ name }) => {
      const tags = Object.entries(versions[name] ?? {})
        .map(([tag, version]) => `${tag}@${version}`)
        .join(' ');
      return `${name}: ${tags === '' ? 'unpublished' : tags}`;
    })
    .join(', ');
  console.log(`resolved dist-tags → published-versions.json: ${summary}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
