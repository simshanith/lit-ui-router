// Shared workspace enumeration for the check:* scripts, via the pnpm SDK.
//
// Why the SDK (not the lockfile, not hand-parsed YAML): pnpm-lock.yaml has
// already resolved `catalog:` refs to concrete versions, so it can't distinguish
// a catalogued dep from an inline one — that lives only in package.json.
// `findPackages` is pnpm's own workspace resolver, so we inherit its glob
// handling, including that the standalone tutorials under examples/* are NOT
// members (the glob is `examples`, not `examples/*`).

import { findPackages } from '@pnpm/fs.find-packages';
import { readWorkspaceManifest } from '@pnpm/workspace.read-manifest';
import { relative } from 'node:path';

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
