#!/usr/bin/env node
// Resolves the package a publish run targets and exports it as step outputs:
//   env in:  PACKAGE_INPUT (manual dispatch) | GITHUB_REF (tag pushes)
//   outputs: package_name, package_dir (workspace-relative)
// Replaces publish-npm.yml's tag-parsing and `pnpm list`+realpath bash with
// the pure functions in ./release-package-info.core.ts and pnpm's own
// workspace resolver (workspace.ts) — the same enumeration `pnpm --filter`
// used, without round-tripping tainted strings through a shell.

import { runMain, setOutput } from 'shared/gha.ts';
import { memberDir, resolvePackageName } from './release-package-info.core.ts';
import { loadWorkspace, workspaceRoot } from 'shared/workspace.ts';

runMain(async () => {
  const name = resolvePackageName({
    packageInput: process.env.PACKAGE_INPUT,
    ref: process.env.GITHUB_REF,
  });
  const { members } = await loadWorkspace(workspaceRoot);
  const dir = memberDir(name, members);
  console.log(`${name} → ${dir}`);
  await setOutput('package_name', name);
  await setOutput('package_dir', dir);
});
