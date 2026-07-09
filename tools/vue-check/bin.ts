#!/usr/bin/env node
// Runs vue-tsc over a workspace package's Vue SFCs.
//
// vue-tsc embeds the compiler through @volar/typescript, so it needs a real
// TypeScript 6: TS 7 exposes no `typescript/lib/tsc` subpath, and the
// @typescript/typescript6 compat package re-exports it (`require("@typescript/
// old/lib/tsc.js")`) rather than providing the file Volar's shim resolves.
// Owning that dependency here keeps callers on the TS 7 catalog, so their
// .ts files are still checked by the native compiler.
//
// Usage: vue-check <project> [...vue-tsc args]
//   <project> resolves from the workspace root, and is either a tsconfig file
//   or a directory containing tsconfig.json.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

import { workspaceRoot } from '../../scripts/workspace.ts';

const require = createRequire(import.meta.url);

// A parsed package.json is untyped; narrow it before reading a field.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function fail(message: string): never {
  console.error(`vue-check: ${message}`);
  console.error('usage: vue-check <project> [...vue-tsc args]');
  process.exit(2);
}

const [projectArg, ...forwarded] = process.argv.slice(2);
if (!projectArg) fail('missing <project>');

const project = resolve(workspaceRoot, projectArg);
if (!existsSync(project)) fail(`no such project: ${projectArg}`);
const projectDir = statSync(project).isDirectory() ? project : dirname(project);

const vueTscDir = dirname(require.resolve('vue-tsc/package.json'));
// `bin` is either a path string or a { <name>: path } record (npm's two forms).
const pkg: unknown = JSON.parse(
  readFileSync(join(vueTscDir, 'package.json'), 'utf8'),
);
const bin = isRecord(pkg) ? pkg.bin : undefined;
const binPath =
  typeof bin === 'string'
    ? bin
    : isRecord(bin) && typeof bin['vue-tsc'] === 'string'
      ? bin['vue-tsc']
      : undefined;
if (!binPath) fail('could not resolve the vue-tsc bin from its package.json');
const vueTsc = join(vueTscDir, binPath);

const result = spawnSync(
  process.execPath,
  [vueTsc, '--noEmit', '-p', project, ...forwarded],
  { cwd: projectDir, stdio: 'inherit' },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
