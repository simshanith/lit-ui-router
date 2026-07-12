#!/usr/bin/env node
// Pack the publish tarball — publish-npm.yml's Pack step as a tool:
//   env in:  PACKAGE_NAME, PACKAGE_DIR (workspace-relative)
//   outputs: tarball (absolute path, for the attest + check + publish steps)
// Strip dev-only manifest fields, `pnpm pack`, restore. The restore is a
// try/finally over the original file contents (the workflow restored with
// `git checkout -- package.json`, which the try/finally is byte-equivalent
// to on CI's clean checkout — and unlike the bash, it also restores when the
// pack itself fails). Field decisions live in ./release-pack.core.ts.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { defaultStream } from '../lib/exec.ts';
import { group, runMain, setOutput } from '../lib/gha.ts';
import { requireEnv } from '../lib/env.core.ts';
import { pickTarball, strippedManifestJson } from './release-pack.core.ts';
import { workspaceRoot } from '../lib/workspace.ts';

runMain(async () => {
  const packageName = requireEnv(process.env, 'PACKAGE_NAME');
  const packageDir = requireEnv(process.env, 'PACKAGE_DIR');
  const dir = join(workspaceRoot, packageDir);
  const manifestPath = join(dir, 'package.json');

  const original = await readFile(manifestPath, 'utf8');
  await group(`pack ${packageName} with stripped manifest`, async () => {
    try {
      await writeFile(manifestPath, strippedManifestJson(original));
      await defaultStream(
        'pnpm',
        ['--filter', packageName, 'pack', '--pack-destination', dir],
        { cwd: workspaceRoot },
      );
    } finally {
      // release-it later requires a clean working dir — and a failed pack
      // must not leave a stripped manifest behind either.
      await writeFile(manifestPath, original);
    }
  });

  const tarball = join(dir, pickTarball(await readdir(dir)));
  console.log(tarball);
  await setOutput('tarball', tarball);
});
