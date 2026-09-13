import manifest from '../package.json' with { type: 'json' };

import { serveAndTest } from './serve-and-test.ts';

// Suite selection for the `//:test_e2e` umbrella: turns bare suite names into
// the `turbo run` that start-server-and-test wraps in a dev server.
//
// Usage: run-e2e.ts [suite]...   (no names selects every suite)

const PREFIX = 'test:e2e:';
// the suite set is this package's own `test:e2e:*` scripts, never a list
const scripts = manifest.scripts;
// sorted to keep the command string stable: it is the run's identity in the
// summary, and an unstable one reads as a different run each time
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
// report and turbo still exits non-zero, while a failed build cancels them all.
// Bare --continue means `always`, which runs suites whose build failed.
const test = [
  'turbo run',
  ...selected.map((suite) => `${PREFIX}${suite}`),
  '--continue=dependencies-successful --ui=stream --log-order=stream --summarize',
].join(' ');

// The launcher through pnpm, not the //www/lit-ui-router.dev:serve task that
// wraps it: the umbrella has already built the site (mise `depends`), and the
// serve task's own build edge under a nested `mise run` would run build_www a
// second time and write a second run summary. pnpm sets the cwd to the package,
// which is where wrangler reads wrangler.jsonc from.
const server = 'pnpm --filter @www/lit-ui-router.dev run wrangler:dev';

// every app is mounted whichever suites run
serveAndTest(server, test, ['app/', 'app-mobx/', 'app-effect/']);
