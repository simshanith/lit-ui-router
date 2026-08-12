// Shared workspace root and enumeration for the check:* scripts and tools.
//
// Why the SDK (not the lockfile, not hand-parsed YAML): pnpm-lock.yaml has
// already resolved `catalog:` refs to concrete versions, so it can't distinguish
// a catalogued dep from an inline one — that lives only in package.json.
// `findPackages` is pnpm's own workspace resolver, so we inherit its glob
// handling, including that the standalone tutorials under examples/* are NOT
// members (the glob is `examples`, not `examples/*`).
//
// The SDK is imported lazily so that `workspaceRoot` costs nothing to import:
// consumers that only need the path don't load ~100ms of pnpm internals, and
// don't depend on the root's devDependencies being installed.

import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { WorkspaceManifest } from '@pnpm/workspace.workspace-manifest-reader';

import type { PackageManifest } from './types.ts';

/** Absolute path to the workspace root. This file lives in <root>/tools/shared/src. */
export const workspaceRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

// `dir` is relative to the workspace root, and is '<root>' for the root itself.
export type Member = {
  name: string;
  dir: string;
  manifest?: PackageManifest;
};

/**
 * Parse pnpm-workspace.yaml. The `select*` selectors below take the result
 * rather than a root, so a caller needing several sections parses the file once
 * and passes the manifest around instead of re-reading it per section.
 */
export async function loadWorkspaceManifest(
  root: string,
): Promise<WorkspaceManifest | undefined> {
  const { readWorkspaceManifest } =
    await import('@pnpm/workspace.workspace-manifest-reader');
  return readWorkspaceManifest(root);
}

/** Enumerate workspace members (incl. root) and the parsed workspace manifest. */
export async function loadWorkspace(root: string): Promise<{
  members: Member[];
  workspaceManifest: WorkspaceManifest | undefined;
}> {
  const [{ findPackages }, workspaceManifest] = await Promise.all([
    import('@pnpm/workspace.projects-reader'),
    loadWorkspaceManifest(root),
  ]);
  const projects = await findPackages(root, {
    patterns: workspaceManifest?.packages,
    includeRoot: true,
  });
  const members: Member[] = projects.map((project) => {
    const dir = relative(root, project.rootDir) || '<root>';
    return {
      name: project.manifest?.name ?? dir,
      dir,
      manifest: project.manifest,
    };
  });
  return { members, workspaceManifest };
}

/** Catalogs from the manifest; the unnamed `catalog:` is `default`, per pnpm. */
export function selectCatalogs(
  manifest: WorkspaceManifest | undefined,
): Record<string, Record<string, string>> {
  return { default: manifest?.catalog ?? {}, ...manifest?.catalogs };
}

/** packageExtensions from the manifest: package name -> injected fields. */
export function selectPackageExtensions(
  manifest: WorkspaceManifest | undefined,
): Record<string, { dependencies?: Record<string, string> }> {
  return manifest?.packageExtensions ?? {};
}

/** patchedDependencies from the manifest: package name -> patch path. */
export function selectPatchedDependencies(
  manifest: WorkspaceManifest | undefined,
): Record<string, string> {
  return manifest?.patchedDependencies ?? {};
}
