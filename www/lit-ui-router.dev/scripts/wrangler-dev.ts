import { spawn } from 'node:child_process';

import { resolveWwwDevPort } from '../dev-port.ts';

// `wrangler dev` on the www dev-server port. A launcher rather than a shell
// interpolation in package.json: shell can fail on an unset var but cannot
// supply a default, so every non-mise entry point was a cliff (#697).
const args = process.argv.slice(2);

// A later --port wins in yargs, so it would move the server without moving the
// readiness URLs built from the same resolver. --inspector-port is unaffected.
if (args.some((arg) => arg === '--port' || arg.startsWith('--port='))) {
  console.error('wrangler-dev.ts: set WWW_DEV_PORT, not --port');
  process.exit(2);
}

const child = spawn(
  'wrangler',
  ['dev', '--port', String(resolveWwwDevPort()), ...args],
  { stdio: 'inherit' },
);
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
