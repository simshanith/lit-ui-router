#!/usr/bin/env node
// The Workers Builds deploy command, in the repo like the build command: the
// dashboard holds one value for every branch, so wrangler details live here.
// Runs after cloudflare-build.sh (bash: it runs before the install) — see DEPLOY.md.
import { execFileSync } from 'node:child_process';

// The site's wrangler.jsonc sits in the package, not the root, and the deploy
// runs from the root — so every mode names it. It lives here rather than in the
// dashboard: that is what the script indirection is for (see DEPLOY.md).
const SITE_CONFIG = [
  '--config',
  'www/lit-ui-router.dev/wrangler.jsonc',
] as const;

// Trigger names, not git refs; the trigger test imports this map.
export const DEPLOY_MODES = {
  main: ['wrangler', 'deploy', ...SITE_CONFIG],
  branch: ['wrangler', 'versions', 'upload', ...SITE_CONFIG],
} as const;

export type DeployMode = keyof typeof DEPLOY_MODES;

const isDeployMode = (value: string | undefined): value is DeployMode =>
  value !== undefined && Object.hasOwn(DEPLOY_MODES, value);

// execve does not search PATH; the shell resolves the command, and throws if it can't.
const commandPath = (name: string): string =>
  execFileSync('/bin/sh', ['-c', 'command -v "$1"', 'sh', name], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();

// Annotated, not just inferred: never-returning calls only narrow past an
// explicitly typed declaration, which is what lets `mode` narrow below.
const usage: () => never = () => {
  console.error(
    `usage: cloudflare-deploy.ts <${Object.keys(DEPLOY_MODES).join('|')}>`,
  );
  process.exit(2);
};

const main = ([mode, ...extra]: string[]): void => {
  if (extra.length > 0 || !isDeployMode(mode)) usage();

  // POSIX-only, hence optional in @types/node; replaces the process like bash `exec`.
  if (!process.execve) {
    throw new Error(
      'cloudflare-deploy: needs process.execve (POSIX-only, node >=24)',
    );
  }

  process.execve(
    commandPath('npx'),
    ['npx', ...DEPLOY_MODES[mode]],
    process.env,
  );
};

if (import.meta.main) main(process.argv.slice(2));
