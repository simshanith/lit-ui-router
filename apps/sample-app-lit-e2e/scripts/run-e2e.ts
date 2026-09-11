import { requireManifest } from '@tools/bootstrap/manifest.ts';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serveAndTest } from './serve-and-test.ts';

// Suite selection for the `//:test_e2e` umbrella: turns bare suite names into
// the `turbo run` that start-server-and-test wraps in a dev server.
//
// The set is DERIVED from this package's own `test:e2e:*` scripts, never
// listed. A list in .config/mise/config.toml was an edit every new suite had to
// remember, and forgetting it drops that suite from the PR gate silently while
// the run still reports green — the failure mode the split was meant to end.
//
// Usage: run-e2e.ts [suite]...   (no names selects every suite)

const PREFIX = 'test:e2e:';
const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const scripts = requireManifest(packageDir).scripts ?? {};
// Sorted so the command string is stable: it is what the run summary prints as
// the run's identity, and an unstable one reads as a different run each time.
const suites = Object.keys(scripts)
  .filter((name) => name.startsWith(PREFIX))
  .map((name) => name.slice(PREFIX.length))
  .sort();

const asked = [...new Set(process.argv.slice(2))];
const unknown = asked.filter((name) => !suites.includes(name));
if (unknown.length > 0) {
  console.error(
    `run-e2e: no such suite: ${unknown.join(', ')}\n  available: ${suites.join(', ')}`,
  );
  process.exit(1);
}
const selected = asked.length > 0 ? asked.sort() : suites;

// --continue=dependencies-successful: one failing suite still lets the rest
// report, and turbo still exits non-zero; a failed build still cancels them all
// rather than turning one error into N Cypress failures. The full reasoning is
// in .config/mise/config.toml beside the task that calls this.
const test = [
  'turbo run',
  ...selected.map((suite) => `${PREFIX}${suite}`),
  '--continue=dependencies-successful --ui=stream --log-order=stream --summarize',
].join(' ');

// Readiness paths are a property of the server, not of the selection: both apps
// are mounted whichever suites run, and waiting for both costs one extra probe
// against a server that is already up.
serveAndTest('pnpm --filter sample-app-lit-e2e run docs:start-server', test, [
  'app/',
  'app-mobx/',
]);
