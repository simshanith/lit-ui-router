// Static turbo edges vs dynamically discovered workspace members. Each rule
// names a consumer task that must order on `<member>#<producerTask>` for every
// member the selector picks; the members come from the workspace, the edges
// from turbo's own resolved graph (`--dry-run=json`), so a package-qualified
// dependsOn line in any turbo.json counts and no manifest link is needed.
import {
  type EdgeRule,
  formatMissing,
  missingEdges,
} from '@tools/shared/graph-edges.core.ts';
import { resolvedTaskDeps } from '@tools/shared/turbo.ts';
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
