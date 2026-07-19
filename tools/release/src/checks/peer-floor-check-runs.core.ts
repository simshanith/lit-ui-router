// Pure shaping for the peer-floor check runs: per-package typecheck verdicts
// in, Checks API payloads out. Tier 1 of the peer-floor plan — a merge-time
// SIGNAL: action_required renders orange ("a floor bump is owed"), never a
// CI failure; `failure` is deliberately unused, matching publish-check-runs.
// A bump commit's rerun flips green once the floor bump lands. The IO
// (workspace discovery, turbo, gh) lives in ./peer-floor-check-runs.ts.

import type { Member } from '@tools/shared/workspace.ts';

import type { CheckRunPayload } from './publish-check-runs.core.ts';
import { releaseWorkflowUrl } from './publish-check-runs.core.ts';

export const PEER_FLOOR_SCRIPT = 'typecheck:peer-floor';

export type PeerFloorResult = {
  name: string;
  ok: boolean;
};

/** The exact run name a badge nameFilter would match. */
export function peerFloorCheckRunName(packageName: string): string {
  return `peer-floor (${packageName})`;
}

/** Members that opt in by defining the script; root never qualifies. */
export function peerFloorMembers(members: Member[]): Member[] {
  return members.filter(
    (member) =>
      member.dir !== '<root>' &&
      typeof member.manifest?.scripts?.[PEER_FLOOR_SCRIPT] === 'string',
  );
}

/** argv for one package's floor typecheck via turbo. */
export function peerFloorTurboArgs(packageName: string): string[] {
  return ['run', PEER_FLOOR_SCRIPT, `--filter=${packageName}`];
}

/** One package's verdict → its Checks API payload. */
export function toPeerFloorCheckRun(
  result: PeerFloorResult,
  repo: string,
): CheckRunPayload {
  const name = peerFloorCheckRunName(result.name);
  if (result.ok) {
    return {
      name,
      conclusion: 'success',
      title: 'src typechecks against the published peer floor',
      summary:
        `\`${PEER_FLOOR_SCRIPT}\` passed: ${result.name}'s src compiles ` +
        'against the pinned floor of its published peer range.',
    };
  }
  return {
    name,
    conclusion: 'action_required',
    title: 'floor stale: release the peer, then bump the publishedPeer floor',
    summary: [
      `\`${PEER_FLOOR_SCRIPT}\` failed: ${result.name}'s src uses API absent`,
      'from the pinned floor of its declared peer range — consumers installed',
      'at the floor would break.',
      '',
      `To resolve: [release the peer package via the bump-version workflow](${releaseWorkflowUrl(repo)}),`,
      'then raise the catalog:publishedPeer floor and the peerFloor pin in',
      'pnpm-workspace.yaml. This run re-checks and flips green on the floor',
      'bump commit.',
    ].join('\n'),
    // details_url: not settable — GitHub pins GITHUB_TOKEN-created check runs to their own page
  };
}
