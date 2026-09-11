import { binPath, execve } from '@tools/shared/execve.ts';
import { resolveWwwDevPort } from '@www/lit-ui-router.dev/dev-port.ts';
import pkg from 'start-server-and-test/package.json' with { type: 'json' };

// exec does no PATH search, so resolve the bin the way npm links it. The import
// above is also what keeps the dependency visible to knip.
const BIN = binPath(
  pkg,
  import.meta.resolve('start-server-and-test/package.json'),
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
): never {
  const port = resolveWwwDevPort();
  const ready = paths
    .map((path) => `http://localhost:${port}/${path}`)
    .join('|');

  // argv[0] is ours to set; env defaults to process.env
  execve('serve-and-test', process.execPath, [
    process.execPath,
    BIN,
    server,
    ready,
    test,
  ]);
}
