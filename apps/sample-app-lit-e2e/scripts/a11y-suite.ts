import { spawn } from 'node:child_process';

import { resolveE2eTarget } from './base-url.ts';

// The axe suite: check-a11y against the origin the Cypress suites share. A
// launcher for the reason cypress-suite.ts is one: the origin's default lives in code.

const child = spawn(
  'check-a11y',
  [resolveE2eTarget().origin, ...process.argv.slice(2)],
  { stdio: 'inherit' },
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
