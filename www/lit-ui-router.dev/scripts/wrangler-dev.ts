import { binPath, execve } from '@tools/shared/execve.ts';
import wrangler from 'wrangler/package.json' with { type: 'json' };

import { resolveWwwDevPort } from '../dev-port.ts';

// `wrangler dev` on the www dev-server port. A launcher rather than a shell
// interpolation in package.json: the port's default lives in code, and shell
// cannot supply one for an unset var.

// exec does no PATH search, so resolve the bin the way npm links it
const BIN = binPath(wrangler, import.meta.resolve('wrangler/package.json'));

const args = process.argv.slice(2);

// A later --port wins in yargs, so it would move the server without moving the
// readiness URLs built from the same resolver. --inspector-port is unaffected.
if (args.some((arg) => arg === '--port' || arg.startsWith('--port='))) {
  console.error('wrangler-dev.ts: set WWW_DEV_PORT, not --port');
  process.exit(2);
}

// argv[0] is ours to set; env defaults to process.env
execve('wrangler-dev', process.execPath, [
  process.execPath,
  BIN,
  'dev',
  '--port',
  String(resolveWwwDevPort()),
  ...args,
]);
