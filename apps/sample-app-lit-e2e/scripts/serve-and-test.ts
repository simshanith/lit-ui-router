import { resolveWwwDevPort } from '@www/lit-ui-router.dev/dev-port.ts';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// start-server-and-test against the www dev server, with the readiness URLs
// built from the resolved port. A launcher rather than a shell interpolation:
// shell can fail on an unset var but cannot supply one (#697).
//
// A function rather than a CLI: the one caller is run-e2e.ts, which builds the
// `turbo run` from the selected suites and would otherwise have to quote a
// whole command through argv.
//
// exec, not spawn: this file's whole job is to hand the process over, and exec
// does that literally — one pid, so every signal reaches the real thing. A
// child had to be plumbed by hand, and the plumbing only covered signals this
// process itself received: a SIGTERM aimed at the launcher alone (a cancelled
// CI job, a timeout) left start-server-and-test, its dev server and Cypress
// running. stdio survives the exec; nothing else does, and nothing else needs
// to.

// exec does no PATH search, and pnpm's isolated node_modules keeps this
// package's bin out of the root .bin, so name the shim outright. The shim is
// `exec` the rest of the way, so the pid stays ours through it.
const BIN = join(
  dirname(dirname(fileURLToPath(import.meta.url))),
  'node_modules/.bin/start-server-and-test',
);

/**
 * Serve the docs site, wait for every `paths` entry to answer, run `test`, and
 * tear the server down — on failure too. Does not return on success: this
 * process becomes start-server-and-test, which owns the exit status from
 * there on. (Not typed `never` — tsc keys that off the declared type, and
 * `process.execve` is declared optional because it is POSIX-only.)
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

  // optional in the types because execve is POSIX-only. A legible error rather
  // than a spawn fallback kept alive for a platform nothing else here targets.
  if (process.execve === undefined) {
    throw new Error(
      'serve-and-test: process.execve is unavailable (POSIX only)',
    );
  }
  // argv[0] is ours to set; env defaults to process.env.
  process.execve(BIN, [BIN, server, ready, test]);
}
