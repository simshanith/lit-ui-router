// Pure decision layer for the branch-head CI gate.
//
// The predicate is "would a pull_request run cover this SHA?". It has two
// misses, and both must fall back to the push run:
//   - no open PR has this branch as its head, so nothing fires at all;
//   - a base conflicts, so GitHub builds no merge ref and skips pull_request.
// Everything indeterminate also runs: a false "mergeable" silently drops the
// only signal this SHA would get, while a false "conflicting" costs one
// redundant run.

/** An open PR whose head is the pushed branch, as reported by `gh pr list`. */
export type OpenPr = { number: number; baseRefName: string };

/** Whether the pushed head merges into one base cleanly. */
export type MergeState = 'clean' | 'conflict' | 'unknown';

/** One base ref, the PRs targeting it, and how the merge probe went. */
export type BaseVerdict = {
  baseRef: string;
  prs: number[];
  state: MergeState;
  detail?: string;
};

export type Decision = { run: boolean; reason: string };

/**
 * Validate `gh pr list --json number,baseRefName` output. Throws on any shape
 * surprise so the caller can fail open rather than silently read zero PRs —
 * "no PRs" is itself a run-triggering answer, so a parse failure that looked
 * like an empty list would be indistinguishable from the real thing.
 */
export function parseOpenPrs(raw: unknown): OpenPr[] {
  if (!Array.isArray(raw)) {
    throw new Error(`expected a JSON array of PRs, got ${typeof raw}`);
  }
  return raw.map((entry, index) => {
    const pr = entry as Partial<OpenPr>;
    if (typeof pr?.number !== 'number' || typeof pr?.baseRefName !== 'string') {
      throw new Error(
        `PR entry ${index} is missing number/baseRefName: ${JSON.stringify(entry)}`,
      );
    }
    return { number: pr.number, baseRefName: pr.baseRefName };
  });
}

/**
 * Collapse the PR list to the distinct bases worth probing — several PRs can
 * share a base, and the merge probe only depends on the base. Sorted so the
 * step summary reads the same way twice.
 */
export function distinctBases(
  prs: readonly OpenPr[],
): { baseRef: string; prs: number[] }[] {
  const byBase = new Map<string, number[]>();
  for (const pr of prs) {
    const existing = byBase.get(pr.baseRefName);
    if (existing) existing.push(pr.number);
    else byBase.set(pr.baseRefName, [pr.number]);
  }
  return [...byBase.entries()]
    .map(([baseRef, numbers]) => ({
      baseRef,
      prs: [...numbers].sort((a, b) => a - b),
    }))
    .sort((a, b) => a.baseRef.localeCompare(b.baseRef));
}

// A conflicted merge still writes the merged tree's OID as its first stdout
// line; a probe that never got that far wrote something else (or nothing).
const TREE_OID = /^[0-9a-f]{40,64}$/;

/**
 * `git merge-tree --write-tree` exits 0 on a clean merge, but exit 1 is
 * ambiguous: it covers both a real conflict AND a ref git refuses to merge
 * ("nope - not something we can merge"), which is a broken probe rather than
 * an answer. The tree OID on stdout is what separates them — without it, the
 * state is unknown and the caller runs CI instead of reporting a conflict.
 */
export function mergeStateFromExit(
  code: number | null,
  stdout = '',
): MergeState {
  if (code === 0) return 'clean';
  if (code !== 1) return 'unknown';
  const [first = ''] = stdout.trim().split('\n', 1);
  return TREE_OID.test(first) ? 'conflict' : 'unknown';
}

function listBases(verdicts: readonly BaseVerdict[]): string {
  return verdicts.map((verdict) => verdict.baseRef).join(', ');
}

export function decide(
  prs: readonly OpenPr[],
  verdicts: readonly BaseVerdict[],
): Decision {
  if (prs.length === 0) {
    return {
      run: true,
      reason:
        'no open PR has this branch as its head — no pull_request run will cover this push',
    };
  }
  if (verdicts.length === 0) {
    return {
      run: true,
      reason: `${prs.length} open PR(s) but no merge probe ran — running rather than assume coverage`,
    };
  }
  const conflicting = verdicts.filter(
    (verdict) => verdict.state === 'conflict',
  );
  if (conflicting.length > 0) {
    return {
      run: true,
      reason: `conflicts with ${listBases(conflicting)} — GitHub builds no merge ref, so the pull_request run is skipped`,
    };
  }
  const indeterminate = verdicts.filter(
    (verdict) => verdict.state === 'unknown',
  );
  if (indeterminate.length > 0) {
    return {
      run: true,
      reason: `mergeability with ${listBases(indeterminate)} is indeterminate — running rather than risk dropping the only signal`,
    };
  }
  return {
    run: false,
    reason: `mergeable with ${listBases(verdicts)} — the merge-head pull_request run already covers this SHA`,
  };
}

/** Everything one gate run concluded — what the summary renders. */
export type GateRun = {
  branch: string;
  sha: string;
  prs: readonly OpenPr[];
  verdicts: readonly BaseVerdict[];
  decision: Decision;
};

const STATE_MARK: Record<MergeState, string> = {
  clean: 'mergeable',
  conflict: 'CONFLICTS',
  unknown: 'indeterminate',
};

/**
 * The step summary is the whole debugging story for a gray, skipped run:
 * which PRs were found, which bases they target, and how each probe answered.
 */
export function summaryMarkdown({
  branch,
  sha,
  prs,
  verdicts,
  decision,
}: GateRun): string {
  const lines = [
    `## Branch CI gate — ${decision.run ? 'running' : 'skipping'} \`build_and_test (branch)\``,
    '',
    `\`${branch}\` @ \`${sha.slice(0, 12)}\``,
    '',
    decision.reason,
    '',
  ];
  if (prs.length === 0) {
    lines.push('No open pull requests have this branch as their head.');
  } else {
    lines.push(
      '| base | PRs | merge probe | detail |',
      '| --- | --- | --- | --- |',
    );
    for (const verdict of verdicts) {
      lines.push(
        `| \`${verdict.baseRef}\` | ${verdict.prs.map((pr) => `#${pr}`).join(', ')} | ${STATE_MARK[verdict.state]} | ${verdict.detail ?? ''} |`,
      );
    }
  }
  return `${lines.join('\n')}\n`;
}
