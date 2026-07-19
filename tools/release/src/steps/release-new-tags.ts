#!/usr/bin/env node
// Detect which packages were released at this commit — build-test.yml's
// detect_release step:
//   env in:  GITHUB_SHA (the validated main head)
//   outputs: packages (JSON array of workspace package names)
// The workflow_call replacement for the tag-push event's ref: tag_push runs
// earlier in the same chain, so any <package>@<version> tag pointing at this
// commit is a release this run just cut. Decisions live in
// ./release-new-tags.core.ts.

import { defaultExec } from '@tools/shared/exec.ts';
import { requireEnv } from '@tools/shared/env.core.ts';
import { runMain, setOutput } from '@tools/shared/gha.ts';
import { newlyTaggedPackages } from './release-new-tags.core.ts';
import { loadWorkspace, workspaceRoot } from '@tools/shared/workspace.ts';

runMain(async () => {
  const sha = requireEnv(process.env, 'GITHUB_SHA');
  const { stdout } = await defaultExec('git', ['tag', '--points-at', sha], {
    cwd: workspaceRoot,
  });
  const { members } = await loadWorkspace(workspaceRoot);
  const packages = newlyTaggedPackages(members, stdout.split('\n'));
  console.log(
    packages.length === 0
      ? '(no release tags point at this commit)'
      : packages.join('\n'),
  );
  await setOutput('packages', JSON.stringify(packages));
});
