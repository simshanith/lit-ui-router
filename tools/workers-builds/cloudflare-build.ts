#!/usr/bin/env node
// The Cloudflare Workers Builds build command, in the repo like the deploy
// command: the dashboard holds one value for every branch, so the steps live
// here (see www/DEPLOY.md).
//
// Runs under SKIP_DEPENDENCY_INSTALL=1 — Cloudflare's own install step is off,
// so installing is this script's job. That is before `pnpm install`, so no
// runtime import here may name a workspace package: node_modules does not exist
// yet. The one non-builtin runtime import is relative and resolves without it —
// @tools/bootstrap is a zero-dependency package, so resolution never consults
// node_modules. Type imports are erased before execution, so they name the
// package instead.
//
// The image has node and npm; this script installs pnpm; everything past that
// comes from `pnpm install`. It has no mise, so none of the repo's mise-managed
// tools (taplo, shellcheck, rumdl, actionlint, zizmor) exists here — keep them
// out of anything the turbo target below reaches.
//
// Usage: cloudflare-build.ts [site] — `site` is a www/ directory name; omitted,
// the docs site, which is what the live dashboard command passes.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import type { PackageManifest } from '@tools/bootstrap/types.ts';
import { readManifest, requireManifest } from '../bootstrap/src/manifest.ts';
import { workspaceRoot } from '../bootstrap/src/root.ts';

// Pins the relative import to the package's exported type, so the workspace
// dependency is what typecheck resolves rather than a name nothing reads.
requireManifest satisfies (dir: string) => PackageManifest;

/** A command and its argv tail, run from the repo root. */
export type Step = readonly [command: string, args: readonly string[]];

/**
 * The site a bare command builds and deploys: the dashboard commands that
 * predate the argument pass none, and every open branch's preview runs them.
 */
export const DEFAULT_SITE = 'lit-ui-router.dev';

/** A deployed Worker app: `www/<key>`, published to the workspace as `@www/<key>`. */
export type Site = {
  readonly key: string;
  readonly dir: string;
  readonly packageName: string;
};

/** A site resolved from a key or argv, or why it could not be. */
export type SiteResult =
  | { readonly ok: true; readonly site: Site }
  | { readonly ok: false; readonly error: string };

/**
 * Resolves a site key to its package. The key becomes a path, so only a
 * domain-shaped name is accepted: nothing can climb out of www/.
 */
export const resolveSite = (root: string, key: string): SiteResult => {
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(key)) {
    return {
      ok: false,
      error: `site is not a www/ domain name: ${JSON.stringify(key)}`,
    };
  }

  const dir = `www/${key}`;
  const manifest = readManifest(join(root, dir));

  if (manifest === undefined) {
    return {
      ok: false,
      error: `unknown site ${key}: no package.json in ${dir}`,
    };
  }

  const packageName = `@www/${key}`;

  if (manifest.name !== packageName) {
    return {
      ok: false,
      error: `${dir}/package.json is named ${JSON.stringify(manifest.name)}, not ${packageName}`,
    };
  }

  return { ok: true, site: { key, dir, packageName } };
};

/** The optional `[site]` both Workers Builds commands end with; anything after it fails. */
export const siteFromArgs = (
  root: string,
  [key = DEFAULT_SITE, ...extra]: readonly string[],
): SiteResult => {
  if (extra.length > 0) {
    return {
      ok: false,
      error: `unexpected argument(s) after the site: ${extra.join(' ')}`,
    };
  }

  return resolveSite(root, key);
};

/**
 * The pnpm to install, derived from `packageManager` rather than pinned
 * again: pnpm does not swap versions itself (`pmOnFail: ignore`), so this is
 * the version that runs, and a second pin could drift silently — a stale
 * pnpm still deploys green. Deriving is also what makes this file's per-branch
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
export const buildSteps = (
  root: string,
  npmBin: string,
  site: Site,
): readonly Step[] => [
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

  // turbo is a workspace devDependency, not on PATH. `build` is defined at the
  // root, so a site with no build script (wrangler bundles it at deploy) is a
  // green no-op beyond its dependencies' builds.
  ['npx', ['turbo', `${site.packageName}#build`]],
];

const main = (argv: readonly string[]): void => {
  const resolved = siteFromArgs(workspaceRoot, argv);

  if (!resolved.ok) {
    console.error(
      `cloudflare-build: ${resolved.error}\nusage: cloudflare-build.ts [site]`,
    );
    process.exitCode = 2;

    return;
  }

  // Ask npm where it will write: asdf puts its own shims on PATH, so resolving
  // `node` finds ~/.asdf/shims, not the installs/nodejs/<version>/bin that the
  // corepack shims and the global install both land in.
  const npmPrefix = execFileSync('npm', ['prefix', '-g'], {
    encoding: 'utf8',
  }).trim();

  // The root is derived, not inherited: turbo resolves its plan from the cwd it
  // is spawned in, and a narrowed plan is silently green rather than an error —
  // a run from a package builds that package's tasks and reports success.
  for (const [command, args] of buildSteps(
    workspaceRoot,
    `${npmPrefix}/bin`,
    resolved.site,
  )) {
    execFileSync(command, [...args], { stdio: 'inherit', cwd: workspaceRoot });
  }
};

if (import.meta.main) main(process.argv.slice(2));
