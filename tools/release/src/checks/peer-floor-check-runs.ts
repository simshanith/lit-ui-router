#!/usr/bin/env node
// Tier-1 peer-floor signal: discover workspace packages defining the
// typecheck:peer-floor script, run each package's floor typecheck via turbo,
// and create one check run per package on the current HEAD. Runs turbo
// per package because a stale floor must become an orange check run, never a
// job failure — this exits 0 whatever the verdicts. Inert (no packages, no
// runs) until a package defines the script. `--dry-run` runs the typechecks
// but prints payloads instead of calling gh. Shaping is pure and unit-tested
// in ./peer-floor-check-runs.core.ts.

import { defaultExec } from '@tools/shared/exec.ts';
import { ensureGh } from '@tools/shared/gh.ts';
import { loadWorkspace, workspaceRoot } from '@tools/shared/workspace.ts';

import {
  peerFloorMembers,
  peerFloorTurboArgs,
  toPeerFloorCheckRun,
  type PeerFloorResult,
} from './peer-floor-check-runs.core.ts';
import { checkRunApiArgs } from './publish-check-runs.core.ts';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const repo = process.env.GITHUB_REPOSITORY ?? 'simshanith/lit-ui-router';
  if (!process.env.GITHUB_REPOSITORY && !dryRun) {
    throw new Error('GITHUB_REPOSITORY must be set (or pass --dry-run)');
  }

  const { members } = await loadWorkspace(workspaceRoot);
  const results: PeerFloorResult[] = [];
  for (const member of peerFloorMembers(members)) {
    let ok = true;
    try {
      await defaultExec('turbo', peerFloorTurboArgs(member.name), {
        cwd: workspaceRoot,
      });
    } catch {
      // a stale floor is a signal, not a job failure
      ok = false;
    }
    console.log(`${member.name}: ${ok ? 'floor honest' : 'floor stale'}`);
    results.push({ name: member.name, ok });
  }

  const payloads = results.map((result) => toPeerFloorCheckRun(result, repo));
  if (dryRun) {
    console.log(JSON.stringify(payloads, null, 2));
    return;
  }
  if (payloads.length === 0) {
    console.log('no packages define typecheck:peer-floor — nothing to report');
    return;
  }
  const { stdout } = await defaultExec('git', ['rev-parse', 'HEAD']);
  const headSha = stdout.trim();
  await ensureGh();
  for (const payload of payloads) {
    await defaultExec('gh', checkRunApiArgs(repo, headSha, payload));
    console.log(
      `created check run "${payload.name}" (${payload.conclusion}) on ${headSha}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
