#!/usr/bin/env node
// Guard publishable packages against shipping unsubstituted catalog:/workspace:
// refs. `pnpm pack` rewrites those protocols into concrete ranges; npm's own
// pack does not, which is how lit-ui-router 1.3.0–1.5.0 published manifests
// consumers cannot install. Packing here — in the ci pipeline, with the same
// pnpm the publish workflow uses — keeps main releasable instead of
// discovering a leak at publish time.
//
// This file is the IO shell: it packs each non-private workspace package into
// a temp dir, extracts the packed package.json, and delegates all decisions to
// the pure, unit-tested functions in ./check-pack.core.ts.

import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  findUnsubstitutedRefs,
  formatReport,
  type PackResult,
} from './check-pack.core.ts';
import { pnpmPack } from './pack.ts';
import type { PackageManifest } from './types.ts';
import { loadWorkspace, workspaceRoot } from './workspace.ts';

const run = promisify(execFile);

// A package.json is always a JSON object; anything else can't hold dep fields.
function isPackageManifest(value: unknown): value is PackageManifest {
  return typeof value === 'object' && value !== null;
}

/** Pack one package and return the manifest from inside the tarball. */
async function packedManifest(packageDir: string): Promise<PackageManifest> {
  const destination = await mkdtemp(join(tmpdir(), 'check-pack-'));
  const tarball = join(destination, 'package.tgz');
  try {
    await pnpmPack(packageDir, tarball);
    const { stdout } = await run(
      'tar',
      ['-xzOf', tarball, 'package/package.json'],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    const parsed: unknown = JSON.parse(stdout);
    return isPackageManifest(parsed) ? parsed : {};
  } finally {
    await rm(destination, { recursive: true, force: true });
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
  const results: PackResult[] = [];
  for (const { name, dir } of publishable) {
    const manifest = await packedManifest(join(workspaceRoot, dir));
    results.push({ name, dir, refs: findUnsubstitutedRefs(manifest) });
  }
  const { ok, text } = formatReport(results);
  (ok ? console.log : console.error)(text);
  if (!ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
