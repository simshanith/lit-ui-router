import { spawn } from 'node:child_process';

import { resolveE2eTarget } from './base-url.ts';

// The domain-search frame-0 harness against the origin the Cypress suites share, as a11y-suite.ts launches check-a11y.

const child = spawn('measure-domain-search', [resolveE2eTarget().origin], {
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
