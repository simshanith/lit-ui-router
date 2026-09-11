import { resolveWwwDevPort } from '@www/lit-ui-router.dev/dev-port.ts';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// exec does no PATH search, and pnpm's isolated node_modules keeps this bin out
// of the root .bin, so name the shim outright. The shim execs the rest of the
// way, so the pid stays ours through it.
const BIN = join(
  dirname(dirname(fileURLToPath(import.meta.url))),
  'node_modules/.bin/start-server-and-test',
);

/**
 * Serve the docs site, wait for every `paths` entry to answer, run `test`, and
 * tear the server down — on failure too. Does not return: this process becomes
 * start-server-and-test, which owns the exit status.
 */
export function serveAndTest(
  server: string,
  test: string,
  paths: readonly string[],
): void {
  const port = resolveWwwDevPort();
  const ready = paths
    .map((path) => `http://localhost:${port}/${path}`)
    .join('|');

  // execve is POSIX-only, hence optional in the types
  if (process.execve === undefined) {
    throw new Error(
      'serve-and-test: process.execve is unavailable (POSIX only)',
    );
  }
  // argv[0] is ours to set; env defaults to process.env
  process.execve(BIN, [BIN, server, ready, test]);
}
