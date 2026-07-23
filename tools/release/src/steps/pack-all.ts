#!/usr/bin/env node
// The `@tools/release#pack` turbo task: pack every publishable package once,
// publish-shape, into `.cache/pack/<name>.tgz`. check:pack, check:exports, and
// check:published-diff all READ these tarballs rather than each re-packing, so
// the workspace is packed once per graph and every check sees byte-identical
// publish bytes. The publish workflow deliberately does NOT read this cache
// (an unsigned remote-cache entry must not sit under the attestation); it
// re-packs from source with the same packPublishTarball.

import { mkdir, readdir, rm, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import {
  packDir,
  packStagingParent,
  packTarballPath,
} from '../checks/cache-paths.ts';
import { assertSelfDeclaredDeps } from '../checks/self-deps.ts';
import { packPublishTarball } from './pack-staged.ts';
import { loadWorkspace, workspaceRoot } from '@tools/shared/workspace.ts';

async function main() {
  const { members } = await loadWorkspace(workspaceRoot);
  const publishable = members.filter(
    (member) =>
      member.dir !== '<root>' &&
      member.manifest &&
      member.manifest.private !== true,
  );
  // The same invariant every check relies on: `^build` covers each package.
  await assertSelfDeclaredDeps(publishable.map(({ name }) => name));

  // Clear stale tarballs so a removed package leaves no ghost output.
  await mkdir(packDir, { recursive: true });
  for (const entry of await readdir(packDir)) {
    if (entry.endsWith('.tgz')) await unlink(join(packDir, entry));
  }

  for (const { name, dir } of publishable) {
    await packPublishTarball(
      name,
      join(workspaceRoot, dir),
      packTarballPath(name),
      packStagingParent,
    );
    console.log(`packed ${name} → ${packTarballPath(name)}`);
  }

  await rm(packStagingParent, { recursive: true, force: true });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
