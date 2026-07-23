#!/usr/bin/env node
// Resolve each publishable package's `latest` dist-tag into
// published-versions.json — the registry-reading half of check:published-diff,
// split out so the diff itself can be a cached turbo task. Reads the registry
// through pacote (as tarball.ts does) rather than shelling out to `npm view`:
// one less subprocess, and an unpublished package arrives as a real E404 error
// code instead of a string to match in stderr. npm enforces
// per-version tarball immutability (and we practice it as publishers: a
// published version is never mutated), so the only registry state that can
// move is the dist-tag pointer captured here; with this file in the check
// task's inputs, its cache key is sound.

import pacote from 'pacote';

import type { PublishedVersions } from './published-versions.core.ts';
import { writePublishedVersions } from './published-versions.ts';
import { loadWorkspace, workspaceRoot } from '@tools/shared/workspace.ts';

/** The `latest` dist-tag for `name`, or null when never published. */
async function publishedLatest(name: string): Promise<string | null> {
  try {
    const packument = await pacote.packument(name);
    return packument['dist-tags'].latest ?? null;
  } catch (error) {
    // pacote rejects with npm's own error code; an unpublished package is a
    // real answer here, not a failure. Anything else (network, 5xx, auth) must
    // still throw — a swallowed error would silently report "unpublished" and
    // suppress the drift check for that package.
    if ((error as { code?: string }).code === 'E404') return null;
    throw error;
  }
}

async function main() {
  const { members } = await loadWorkspace(workspaceRoot);
  const publishable = members.filter(
    (member) =>
      member.dir !== '<root>' &&
      member.manifest &&
      member.manifest.private !== true,
  );
  const versions: PublishedVersions = {};
  for (const { name } of publishable) {
    versions[name] = await publishedLatest(name);
  }
  await writePublishedVersions(versions);
  const summary = publishable
    .map(({ name }) => `${name}@${versions[name] ?? 'unpublished'}`)
    .join(', ');
  console.log(
    `resolved latest dist-tags → published-versions.json: ${summary}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
