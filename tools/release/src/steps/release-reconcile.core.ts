// Pure decisions for the publish-path double-entry reconciliation. The IO
// shell (./release-reconcile.ts) hashes the two tarballs and reads turbo's
// run summary; the verdict logic lives here, unit-tested.

export interface CacheOutcome {
  status?: string;
  source?: string;
}

/** The pack:all task's cache outcome from a `turbo run --summarize` file. */
export function packCacheOutcome(
  summary: unknown,
  taskId: string,
): CacheOutcome {
  const tasks =
    (summary as { tasks?: Array<{ taskId?: string; cache?: CacheOutcome }> })
      .tasks ?? [];
  const task = tasks.find((entry) => entry.taskId === taskId);
  return { status: task?.cache?.status, source: task?.cache?.source };
}

export type Verdict =
  | { kind: 'balanced' }
  | { kind: 'drift' }
  | { kind: 'unverifiable'; reason: string };

/**
 * A genuine REMOTE hit is the only credit we can trust to be CI's verified
 * artifact: on the publish runner the local cache is cold, so a pack:all
 * tarball sourced remotely is the one the checks validated. Anything else (a
 * miss that re-executed locally, or no reachable entry) leaves nothing to
 * cross-check — publish still ships the trusted cold debit, just unverified
 * against CI.
 */
export function reconcile(
  debitSha: string,
  creditSha: string,
  outcome: CacheOutcome,
): Verdict {
  if (outcome.status !== 'HIT' || outcome.source !== 'REMOTE') {
    return {
      kind: 'unverifiable',
      reason: `pack:all was not a remote-cache hit (status=${outcome.status ?? 'none'}, source=${outcome.source ?? 'none'})`,
    };
  }
  return debitSha === creditSha ? { kind: 'balanced' } : { kind: 'drift' };
}
