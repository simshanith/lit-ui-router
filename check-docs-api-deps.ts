// Every docs:api producer writes into docs/api: markdown VitePress routes, and
// a typedoc-sidebar.json that docs/.vitepress/config.ts imports statically.
// docs#build orders that generation with `^docs:api`, and `^` walks DIRECT deps
// only — so a producer that isn't a direct dep of docs never runs, and the site
// builds against a missing sidebar (clean CI) or a stale one (warm tree).
//
// Nothing in docs/package.json can explain why a site that never imports
// lit-ui-router depends on it — package.json takes no comments — so a
// dependency prune would read those entries as unused and drop them. This is
// the failing test for that: name the producer, before the build fails three
// steps downstream on an unresolved import.
import { loadWorkspace, workspaceRoot } from '@tools/shared/workspace.ts';

const CHECK = 'check-docs-api-deps';

const { members } = await loadWorkspace(workspaceRoot);

const docs = members.find((member) => member.name === 'docs');
if (!docs?.manifest) {
  console.error(`${CHECK}: no docs package found in the workspace`);
  process.exit(1);
}

const producers = members.filter(
  (member) => member.manifest?.scripts?.['docs:api'] !== undefined,
);
if (producers.length === 0) {
  // the invariant is vacuous if the task vanished; that's a wiring bug, not a pass
  console.error(`${CHECK}: no package declares a docs:api script`);
  process.exit(1);
}

const declared = new Set([
  ...Object.keys(docs.manifest.dependencies ?? {}),
  ...Object.keys(docs.manifest.devDependencies ?? {}),
]);

const missing = producers.filter((producer) => !declared.has(producer.name));
if (missing.length > 0) {
  for (const producer of missing) {
    console.error(
      `${CHECK}: ${producer.name} (${producer.dir}) produces API docs into ` +
        'docs/api but is not a direct dependency of docs, so `^docs:api` ' +
        'cannot order it',
    );
  }
  console.error(
    `${CHECK}: add ${missing
      .map((producer) => `"${producer.name}": "workspace:*"`)
      .join(', ')} to docs/package.json devDependencies and reinstall`,
  );
  process.exit(1);
}

console.log(
  `${CHECK}: ${producers.length} docs:api producers are all direct deps of docs`,
);
