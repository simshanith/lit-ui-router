import { join } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { loadWorkspace } from '@tools/shared/workspace.ts';

import { serveAndTest } from './serve-and-test.ts';
import { PREFIX, defaultSuites, suites } from './suites.ts';

// Suite selection for the `//:test_e2e` umbrella: turns bare suite names into
// the `turbo run` that start-server-and-test wraps in a dev server.
//
// Usage: run-e2e.ts [suite]...   (no names selects defaultSuites; see suites.ts)

const main = async (): Promise<void> => {
  const asked = [...new Set(process.argv.slice(2))];

  const unknown = asked.filter((name) => !suites.includes(name));

  if (unknown.length > 0) {
    console.error(
      `run-e2e: no such suite: ${unknown.join(', ')}\n  available: ${suites.join(', ')}`,
    );
    process.exitCode = 1;

    return;
  }

  const selected = asked.length > 0 ? asked.sort() : defaultSuites;

  // --continue=dependencies-successful: one failing suite still lets the rest
  // report and turbo still exits non-zero, while a failed build cancels them all.
  // Bare --continue means `always`, which runs suites whose build failed.
  const test = [
    'turbo run',
    ...selected.map((suite) => `${PREFIX}${suite}`),
    '--continue=dependencies-successful --ui=stream --log-order=stream --summarize --log-file',
    `--output-logs=${process.env.TURBO_OUTPUT_LOGS ?? 'full'}`,
  ].join(' ');

  // not the serve mise task: its build_www depends would re-run under nested mise.
  // Not `pnpm --filter … run` either: start-server-and-test stops the server with
  // SIGINT, which pnpm reports as a failed recursive run on every clean teardown.
  const WWW = '@www/lit-ui-router.dev';

  const { members } = await loadWorkspace(workspaceRoot);

  const www = members.find((member) => member.name === WWW);

  if (!www) {
    console.error(`run-e2e: no workspace member ${WWW}`);
    process.exitCode = 1;

    return;
  }

  const server = `node ${JSON.stringify(join(workspaceRoot, www.dir, 'scripts/wrangler-dev.ts'))}`;

  // every app is mounted whichever suites run
  serveAndTest(server, test, [
    'app/',
    'app-mobx/',
    'app-effect/',
    'app-signals/',
  ]);
};

if (import.meta.main) await main();
