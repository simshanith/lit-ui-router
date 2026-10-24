#!/usr/bin/env node
// The Workers Builds deploy command, in the repo like the build command: the
// dashboard holds one value for every branch, so wrangler and cf details live here.
// Runs after cloudflare-build.sh (bash: it runs before the install) — see www/DEPLOY.md.
//
// Usage: cloudflare-deploy.ts <main|branch|preview> [site] — `site` as in cloudflare-build.ts.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

import { type Site, siteFromArgs } from './cloudflare-build.ts';
import {
  CF_CONFIG,
  migratedDatabasesFromConfig,
  parseJsonc,
} from './workers-builds-triggers.core.ts';

// Trigger names, not git refs: `branch` for a legacy preview trigger, `preview`
// for a Worker switched to Workers Previews. Each names the site's wrangler.jsonc
// with --config: the deploy runs from the root and the config sits in the package.
export const DEPLOY_MODES = {
  main: ['wrangler', 'deploy'],
  branch: ['wrangler', 'versions', 'upload'],
  preview: ['wrangler', 'preview'],
} as const;

// The same triggers for a site with a cloudflare.config.ts: cf takes no config path, so these run in the package.
export const CF_DEPLOY_MODES = {
  main: ['cf', 'deploy'],
  branch: ['cf', 'workers', 'versions', 'create'],
  preview: ['cf', 'previews', 'deploy'],
} as const satisfies Record<keyof typeof DEPLOY_MODES, readonly string[]>;

export type DeployMode = keyof typeof DEPLOY_MODES;

const isDeployMode = (value: string | undefined): value is DeployMode =>
  value !== undefined && Object.hasOwn(DEPLOY_MODES, value);

/** A deploy's `npx` argv tails and the repo-relative dir they run in: the migrations run first, in order. */
export type DeployCommands = {
  readonly cwd: string;
  readonly migrations: readonly (readonly string[])[];
  readonly deploy: readonly string[];
};

/** Exported so the trigger test checks each site's invocation by importing it. */
export const deployCommands = (
  root: string,
  mode: DeployMode,
  site: Site,
): DeployCommands => {
  // cloudflare.config.ts has no D1 migrations_dir, so a cf site migrates nothing.
  if (existsSync(join(root, site.dir, CF_CONFIG))) {
    return { cwd: site.dir, migrations: [], deploy: CF_DEPLOY_MODES[mode] };
  }

  const config = ['--config', `${site.dir}/wrangler.jsonc`] as const;
  const deploy = [...DEPLOY_MODES[mode], ...config];

  // A branch upload binds production's databases and a Preview only its
  // `previews` block's, so only production migrates.
  if (mode !== 'main') return { cwd: '.', migrations: [], deploy };

  const databases = migratedDatabasesFromConfig(
    parseJsonc(readFileSync(join(root, site.dir, 'wrangler.jsonc'), 'utf8')),
  );

  return {
    cwd: '.',
    migrations: databases.map((database) => [
      'wrangler',
      'd1',
      'migrations',
      'apply',
      database,
      '--remote',
      ...config,
    ]),
    deploy,
  };
};

// execve does not search PATH; the shell resolves the command, and throws if it can't.
const commandPath = (name: string): string =>
  execFileSync('/bin/sh', ['-c', 'command -v "$1"', 'sh', name], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();

const USAGE = `usage: cloudflare-deploy.ts <${Object.keys(DEPLOY_MODES).join('|')}> [site]`;

const main = ([mode, ...rest]: string[]): void => {
  if (!isDeployMode(mode)) {
    console.error(USAGE);
    process.exitCode = 2;

    return;
  }

  const resolved = siteFromArgs(workspaceRoot, rest);

  if (!resolved.ok) {
    console.error(`cloudflare-deploy: ${resolved.error}\n${USAGE}`);
    process.exitCode = 2;

    return;
  }

  // POSIX-only, hence optional in @types/node; replaces the process like bash `exec`.
  if (!process.execve) {
    throw new Error(
      'cloudflare-deploy: needs process.execve (POSIX-only, node >=24)',
    );
  }

  const { cwd, migrations, deploy } = deployCommands(
    workspaceRoot,
    mode,
    resolved.site,
  );

  const npx = commandPath('npx');

  // execve keeps the cwd, so the migrations and the deploy share it.
  process.chdir(join(workspaceRoot, cwd));

  // wrangler skips its confirmation prompt under WORKERS_CI or without a TTY;
  // a failed migration throws here, so the deploy never runs.
  for (const migration of migrations) {
    execFileSync(npx, [...migration], { stdio: 'inherit' });
  }

  process.execve(npx, ['npx', ...deploy], process.env);
};

if (import.meta.main) main(process.argv.slice(2));
