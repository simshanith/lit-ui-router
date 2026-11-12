// `Reverts: #2017` (the commit convention), GitHub's `Reverts owner/repo#2017`.
const REVERTS_PR = /^Reverts:?\s+(?:[\w.-]+\/[\w.-]+)?#(\d+)\s*$/gim;

// git's own revert body line.
const REVERTS_SHA = /This reverts commit ([0-9a-f]{7,64})\b/g;

const PR_SUFFIX = /\(#(\d+)\)\s*$/;

/**
 * @typedef {{
 *   hash?: string | null;
 *   type?: string | null;
 *   header?: string | null;
 *   body?: string | null;
 *   footer?: string | null;
 * }} RevertableCommit
 */

/**
 * The PR a squash commit landed from, read off its `(#N)` subject suffix.
 *
 * @param {string | null | undefined} header
 */
export function prNumber(header) {
  return header?.match(PR_SUFFIX)?.[1];
}

/** @param {RevertableCommit} commit */
function isRevert(commit) {
  return (
    commit.type?.toLowerCase() === 'revert' ||
    /^Revert "/.test(commit.header ?? '')
  );
}

/**
 * The commits a revert names, as PR numbers and (abbreviated) hashes.
 *
 * @param {RevertableCommit} commit
 */
export function revertRefs(commit) {
  if (!isRevert(commit)) return { prs: [], hashes: [] };

  const text = `${commit.body ?? ''}\n${commit.footer ?? ''}`;

  return {
    prs: Array.from(text.matchAll(REVERTS_PR), ([, pr]) => pr),
    hashes: Array.from(text.matchAll(REVERTS_SHA), ([, hash]) => hash),
  };
}

/**
 * @template {RevertableCommit} C
 * @param {C} commit
 * @param {C[]} commits
 */
function revertTarget(commit, commits) {
  const { prs, hashes } = revertRefs(commit);

  return commits.find(
    (candidate) =>
      candidate !== commit &&
      (prs.includes(prNumber(candidate.header) ?? '') ||
        hashes.some((hash) => candidate.hash?.startsWith(hash))),
  );
}

/**
 * Pairs each revert with the commit it cancels inside the same range. Walks
 * newest first, as git logs them, so a revert of a revert cancels the first
 * revert and leaves the original standing.
 *
 * @template {RevertableCommit} C
 * @param {C[]} commits newest first
 * @returns {Map<C, { role: 'reverts' | 'revertedBy'; partner: C }>}
 */
export function cancelledCommits(commits) {
  const cancelled = new Map();

  for (const commit of commits) {
    if (cancelled.has(commit)) continue;

    const target = revertTarget(commit, commits);

    if (target === undefined || cancelled.has(target)) continue;

    cancelled.set(commit, { role: 'reverts', partner: target });
    cancelled.set(target, { role: 'revertedBy', partner: commit });
  }

  return cancelled;
}
