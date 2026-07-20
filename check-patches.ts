// pnpm applies patches by exact file path, so a patched dependency bump can
// rotate a content-hashed target filename and the patch silently no-ops.
// Assert every patch target exists in the installed package and every added
// line survives, for each entry in pnpm-workspace.yaml's patchedDependencies.
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parsePatch } from 'diff';

import {
  loadPatchedDependencies,
  workspaceRoot,
} from '@tools/shared/workspace.ts';

const patchedDependencies = await loadPatchedDependencies(workspaceRoot);
const entries = Object.entries(patchedDependencies);
if (entries.length === 0) {
  console.error('check-patches: no patchedDependencies declared');
  process.exit(1);
}

let failed = false;
const fail = (message: string) => {
  failed = true;
  console.error(`check-patches: ${message}`);
};

for (const [name, patchPath] of entries) {
  const patch = readFileSync(join(workspaceRoot, patchPath), 'utf8');
  // live installs of a patched dep are keyed with patch_hash; hash-less
  // siblings are orphaned store dirs from other branches' installs
  const installs = globSync(
    join(
      workspaceRoot,
      'node_modules/.pnpm',
      `${name.replace('/', '+')}@*patch_hash*`,
      'node_modules',
      name,
    ),
  );
  if (installs.length === 0) {
    fail(`${name}: patch declared but no patched install found`);
    continue;
  }

  // a new path of /dev/null marks a deletion
  for (const file of parsePatch(patch)) {
    const target = file.newFileName;
    if (!target || target === '/dev/null') continue;
    const relPath = target.replace(/^b\//, '');
    const added = file.hunks
      .flatMap((hunk) => hunk.lines)
      .filter((line) => line.startsWith('+'))
      .map((line) => line.slice(1))
      .filter((line) => line.trim() !== '');

    for (const install of installs) {
      let content: string;
      try {
        content = readFileSync(join(install, relPath), 'utf8');
      } catch {
        fail(`${name}: ${relPath} missing in ${install} (patch no-oped?)`);
        continue;
      }
      for (const line of added) {
        if (!content.includes(line)) {
          fail(`${name}: ${relPath} lacks patched line: ${line.trim()}`);
        }
      }
    }
  }
}

if (failed) {
  console.error(
    'check-patches: regenerate with `pnpm patch <pkg>` against the new version, or drop the entry if upstream shipped the fix',
  );
  process.exit(1);
}
console.log(
  `check-patches: ${entries.length} patches verified against installs`,
);
