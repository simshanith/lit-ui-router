// Each rule's consumer task must order on `<member>#<producerTask>` for every
// member the selector picks, or a new member silently falls out of the graph.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type EdgeRule,
  formatMissing,
  missingEdges,
} from '@tools/shared/graph-edges.core.ts';
import {
  declaredLanes,
  planFailure,
  plannedLanes,
  resolvedTaskDeps,
} from '@tools/shared/turbo.ts';
import {
  loadWorkspace,
  type Member,
  workspaceRoot,
} from '@tools/shared/workspace.ts';

const CHECK = 'check-graph-edges';

const hasScript = (task: string) => (member: Member) =>
  member.manifest?.scripts?.[task] !== undefined;
const publishable = (member: Member) =>
  member.dir !== '<root>' &&
  member.manifest !== undefined &&
  member.manifest.private !== true;

const RULES: (EdgeRule & { select: (member: Member) => boolean })[] = [
  ...['docs#build', 'docs#typecheck', 'docs#docs'].map((consumer) => ({
    consumer,
    producerTask: 'docs:api',
    select: hasScript('docs:api'),
    why: 'every docs:api producer writes into docs/api and docs imports none of them, so add the line to docs/turbo.json',
  })),
  {
    consumer: '@tools/release#pack:all',
    producerTask: 'build',
    select: publishable,
    why: 'check:pack, check:exports and check:published-diff hash packed packages through this edge, so an unlisted publishable package gets stale cached verdicts; add the line to tools/release/turbo.json',
  },
  {
    consumer: '//#lint:templates',
    producerTask: 'build:types',
    select: (member) => publishable(member) && hasScript('build:types')(member),
    why: 'lit-analyzer resolves cross-package imports to dist d.ts, so an unbuilt package hides template errors against its elements; add the line to turbo.json',
  },
];

const { members } = await loadWorkspace(workspaceRoot);

// Every declared lane the ci:* graphs never reach must still plan. turbo
// rejects an invalid edge — `dependsOn` onto a persistent task — for the whole
// run before any task starts, but it validates only the subgraph a run names,
// so a lane CI never invokes is checked nowhere: `turbo run e2e` was unusable
// until #695 because CI drives Cypress through the test:cypress* scripts.
// Derived rather than listed, so a lane added to turbo.json and not to CI joins
// this set on its own instead of waiting for someone to remember it.

// What build-test-run.yml invokes, via mise's `ci` / `ci_main` tasks; `ci` is
// turbo's back-compat alias of ci:pull_request, so naming it covers both. A
// typo here fails the dry run rather than silently shrinking the covered set.
const CI_LANES = ['ci', 'ci:main'];

const configs = await Promise.all(
  ['<root>', ...members.map((member) => member.dir)]
    .filter((dir, at, dirs) => dirs.indexOf(dir) === at)
    .map((dir) =>
      readFile(
        join(workspaceRoot, dir === '<root>' ? '.' : dir, 'turbo.json'),
        'utf8',
      ).catch(() => undefined),
    ),
);
const declared = declaredLanes(configs.filter((text) => text !== undefined));
const covered = await plannedLanes(CI_LANES);
const unrun = [...declared].filter((lane) => !covered.has(lane)).sort();
if (unrun.length === 0) {
  // the ci:* graphs cannot reach every lane; an empty set means the derivation
  // broke, not that everything is covered
  console.error(`${CHECK}: no unrun lanes found — the derivation is wrong`);
  process.exit(1);
}

const failure = await planFailure(unrun);
if (failure !== undefined) {
  console.error(`${CHECK}: turbo cannot plan ${unrun.join(', ')}:\n${failure}`);
  process.exit(1);
}
console.log(`${CHECK}: ${unrun.length} lanes outside ci:* plan`);

let failed = false;
for (const rule of RULES) {
  const selected = members.filter(rule.select).map((member) => member.name);
  if (selected.length === 0) {
    // the invariant is vacuous if nothing matches; that's a wiring bug, not a pass
    console.error(
      `${CHECK}: ${rule.consumer}: no member selects for ${rule.producerTask}`,
    );
    failed = true;
    continue;
  }
  const missing = missingEdges(
    selected,
    rule.producerTask,
    await resolvedTaskDeps(rule.consumer),
  );
  if (missing.length > 0) {
    console.error(`${CHECK}: ${formatMissing(rule, missing)}`);
    failed = true;
    continue;
  }
  console.log(
    `${CHECK}: ${rule.consumer} orders on ${selected.length} ${rule.producerTask} producers`,
  );
}
if (failed) process.exit(1);
