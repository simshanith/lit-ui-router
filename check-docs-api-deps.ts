// docs#build orders API-doc generation with `^docs:api`, and `^` walks direct
// deps only, so docs devDepends on packages it never imports. package.json
// takes no comments to say so, and a dependency prune reads those entries as
// unused. Assert every package with a docs:api script is a direct dep of docs.
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
