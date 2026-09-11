import { resolveWwwDevPort } from '@www/lit-ui-router.dev/dev-port.ts';
import { fileURLToPath } from 'node:url';
import pkg from 'start-server-and-test/package.json' with { type: 'json' };

// exec does no PATH search, so resolve the bin the way npm links it
const BIN = fileURLToPath(
  new URL(
    pkg.bin['start-server-and-test'],
    import.meta.resolve('start-server-and-test/package.json'),
  ),
);

// execve is POSIX-only, hence optional; the annotation keeps the call terminal
const execve: (file: string, args: readonly string[]) => never =
  process.execve ??
  (() => {
    throw new Error(
      'serve-and-test: process.execve is unavailable (POSIX only)',
    );
  });

/**
 * Serve the docs site, wait for every `paths` entry to answer, run `test`, and
 * tear the server down — on failure too. Does not return: this process becomes
 * start-server-and-test, which owns the exit status.
 */
export function serveAndTest(
  server: string,
  test: string,
  paths: readonly string[],
): never {
  const port = resolveWwwDevPort();
  const ready = paths
    .map((path) => `http://localhost:${port}/${path}`)
    .join('|');

  // argv[0] is ours to set; env defaults to process.env
  execve(process.execPath, [process.execPath, BIN, server, ready, test]);
}
