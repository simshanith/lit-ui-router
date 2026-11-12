// `Reverts: #2017` (the commit convention), GitHub's `Reverts owner/repo#2017`.
const REVERTS_PR = /^Reverts:?\s+(?:[\w.-]+\/[\w.-]+)?#(\d+)\s*$/gim;

// git's own revert body line.
const REVERTS_SHA = /This reverts commit ([0-9a-f]{7,64})\b/g;

const PR_SUFFIX = /\(#(\d+)\)\s*$/;

/** The parsed-commit fields revert pairing reads. */
export interface RevertableCommit {
  hash?: string | null;
  type?: string | null;
  header?: string | null;
  body?: string | null;
  footer?: string | null;
}

export interface CancelledPair<C> {
  role: 'reverts' | 'revertedBy';
  partner: C;
}

/** The PR a squash commit landed from, read off its `(#N)` subject suffix. */
export function prNumber(
  header: string | null | undefined,
): string | undefined {
  return header ? PR_SUFFIX.exec(header)?.[1] : undefined;
}

function isRevert(commit: RevertableCommit): boolean {
  return (
    commit.type?.toLowerCase() === 'revert' ||
    commit.header?.startsWith('Revert "') === true
  );
}

function captures(text: string, pattern: RegExp): string[] {
  return Array.from(text.matchAll(pattern), (match) => match[1] ?? '').filter(
    Boolean,
  );
}

/** The commits a revert names, as PR numbers and (abbreviated) hashes. */
export interface RevertRefs {
  prs: string[];
  hashes: string[];
}

export function revertRefs(commit: RevertableCommit): RevertRefs {
  if (!isRevert(commit)) return { prs: [], hashes: [] };

  const text = `${commit.body ?? ''}\n${commit.footer ?? ''}`;

  return {
    prs: captures(text, REVERTS_PR),
    hashes: captures(text, REVERTS_SHA),
  };
}

function revertTarget<C extends RevertableCommit>(
  commit: C,
  commits: readonly C[],
): C | undefined {
  const { prs, hashes } = revertRefs(commit);

  return commits.find((candidate) => {
    if (candidate === commit) return false;

    const pr = prNumber(candidate.header);

    return (
      (pr !== undefined && prs.includes(pr)) ||
      hashes.some((hash) => candidate.hash?.startsWith(hash) === true)
    );
  });
}

/**
 * Pairs each revert with the commit it cancels inside the same range. Walks
 * newest first, as git logs them, so a revert of a revert cancels the first
 * revert and leaves the original standing.
 *
 * @param commits newest first
 */
export function cancelledCommits<C extends RevertableCommit>(
  commits: readonly C[],
): Map<C, CancelledPair<C>> {
  const cancelled = new Map<C, CancelledPair<C>>();

  for (const commit of commits) {
    if (cancelled.has(commit)) continue;

    const target = revertTarget(commit, commits);

    if (target === undefined || cancelled.has(target)) continue;

    cancelled.set(commit, { role: 'reverts', partner: target });
    cancelled.set(target, { role: 'revertedBy', partner: commit });
  }

  return cancelled;
}
