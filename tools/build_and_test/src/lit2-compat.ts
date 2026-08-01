#!/usr/bin/env node
// Post-merge lit 2 compat lane: repoints the default catalog's lit at the
// lit2-compat pin, reinstalls, and runs the lit packages' unit suites and
// src typechecks against the resolved 2.x install. Mutates
// pnpm-workspace.yaml and the lockfile — meant for a throwaway CI checkout;
// locally, restore with `git checkout -- pnpm-workspace.yaml pnpm-lock.yaml
// && pnpm install`.
//
// env: none beyond the pnpm/node toolchain on PATH.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyCompatRange,
  assertPeerRangeCoversMajor2,
  compatRange,
} from './lit2-compat.core.ts';

const LIT_PACKAGES = ['lit-ui-router', 'lit-ui-router-mobx'];

const root = fileURLToPath(new URL('../../..', import.meta.url));

const run = (args: string[]): void => {
  const result = spawnSync('pnpm', args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`lit2-compat: pnpm ${args.join(' ')} failed`);
  }
};

const yamlPath = join(root, 'pnpm-workspace.yaml');
const workspaceYaml = readFileSync(yamlPath, 'utf8');
const range = compatRange(workspaceYaml);
const peerRange = assertPeerRangeCoversMajor2(workspaceYaml);
writeFileSync(yamlPath, applyCompatRange(workspaceYaml, range));

run(['install', '--no-frozen-lockfile']);

const installed = (
  JSON.parse(
    readFileSync(
      join(root, 'packages/lit-ui-router/node_modules/lit/package.json'),
      'utf8',
    ),
  ) as { version: string }
).version;
if (!installed.startsWith('2.')) {
  throw new Error(
    `lit2-compat: resolved lit ${installed}, expected the ${range} pin`,
  );
}
console.log(`lit2-compat: lit ${installed} (pin ${range}, peer ${peerRange})`);

for (const pkg of LIT_PACKAGES) {
  run(['--filter', pkg, 'run', 'test']);
  run(['--filter', pkg, 'exec', 'tsc', '-p', 'tsconfig.src.json', '--noEmit']);
}
