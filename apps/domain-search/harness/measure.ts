#!/usr/bin/env node
// Runs the #1698 harness against this repo's page or, read-only, vercel.com/domains.
// Usage: measure-domain-search <origin> | --vercel   (origin: the docs worker, e.g. http://localhost:8787)

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FRAME_ZERO = fileURLToPath(
  new URL('./frame-zero.e2e.ts', import.meta.url),
);

// Vercel's page gets the frame-0 checks only; the boot paths measure this repo's page.
const SPECS = {
  vercel: [FRAME_ZERO],
  ours: [
    FRAME_ZERO,
    fileURLToPath(new URL('./boot-paths.e2e.ts', import.meta.url)),
  ],
};

const USAGE = 'usage: measure-domain-search <origin> | --vercel';

const main = (): void => {
  const [arg, ...rest] = process.argv.slice(2);

  if (!arg || rest.length > 0) {
    console.error(USAGE);
    process.exitCode = 2;

    return;
  }

  const origin = arg === '--vercel' ? 'vercel' : arg;

  if (origin !== 'vercel' && !/^https?:\/\//.test(origin)) {
    console.error(`${USAGE}\nnot an http(s) origin: ${origin}`);
    process.exitCode = 2;

    return;
  }

  const child = spawn(
    process.execPath,
    [
      '--test',
      '--test-reporter=spec',
      // one throttled Chrome at a time, so no spec measures another's load
      '--test-concurrency=1',
      ...(origin === 'vercel' ? SPECS.vercel : SPECS.ours),
    ],
    {
      stdio: 'inherit',
      env: { ...process.env, DOMAIN_SEARCH_ORIGIN: origin },
    },
  );

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exitCode = code ?? 1;
  });
};

if (import.meta.main) main();
