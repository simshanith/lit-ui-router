import { resolveWwwDevPort } from '@www/lit-ui-router.dev/dev-port.ts';
import { spawn } from 'node:child_process';

// The axe suite: check-a11y against the dev server the Cypress suites share. A
// launcher for the reason cypress-suite.ts is one: the port's default lives in code.

const child = spawn(
  'check-a11y',
  [`http://localhost:${resolveWwwDevPort()}`, ...process.argv.slice(2)],
  { stdio: 'inherit' },
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
