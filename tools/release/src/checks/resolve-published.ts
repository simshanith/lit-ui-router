#!/usr/bin/env node
// Resolve each publishable package's `latest` dist-tag into
// published-versions.json — the registry-reading half of check:published-diff,
// split out so the diff itself can be a cached turbo task. npm enforces
// per-version tarball immutability (and we practice it as publishers: a
// published version is never mutated), so the only registry state that can
// move is the dist-tag pointer captured here; with this file in the check
// task's inputs, its cache key is sound.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { PublishedVersions } from './published-versions.core.ts';
import { writePublishedVersions } from './published-versions.ts';
import { loadWorkspace, workspaceRoot } from '@tools/shared/workspace.ts';

const run = promisify(execFile);

/** The `latest` dist-tag for `name`, or null when never published. */
async function publishedLatest(name: string): Promise<string | null> {
  try {
    const { stdout } = await run('npm', ['view', name, 'dist-tags.latest']);
    return stdout.trim() || null;
  } catch (error) {
    // promisified execFile rejects with the child's captured output attached.
    const { stderr } = (error ?? {}) as { stderr?: string };
    if (stderr?.includes('E404')) return null;
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
