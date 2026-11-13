// The one reading of which files the drift check and the re-sync compare.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { isPublishable, loadWorkspace } from '@tools/shared/workspace.ts';

/** Each published package's CHANGELOG.md, `undefined` where there is none. */
export async function changelogFiles() {
  const { members } = await loadWorkspace(workspaceRoot);

  return members
    .filter(isPublishable)
    .filter(({ dir }) => dir.startsWith('packages/'))
    .map(({ name, dir }) => {
      const path = join(workspaceRoot, dir, 'CHANGELOG.md');

      return {
        name,
        text: existsSync(path) ? readFileSync(path, 'utf8') : undefined,
      };
    });
}
