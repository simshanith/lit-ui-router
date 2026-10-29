// `pnpm dedupe --check` only fails when re-resolving would shrink the tree,
// so an exact pin beside a newer caret — no version satisfies both — leaves
// two copies of a package the workspace chooses the version of. Fail on any
// such name that resolves to more than one version, less the splits below.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import {
  auditSplits,
  controlledNames,
  formatSplit,
  lockVersions,
  parseLock,
  type SplitAllowance,
} from './single-version.core.ts';

const CHECK = 'check-single-version';

// Splits the workspace asks for. A row that stops splitting fails as stale.
const ALLOWED: SplitAllowance[] = [
  {
    name: '@lit-labs/ssr-client',
    why: 'catalogs.peerFloorSsr pins @lit-labs/ssr-client-floor to 1.1.7, the ssr peer floor check:bundle bundles against',
  },
  {
    name: '@oxc-project/runtime',
    why: 'catalogs.oxc-compat pins @oxc-project/runtime-floor to 0.50.0, the published dependency floor check:bundle bundles dist against',
  },
  {
    name: '@uirouter/core',
    why: 'catalogs.peerFloor pins @uirouter/core-floor to 6.0.8, every package peer floor check:bundle bundles against',
  },
  {
    name: 'effect',
    why: 'the effect-3 alias (catalogs.effect3-compat) runs test:effect3-compat beside the effect 4 line, and catalogs.peerFloor pins effect-floor to 3.22.0, the effect peer floor check:bundle bundles against',
  },
  {
    name: 'eslint',
    why: 'catalogs.peerFloorEslintPlugin pins eslint-floor to 9.0.0, the plugin peer floor, beside the 10.x linter',
  },
  {
    name: 'hono',
    why: 'catalogs.peerFloor pins hono-floor to 4.0.0, the ui-router-server peer floor check:bundle bundles against',
  },
  {
    name: 'lit-ui-router',
    why: 'peerFloorEffect, peerFloorMobx and peerFloorSignals pin lit-ui-router-floor to 1.15.0 and peerFloorSsr to 1.16.1, each adapter its own published floor',
  },
  {
    name: 'lit',
    why: 'the lit-2 alias (catalogs.lit2-compat) runs test:lit2-compat beside the lit 3 line',
  },
  {
    name: 'mobx',
    why: 'the mobx-6 alias (catalogs.mobx6-compat) runs test:mobx6-compat beside the mobx 7 line, and catalogs.peerFloor pins mobx-floor to 6.0.0, the mobx peer floor check:bundle bundles against',
  },
  {
    name: 'parse5',
    why: "@tools/lit-template-check takes eslint-plugin-lit's 8.x line; lit-analyzer, eslint-plugin-lit-a11y (and its dom5) and @lit-labs/ssr pin their own",
  },
  {
    name: 'signal-polyfill',
    why: 'catalogs.peerFloor pins signal-polyfill-floor to 0.2.0, the ui-router-signals peer floor check:bundle bundles against',
  },
  {
    name: 'typescript',
    why: 'dts-backtest and the typescript6/7 catalogs alias one compiler per line; attw, the cem analyzer and web-component-analyzer pin their own',
  },
  {
    name: 'ui-router-server',
    why: 'catalogs.peerFloorSsr pins ui-router-server-floor to 0.2.0 and ui-router-server-0.3-floor to 0.3.0, one floor per lower leg of the ssr peer range',
  },
];

const main = (): void => {
  const lock = parseLock(
    readFileSync(join(workspaceRoot, 'pnpm-lock.yaml'), 'utf8'),
  );

  const controlled = controlledNames(lock);

  const { failures, allowed, stale } = auditSplits(
    lockVersions(lock),
    controlled,
    ALLOWED,
  );

  if (controlled.size === 0) {
    // an empty scope would pass every assertion below; that's a parse bug
    console.error(
      `${CHECK}: pnpm-lock.yaml names no catalog or direct dependency`,
    );
    process.exitCode = 1;

    return;
  }

  for (const failure of failures) {
    console.error(`${CHECK}: ${formatSplit(failure)}`);
  }

  for (const name of stale) {
    console.error(
      `${CHECK}: ${name} is allowlisted but resolves to one version now; drop the row`,
    );
  }

  if (failures.length > 0 || stale.length > 0) {
    console.error(
      `${CHECK}: ${failures.length} split, ${stale.length} stale; override the pin in pnpm-workspace.yaml or allowlist the split with a reason`,
    );
    process.exitCode = 1;

    return;
  }

  console.log(
    `${CHECK}: ${controlled.size} controlled packages resolve to one version each (${allowed.length} allowlisted splits)`,
  );
};

if (import.meta.main) main();
