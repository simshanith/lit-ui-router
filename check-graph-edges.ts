// Each rule's consumer task must order on `<member>#<producerTask>` for every
// member the selector picks, or a new member silently falls out of the graph.
import {
  type EdgeRule,
  formatMissing,
  missingEdges,
} from '@tools/shared/graph-edges.core.ts';
import { planLanes, resolvedTaskDeps } from '@tools/shared/turbo.ts';
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

// The edge rules below assert what a lane orders on; this asserts the lane can
// be planned at all. turbo rejects an invalid edge — `dependsOn` onto a
// persistent task — for the whole run, before any task starts, so a lane no CI
// path invokes rots unseen: `turbo run e2e` was unusable until #695, because
// CI drives Cypress through the test:cypress* scripts instead.
const lanes = [
  ...new Set(
    members.flatMap((member) => Object.keys(member.manifest?.scripts ?? {})),
  ),
].sort();
const { planned, failure } = await planLanes(lanes);
if (failure !== undefined) {
  // the graph is invalid, so every edge rule below would report against a plan
  // turbo refuses to build; the one real finding is this one
  console.error(`${CHECK}: turbo cannot plan the declared lanes:\n${failure}`);
  process.exit(1);
}
if (planned.length === 0) {
  // an empty lane set would pass vacuously; that's a wiring bug, not a pass
  console.error(`${CHECK}: no member declares a turbo lane`);
  process.exit(1);
}
console.log(`${CHECK}: ${planned.length} declared lanes plan`);

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
