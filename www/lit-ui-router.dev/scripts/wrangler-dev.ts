#!/usr/bin/env node
import { join } from 'node:path';

import { binPath, execve } from '@tools/shared/execve.ts';
import * as v from 'valibot';
import wrangler from 'wrangler/package.json' with { type: 'json' };

import { resolveWwwDevPort } from '../dev-port.ts';

// `wrangler dev` on the www dev-server port. A launcher rather than a shell
// interpolation in package.json: the port's default lives in code, and shell
// cannot supply one for an unset var.

const BIN = binPath(wrangler, import.meta.resolve('wrangler/package.json'));

const WorkerBuild = v.picklist(['development', 'production']);

/**
 * The `WRANGLER_BUILD_CONDITIONS` to serve with: an explicit value wins, else
 * `WWW_WORKER_BUILD` picks the development or production builds of the
 * worker's dependencies (default development). Production leaves it unset, as
 * `wrangler deploy` does. Throws for an unknown `WWW_WORKER_BUILD`.
 */
export function wranglerBuildConditions(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const raw = env.WWW_WORKER_BUILD?.trim() || 'development';
  const build = v.safeParse(WorkerBuild, raw);

  if (!build.success)
    throw new Error(
      `WWW_WORKER_BUILD must be development or production, not ${raw}`,
    );

  if (env.WRANGLER_BUILD_CONDITIONS !== undefined)
    return env.WRANGLER_BUILD_CONDITIONS;

  // wrangler's own default list, plus `development`
  return build.output === 'development'
    ? 'development,workerd,worker,browser'
    : undefined;
}

const main = (): void => {
  const args = process.argv.slice(2);

  // A later --port wins in yargs, so it would move the server without moving the
  // readiness URLs built from the same resolver. --inspector-port is unaffected.
  if (args.some((arg) => arg === '--port' || arg.startsWith('--port='))) {
    console.error('wrangler-dev.ts: set WWW_DEV_PORT, not --port');
    process.exitCode = 2;

    return;
  }

  // wrangler reads wrangler.jsonc and .env from cwd, so any caller gets this package's
  process.chdir(join(import.meta.dirname, '..'));

  // here, not in `.env`, which wrangler also loads for deploy
  const conditions = wranglerBuildConditions();

  if (conditions !== undefined)
    process.env.WRANGLER_BUILD_CONDITIONS = conditions;

  // argv[0] is ours to set; env defaults to process.env
  execve('wrangler-dev', process.execPath, [
    process.execPath,
    BIN,
    'dev',
    '--port',
    String(resolveWwwDevPort()),
    ...args,
  ]);
};

if (import.meta.main) main();
