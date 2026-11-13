// Where a package's release notes live, and the @tools/changelog CLIs the drivers hand release-it.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { loadWorkspace } from '@tools/shared/workspace.ts';

import { memberDir } from './release-package-info.core.ts';

/** A package's directory and CHANGELOG.md, workspace-relative and absolute. */
export interface PackageNotes {
  dir: string;
  changelogPath: string;
  changelog: string;
}

export async function packageNotes(packageName: string): Promise<PackageNotes> {
  const { members } = await loadWorkspace(workspaceRoot);
  const dir = memberDir(packageName, members);
  const changelogPath = `${dir}/CHANGELOG.md`;

  return { dir, changelogPath, changelog: join(workspaceRoot, changelogPath) };
}

/** Absolute path of a @tools/changelog CLI. */
export function changelogScript(
  name: 'extract.ts' | 'write-section.ts',
): string {
  return fileURLToPath(import.meta.resolve(`@tools/changelog/${name}`));
}
