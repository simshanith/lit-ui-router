// docs orders API-doc generation on package-qualified `<name>#docs:api` edges
// in docs/turbo.json rather than `^docs:api`, so it needs no workspace:
// dependency on packages it never imports. Assert every task that orders on
// any docs:api producer orders on all of them, and that none is stale.
import { readTurboTaskDeps } from '@tools/shared/turbo.ts';
import { loadWorkspace, workspaceRoot } from '@tools/shared/workspace.ts';

const CHECK = 'check-docs-api-deps';
const TASK = 'docs:api';

const { members } = await loadWorkspace(workspaceRoot);

const docs = members.find((member) => member.name === 'docs');
if (!docs?.manifest) {
  console.error(`${CHECK}: no docs package found in the workspace`);
  process.exit(1);
}

const producers = members
  .filter((member) => member.manifest?.scripts?.[TASK] !== undefined)
  .map((member) => member.name);
if (producers.length === 0) {
  // the invariant is vacuous if the task vanished; that's a wiring bug, not a pass
  console.error(`${CHECK}: no package declares a ${TASK} script`);
  process.exit(1);
}

const tasks = readTurboTaskDeps(docs.dir);
const ordering = Object.entries(tasks).filter(([, deps]) =>
  deps.some((dep) => dep.endsWith(`#${TASK}`)),
);
if (ordering.length === 0) {
  console.error(`${CHECK}: no docs/turbo.json task orders on a #${TASK} edge`);
  process.exit(1);
}

let failed = false;
for (const [task, deps] of ordering) {
  const declared = new Set(
    deps
      .filter((dep) => dep.endsWith(`#${TASK}`))
      .map((dep) => dep.slice(0, -TASK.length - 1)),
  );
  const missing = producers.filter((name) => !declared.has(name));
  const stale = [...declared].filter((name) => !producers.includes(name));
  for (const name of missing) {
    console.error(
      `${CHECK}: ${name} produces API docs into docs/api but docs#${task} ` +
        `does not order on "${name}#${TASK}"`,
    );
  }
  for (const name of stale) {
    console.error(
      `${CHECK}: docs#${task} orders on "${name}#${TASK}" but ${name} has no ${TASK} script`,
    );
  }
  failed ||= missing.length > 0 || stale.length > 0;
}
if (failed) {
  console.error(`${CHECK}: fix the dependsOn lists in docs/turbo.json`);
  process.exit(1);
}

console.log(
  `${CHECK}: ${producers.length} ${TASK} producers ordered by ${ordering.length} docs tasks`,
);
