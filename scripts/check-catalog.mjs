#!/usr/bin/env node
// Enforce pnpm catalog usage for shared dependencies.
//
// Rule: any dependency declared with an inline registry range (e.g. "^1.2.3")
// in two or more workspace packages must instead be hoisted to the `catalog:`
// in pnpm-workspace.yaml and referenced as `catalog:` (or `catalog:<name>`).
// `catalogMode: prefer` nudges new `pnpm add`s toward the catalog, but it is a
// soft default; this check is the hard gate that keeps duplication from drifting
// back in (e.g. via hand-edited package.json or a `--save-catalog`-less add).
//
// This file is the IO shell: it enumerates workspace members via
// ./workspace.mjs, then delegates all decisions to the pure, unit-tested
// functions in ./check-catalog.core.mjs.

import {
  catalogDepNames,
  collectInlineUsage,
  findViolations,
  formatReport,
} from './check-catalog.core.mjs';
import { loadWorkspace, workspaceRoot } from './workspace.mjs';

async function main() {
  const { members, workspaceManifest } = await loadWorkspace(workspaceRoot);
  const violations = findViolations(collectInlineUsage(members));
  const { ok, text } = formatReport(violations, {
    memberCount: members.length,
    catalogNames: catalogDepNames(workspaceManifest),
  });
  (ok ? console.log : console.error)(text);
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
