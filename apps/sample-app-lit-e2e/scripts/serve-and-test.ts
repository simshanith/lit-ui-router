import { resolveWwwDevPort } from '@www/lit-ui-router.dev/dev-port.ts';
import { spawn } from 'node:child_process';

// start-server-and-test against the www dev server, with the readiness URLs
// built from the resolved port. A launcher rather than a shell interpolation:
// shell can fail on an unset var but cannot supply one (#697).
//
// `server` and `test` pass straight through, so either can be a package script
// (from this package) or a whole command — the //:test_e2e mise task runs from
// the repo root, where no script name of this package resolves.
// Usage: serve-and-test.ts <server> <test> <ready path>...
const [server, test, ...paths] = process.argv.slice(2);
if (server === undefined || test === undefined || paths.length === 0) {
  console.error('usage: serve-and-test.ts <server> <test> <ready-path>...');
  process.exit(1);
}

const port = resolveWwwDevPort();
const ready = paths.map((path) => `http://localhost:${port}/${path}`).join('|');

const child = spawn('start-server-and-test', [server, ready, test], {
  stdio: 'inherit',
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
