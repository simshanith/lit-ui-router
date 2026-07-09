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
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

import { workspaceRoot } from '../../scripts/workspace.ts';

// Resolving from this file, rather than the workspace root, picks the vue-tsc
// instance installed for this package — the store holds one copy per peer.
const require = createRequire(import.meta.url);

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

let vueTsc: string;
try {
  vueTsc = require.resolve('vue-tsc/bin/vue-tsc.js');
} catch (error) {
  // Rethrown as-is: its `code` separates a missing install (MODULE_NOT_FOUND)
  // from vue-tsc gaining an exports map (ERR_PACKAGE_PATH_NOT_EXPORTED).
  console.error('vue-check: could not resolve vue-tsc/bin/vue-tsc.js');
  throw error;
}

const result = spawnSync(
  process.execPath,
  [vueTsc, '--noEmit', '-p', project, ...forwarded],
  { cwd: projectDir, stdio: 'inherit' },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
