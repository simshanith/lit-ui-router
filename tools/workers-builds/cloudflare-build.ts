#!/usr/bin/env node
// The Cloudflare Workers Builds build command, in the repo like the deploy
// command: the dashboard holds one value for every branch, so the steps live
// here (see www/DEPLOY.md).
//
// Runs from the repo root under SKIP_DEPENDENCY_INSTALL=1 — Cloudflare's own
// install step is off, so installing is this script's job. That is before
// `pnpm install`, so nothing here may import a workspace package by name:
// node_modules does not exist yet. The one non-builtin import is relative and
// resolves without it — @tools/bootstrap is a zero-dependency package, so
// resolution never consults node_modules.
//
// The image has node and npm; this script installs pnpm; everything past that
// comes from `pnpm install`. It has no mise, so none of the repo's mise-managed
// tools (taplo, shellcheck, rumdl, actionlint, zizmor) exists here — keep them
// out of anything the turbo target below reaches. Today that closure runs 21
// commands, all workspace binaries.
import { execFileSync } from 'node:child_process';

import { requireManifest } from '../bootstrap/src/manifest.ts';

/** A command and its argv tail, run from the repo root. */
export type Step = readonly [command: string, args: readonly string[]];

/**
 * The pnpm to bootstrap, derived from `packageManager` rather than pinned
 * again: pnpm >=11.10 self-swaps to that value anyway, so a second pin can
 * only ever be wrong, and it is wrong silently — a stale bootstrap still
 * deploys green. Deriving is also what makes this file's per-branch
 * divergence free: a branch that changes the package manager gets the right
 * bootstrap with no edit here.
 */
export const pnpmSpec = (root: string): string => {
  const packageManager = requireManifest(root).packageManager;
  // `pnpm@<version>+sha512.<hash>`; npm has no use for corepack's hash
  const spec = packageManager?.split('+')[0];
  if (!spec?.startsWith('pnpm@')) {
    throw new Error(
      `cloudflare-build: packageManager is not a pnpm pin: ${packageManager}`,
    );
  }
  return spec;
};

/**
 * Exported so the trigger test can assert the frozen install is still here —
 * SKIP_DEPENDENCY_INSTALL=1 is only safe while this script installs, and the
 * steps are read rather than grepped out of this file's source.
 */
export const buildSteps = (root: string, npmBin: string): readonly Step[] => [
  // npm refuses to overwrite a file it does not own (EEXIST), and its global
  // bin is the same node bin dir corepack's shims sit in, so clear them first
  // rather than reaching for --force.
  ['rm', ['-f', `${npmBin}/pnpm`, `${npmBin}/pnpx`]],

  // turbo spawns every package script through the `pnpm` on PATH, which in the
  // build image is corepack's shim, so the shim is replaced rather than
  // bypassed: npx would cover only the commands named here.
  //
  // --allow-scripts is what makes this a pnpm 12 rather than the wrapper's
  // placeholder bin: the real binary is unpacked by a preinstall hook, which
  // npm 12 blocks by default. npm 11 ignores the unknown flag and runs the
  // hook anyway, so one command covers both.
  ['npm', ['install', '--global', '--allow-scripts=pnpm', pnpmSpec(root)]],

  ['pnpm', ['install', '--frozen-lockfile']],

  // turbo is a workspace devDependency, not on PATH.
  ['npx', ['turbo', '@www/lit-ui-router.dev#build']],
];

const main = (): void => {
  // Ask npm where it will write: asdf puts its own shims on PATH, so resolving
  // `node` finds ~/.asdf/shims, not the installs/nodejs/<version>/bin that the
  // corepack shims and the global install both land in.
  const npmPrefix = execFileSync('npm', ['prefix', '-g'], {
    encoding: 'utf8',
  }).trim();

  for (const [command, args] of buildSteps(process.cwd(), `${npmPrefix}/bin`)) {
    execFileSync(command, [...args], { stdio: 'inherit' });
  }
};

if (import.meta.main) main();
