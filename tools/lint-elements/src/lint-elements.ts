#!/usr/bin/env node
// The `//#lint:elements` lane: eslint-plugin-lit / -wc / -lit-a11y over
// WORKSPACE_SRC_GLOB, the set the rule block in @tools/eslint/elements.ts
// covers. `--max-warnings 0` because a warning exits 0 and nothing downstream
// would see it.
// Usage (from anywhere in the workspace): lint-elements [eslint args]

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { WORKSPACE_SRC_GLOB } from '@tools/shared/globs.ts';

// `--cache-strategy content` because a checkout's mtimes say nothing.
const ESLINT_ARGS = [
  '--cache',
  '--cache-location',
  '.cache/eslint-elements',
  '--cache-strategy',
  'content',
  '--max-warnings',
  '0',
  WORKSPACE_SRC_GLOB,
];

/**
 * eslint's CLI by module resolution rather than off PATH, so the lane does not
 * depend on which package's `node_modules/.bin` the caller happened to have.
 * Joined onto the manifest's own directory because eslint's `exports` block
 * refuses `eslint/bin/eslint.js`, while `eslint/package.json` is exported.
 */
function eslintCli(): string {
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve('eslint/package.json');

  // SAFETY: eslint's manifest maps its `eslint` bin to the CLI entry
  const manifest = require('eslint/package.json') as {
    bin: Record<string, string>;
  };

  return join(dirname(manifestPath), manifest.bin.eslint);
}

function main(): void {
  // From the repo root, which the glob, the flat config and the cache
  // location are all relative to.
  const eslint = spawnSync(
    process.execPath,
    [eslintCli(), ...ESLINT_ARGS, ...process.argv.slice(2)],
    { cwd: workspaceRoot, stdio: 'inherit' },
  );

  if (eslint.error !== undefined) {
    throw new Error(`could not run eslint: ${eslint.error.message}`);
  }

  process.exitCode = eslint.status ?? 1;
}

if (import.meta.main) main();
