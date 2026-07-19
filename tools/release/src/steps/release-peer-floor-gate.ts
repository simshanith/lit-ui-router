#!/usr/bin/env node
// Bump-time peer-floor gate — bump-version.yml's Peer floor gate step:
//   env in: PACKAGE
// Fails the bump when the package's src no longer typechecks against the
// pinned floor of its published peer range (the floor pin can only reference
// published versions, so the remedy is releasing the peer first — which this
// gate never blocks). No-ops for packages without the script. Tier 1's check
// run on the eventual floor-bump commit re-checks and flips green. Decisions
// live in ./release-peer-floor-gate.core.ts.

import { requireEnv } from '@tools/shared/env.core.ts';
import { defaultStream } from '@tools/shared/exec.ts';
import { runMain } from '@tools/shared/gha.ts';
import { loadWorkspace, workspaceRoot } from '@tools/shared/workspace.ts';

import { gateDecision } from './release-peer-floor-gate.core.ts';

runMain(async () => {
  const packageName = requireEnv(process.env, 'PACKAGE');
  const { members } = await loadWorkspace(workspaceRoot);
  const decision = gateDecision(packageName, members);
  if (decision.kind === 'skip') {
    console.log(decision.reason);
    return;
  }
  // nonzero turbo exit propagates and fails the bump
  await defaultStream('turbo', decision.turboArgs, { cwd: workspaceRoot });
});
