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
    name: '@lit-labs/ssr',
    why: 'catalogs.peerFloor pins @lit-labs/ssr-floor to 4.0.0, the ssr peer floor check:bundle bundles against',
  },
  {
    name: '@lit-labs/ssr-client',
    why: 'catalogs.peerFloor pins @lit-labs/ssr-client-floor to 1.1.0, the ssr peer floor check:bundle bundles against',
  },
  {
    name: '@uirouter/core',
    why: 'catalogs.peerFloor pins @uirouter/core-floor to 6.0.8, every package peer floor check:bundle bundles against',
  },
  {
    name: 'effect',
    why: 'the effect-3 alias (catalogs.effect3-compat) runs test:effect3-compat beside the effect 4 line',
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
    why: 'peerFloorEffect and peerFloorMobx pin lit-ui-router-floor to 1.15.0 and peerFloorSsr to 1.16.1, each adapter its own published floor',
  },
  {
    name: 'lit',
    why: 'the lit-2 alias (catalogs.lit2-compat) runs test:lit2-compat beside the lit 3 line',
  },
  {
    name: 'mobx',
    why: 'the mobx-6 alias (catalogs.mobx6-compat) runs test:mobx6-compat beside the mobx 7 line',
  },
  {
    name: 'typescript',
    why: 'dts-backtest and the typescript6/7 catalogs alias one compiler per line; attw, the cem analyzer and web-component-analyzer pin their own',
  },
];

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
  process.exit(1);
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
  process.exit(1);
}

console.log(
  `${CHECK}: ${controlled.size} controlled packages resolve to one version each (${allowed.length} allowlisted splits)`,
);
