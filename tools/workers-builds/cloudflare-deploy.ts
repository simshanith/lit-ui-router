#!/usr/bin/env node
// The Workers Builds deploy command, in the repo like the build command: the
// dashboard holds one value for every branch, so wrangler details live here.
// Runs after cloudflare-build.sh (bash: it runs before the install) — see DEPLOY.md.

// Trigger names, not git refs; the trigger test imports this map.
export const DEPLOY_MODES = {
  main: ['wrangler', 'deploy'],
  branch: ['wrangler', 'versions', 'upload'],
} as const;

export type DeployMode = keyof typeof DEPLOY_MODES;

const isDeployMode = (value: string | undefined): value is DeployMode =>
  value !== undefined && Object.hasOwn(DEPLOY_MODES, value);

if (import.meta.main) {
  const mode = process.argv[2];
  if (!isDeployMode(mode)) {
    console.error(
      `usage: cloudflare-deploy.ts <${Object.keys(DEPLOY_MODES).join('|')}>`,
    );
    process.exit(2);
  }

  // POSIX-only, hence optional in @types/node; replaces the process like bash `exec`.
  if (!process.execve) {
    console.error(
      'cloudflare-deploy: needs process.execve (POSIX-only, node >=24)',
    );
    process.exit(1);
  }

  // execve does not search PATH; env does, and keeps the `npx wrangler` invocation.
  process.execve(
    '/usr/bin/env',
    ['env', 'npx', ...DEPLOY_MODES[mode]],
    process.env,
  );
}
