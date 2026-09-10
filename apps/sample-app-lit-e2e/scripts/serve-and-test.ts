import { resolveWwwDevPort } from '@www/lit-ui-router.dev/dev-port.ts';
import { spawn } from 'node:child_process';

// start-server-and-test against the www dev server, with the readiness URLs
// built from the resolved port. A launcher rather than a shell interpolation:
// shell can fail on an unset var but cannot supply one (#697).
//
// A function rather than a CLI: the one caller is run-e2e.ts, which builds the
// `turbo run` from the selected suites and would otherwise have to quote a
// whole command through argv.

/**
 * Serve the docs site, wait for every `paths` entry to answer, run `test`, and
 * tear the server down — on failure too. Resolves to the test command's exit
 * code; a signal is re-raised on this process instead.
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

  const child = spawn('start-server-and-test', [server, ready, test], {
    stdio: 'inherit',
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exitCode = code ?? 1;
  });
}
