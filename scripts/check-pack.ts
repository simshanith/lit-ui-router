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
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  findUnsubstitutedRefs,
  formatReport,
  type PackResult,
} from './check-pack.core.ts';
import type { Manifest } from './check-catalog.core.ts';
import { loadWorkspace, workspaceRoot } from './workspace.ts';

const run = promisify(execFile);

// Node's spawn/exec errors carry a string `code`; narrow before reading it.
function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

// A package.json is always a JSON object; anything else can't hold dep fields.
function isManifest(value: unknown): value is Manifest {
  return typeof value === 'object' && value !== null;
}

/** `pnpm pack` in `cwd`; falls back to corepack when pnpm is not on PATH. */
async function pnpmPack(cwd: string, destination: string): Promise<void> {
  const args = ['pack', '--pack-destination', destination];
  try {
    await run('pnpm', args, { cwd });
  } catch (error) {
    if (!isErrnoException(error) || error.code !== 'ENOENT') throw error;
    await run('corepack', ['pnpm', ...args], { cwd });
  }
}

/** Pack one package and return the manifest from inside the tarball. */
async function packedManifest(packageDir: string): Promise<Manifest> {
  const destination = await mkdtemp(join(tmpdir(), 'check-pack-'));
  try {
    await pnpmPack(packageDir, destination);
    const tarball = (await readdir(destination)).find((f) =>
      f.endsWith('.tgz'),
    );
    if (tarball === undefined) {
      throw new Error(`pnpm pack produced no .tgz in ${destination}`);
    }
    const { stdout } = await run(
      'tar',
      ['-xzOf', join(destination, tarball), 'package/package.json'],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    const parsed: unknown = JSON.parse(stdout);
    return isManifest(parsed) ? parsed : {};
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
