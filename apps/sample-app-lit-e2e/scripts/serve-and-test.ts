import { binPath, execve } from '@tools/shared/execve.ts';
import pkg from 'start-server-and-test/package.json' with { type: 'json' };

import { e2eUrl, resolveE2eTarget } from './base-url.ts';

const BIN = binPath(
  pkg,
  import.meta.resolve('start-server-and-test/package.json'),
);

/**
 * Serve the docs site, wait for every `paths` entry to answer, run `test`, and
 * tear the server down — on failure too. When E2E_BASE_URL names a site that is
 * already served, run `test` alone. Does not return: this process becomes
 * start-server-and-test or the test command, which owns the exit status.
 */
export function serveAndTest(
  server: string,
  test: string,
  paths: readonly string[],
): never {
  const target = resolveE2eTarget();

  if (target.remote) {
    console.error(`serve-and-test: ${target.origin} is served; no dev server`);

    // the same shell start-server-and-test would run `test` in
    execve('serve-and-test', '/bin/sh', ['sh', '-c', test]);
  }

  const ready = paths.map((path) => e2eUrl(path, target)).join('|');

  // argv[0] is ours to set; env defaults to process.env
  execve('serve-and-test', process.execPath, [
    process.execPath,
    BIN,
    server,
    ready,
    test,
  ]);
}
