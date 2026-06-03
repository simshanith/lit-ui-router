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
// This file is the IO shell: it enumerates workspace members and reads the
// workspace manifest via the pnpm SDK, then delegates all decisions to the pure,
// unit-tested functions in ./check-catalog.core.mjs.
//
// Why the SDK (not the lockfile, not hand-parsed YAML): pnpm-lock.yaml has
// already resolved `catalog:` refs to concrete versions, so it can't distinguish
// a catalogued dep from an inline one — that lives only in package.json.
// `findPackages` is pnpm's own workspace resolver, so we inherit its glob
// handling, including that the standalone tutorials under examples/* are NOT
// members (the glob is `examples`, not `examples/*`).

import { findPackages } from '@pnpm/fs.find-packages';
import { readWorkspaceManifest } from '@pnpm/workspace.read-manifest';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  catalogDepNames,
  collectInlineUsage,
  findViolations,
  formatReport,
} from './check-catalog.core.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Enumerate workspace members (incl. root) and the parsed workspace manifest. */
export async function loadWorkspace(root) {
  const workspaceManifest = await readWorkspaceManifest(root);
  const projects = await findPackages(root, {
    patterns: workspaceManifest?.packages,
    includeRoot: true,
  });
  const members = projects.map((project) => {
    const dir = relative(root, project.rootDir) || '<root>';
    return {
      name: project.manifest?.name ?? dir,
      dir,
      manifest: project.manifest,
    };
  });
  return { members, workspaceManifest };
}

async function main() {
  const { members, workspaceManifest } = await loadWorkspace(ROOT);
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
