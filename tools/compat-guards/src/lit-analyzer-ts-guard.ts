#!/usr/bin/env node
// lit-analyzer declares no typescript dependency and require()s it, so Node's
// walk-up from its realpath in the virtual store finds the root TypeScript 7
// and it crashes. A packageExtensions entry injects a TypeScript 6 instead.
// ts-simple-type, which lit-analyzer drives, has the same undeclared require
// and gets the same entry, so both load one TypeScript instance.
//
// That spec has to be spelled out rather than referenced: packageExtensions is
// applied as though the external package authored it, and `catalog:` is
// workspace-only, so pnpm rejects it there. A YAML anchor doesn't work either —
// pnpm expands the alias to a literal on its next rewrite while keeping the
// anchor, so it silently reverts to pins that still look linked. Hence the
// duplicates, and hence this guard.
// Usage (from anywhere): lit-analyzer-ts-guard
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import {
  selectCatalogs,
  loadWorkspaceManifest,
  selectPackageExtensions,
} from '@tools/shared/workspace.ts';

import { guard } from './guard.ts';

const CATALOG = 'typescript6-compat';
const EXTENDED = ['lit-analyzer', 'ts-simple-type'];
const DEP = 'typescript';

const g = guard('lit-analyzer-ts-guard');

// one read, awaited by both selectors, so both halves of the comparison come
// out of the same parse
const manifest = loadWorkspaceManifest(workspaceRoot);

const expected =
  (await selectCatalogs(manifest))[CATALOG]?.[DEP] ??
  g.fail(`no ${CATALOG} ${DEP} entry in pnpm-workspace.yaml`);

const extensions = await selectPackageExtensions(manifest);

for (const extended of EXTENDED) {
  const actual =
    extensions[extended]?.dependencies?.[DEP] ??
    g.fail(
      `packageExtensions.${extended} injects no ${DEP}, so ${extended} will ` +
        'resolve the root TypeScript and crash. Restore the entry in ' +
        'pnpm-workspace.yaml.',
    );

  if (actual !== expected) {
    g.fail(
      `packageExtensions.${extended} pins ${DEP} "${actual}" but the ${CATALOG} ` +
        `catalog says "${expected}". packageExtensions cannot reference a ` +
        'catalog, so the spec is duplicated on purpose — move them together.',
    );
  }

  g.pass(
    `packageExtensions.${extended} ${DEP} matches ${CATALOG} (${expected})`,
  );
}
