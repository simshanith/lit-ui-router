#!/usr/bin/env node
// Pack the publish tarball — publish-npm.yml's Pack step as a tool:
//   env in:  PACKAGE_NAME, PACKAGE_DIR (workspace-relative)
//   outputs: tarball (absolute path, for the attest + check + publish steps)
// Strip dev-only manifest fields, `pnpm pack`, restore. Read and write both go
// through pnpm's own project-manifest reader — the one `pnpm pack` itself reads
// with — so the stripped file keeps the source manifest's indentation instead
// of whatever a re-serialize would pick, and the restore is just the manifest
// the reader handed back. The restore is a try/finally (the workflow restored
// with `git checkout -- package.json`, which the try/finally is byte-equivalent
// to on CI's clean checkout — and unlike the bash, it also restores when the
// pack itself fails). Field decisions live in ./release-pack.core.ts.

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { readProjectManifest } from '@pnpm/workspace.project-manifest-reader';

import { defaultStream } from '@tools/shared/exec.ts';
import { group, runMain, setOutput } from '@tools/shared/gha.ts';
import { requireEnv } from '@tools/shared/env.core.ts';
import { pickTarball, strippedManifest } from './release-pack.core.ts';
import { workspaceRoot } from '@tools/shared/workspace.ts';

runMain(async () => {
  const packageName = requireEnv(process.env, 'PACKAGE_NAME');
  const packageDir = requireEnv(process.env, 'PACKAGE_DIR');
  const dir = join(workspaceRoot, packageDir);

  const { manifest, writeProjectManifest } = await readProjectManifest(dir);
  await group(`pack ${packageName} with stripped manifest`, async () => {
    try {
      await writeProjectManifest(strippedManifest(manifest));
      await defaultStream(
        'pnpm',
        ['--filter', packageName, 'pack', '--pack-destination', dir],
        { cwd: workspaceRoot },
      );
    } finally {
      // release-it later requires a clean working dir — and a failed pack
      // must not leave a stripped manifest behind either.
      await writeProjectManifest(manifest);
    }
  });

  const tarball = join(dir, pickTarball(await readdir(dir)));
  console.log(tarball);
  await setOutput('tarball', tarball);
});
