// Pure decision for the bump-time peer-floor gate — tier 2 of the peer-floor
// plan: a package whose floor claim is dishonest must not bump. Deadlock-free
// by construction: the failure demands a PEER release, and that peer's own
// bump never defines the script against itself. Packages opt in by defining
// the typecheck:peer-floor script; everyone else skips. The IO (workspace
// load, turbo) lives in ./release-peer-floor-gate.ts.

import type { Member } from '@tools/shared/workspace.ts';

import {
  PEER_FLOOR_SCRIPT,
  peerFloorTurboArgs,
} from '../checks/peer-floor-check-runs.core.ts';

export type GateDecision =
  | { kind: 'skip'; reason: string }
  | { kind: 'check'; turboArgs: string[] };

/** Skip when the member doesn't opt in; otherwise the filtered turbo argv. */
export function gateDecision(
  packageName: string,
  members: readonly Member[],
): GateDecision {
  const member = members.find(
    (candidate) => candidate.name === packageName && candidate.dir !== '<root>',
  );
  if (member === undefined) {
    throw new Error(
      `package ${JSON.stringify(packageName)} is not a workspace member`,
    );
  }
  if (typeof member.manifest?.scripts?.[PEER_FLOOR_SCRIPT] !== 'string') {
    return {
      kind: 'skip',
      reason: `${packageName} defines no ${PEER_FLOOR_SCRIPT} script — gate does not apply`,
    };
  }
  return { kind: 'check', turboArgs: peerFloorTurboArgs(packageName) };
}
