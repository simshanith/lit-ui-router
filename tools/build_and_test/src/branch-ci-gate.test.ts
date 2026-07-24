import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type BaseVerdict,
  type OpenPr,
  decide,
  distinctBases,
  mergeStateFromExit,
  parseOpenPrs,
  summaryMarkdown,
} from './branch-ci-gate.core.ts';

const PR_ONE: OpenPr = { number: 1, baseRefName: 'main' };
const PR_TWO: OpenPr = { number: 2, baseRefName: 'main' };
const PR_STACKED: OpenPr = { number: 3, baseRefName: 'feature/base' };

function verdict(
  baseRef: string,
  state: BaseVerdict['state'],
  prs: number[] = [1],
): BaseVerdict {
  return { baseRef, prs, state };
}

describe('parseOpenPrs', () => {
  it('accepts the gh pr list shape', () => {
    assert.deepEqual(
      parseOpenPrs([{ number: 7, baseRefName: 'main', title: 'ignored' }]),
      [{ number: 7, baseRefName: 'main' }],
    );
  });

  it('accepts an empty list — the no-PR case is a real answer', () => {
    assert.deepEqual(parseOpenPrs([]), []);
  });

  it('throws rather than degrade a malformed payload into "no PRs"', () => {
    assert.throws(() => parseOpenPrs({}), /expected a JSON array/);
    assert.throws(() => parseOpenPrs([{ number: 7 }]), /entry 0 is missing/);
    assert.throws(
      () => parseOpenPrs([{ baseRefName: 'main' }]),
      /entry 0 is missing/,
    );
  });
});

describe('distinctBases', () => {
  it('groups PRs sharing a base into one probe', () => {
    assert.deepEqual(distinctBases([PR_ONE, PR_TWO]), [
      { baseRef: 'main', prs: [1, 2] },
    ]);
  });

  it('keeps non-main bases, sorted for a stable summary', () => {
    assert.deepEqual(distinctBases([PR_ONE, PR_STACKED]), [
      { baseRef: 'feature/base', prs: [3] },
      { baseRef: 'main', prs: [1] },
    ]);
  });

  it('is empty for no PRs', () => {
    assert.deepEqual(distinctBases([]), []);
  });
});

describe('mergeStateFromExit', () => {
  // Verbatim shapes from `git merge-tree --write-tree` (git 2.54).
  const CONFLICT_STDOUT = [
    '29a8adccde00fce555a8a4b2e3f6ae2757007c5b',
    '100644 df967b96a579e45a18b8251732d16804b2e56a55 1\tf.txt',
    '',
    'Auto-merging f.txt',
    'CONFLICT (content): Merge conflict in f.txt',
  ].join('\n');
  const UNMERGEABLE_STDOUT = 'merge-tree: nope - not something we can merge\n';

  it('reads a clean merge from exit 0', () => {
    assert.equal(mergeStateFromExit(0), 'clean');
  });

  it('reads a conflict from exit 1 plus the merged tree OID', () => {
    assert.equal(mergeStateFromExit(1, CONFLICT_STDOUT), 'conflict');
  });

  it('does not read an unmergeable ref as a conflict — exit 1 too, no OID', () => {
    assert.equal(mergeStateFromExit(1, UNMERGEABLE_STDOUT), 'unknown');
    assert.equal(mergeStateFromExit(1, ''), 'unknown');
  });

  it('accepts a sha-256 tree OID', () => {
    assert.equal(mergeStateFromExit(1, 'a'.repeat(64)), 'conflict');
  });

  it('treats any other status as indeterminate, not as an answer', () => {
    assert.equal(mergeStateFromExit(128, CONFLICT_STDOUT), 'unknown');
    assert.equal(mergeStateFromExit(null), 'unknown');
  });
});

describe('decide', () => {
  it('runs when no open PR has this branch as its head', () => {
    const decision = decide([], []);
    assert.equal(decision.run, true);
    assert.match(decision.reason, /no open PR/);
  });

  it('skips when every base merges cleanly', () => {
    const decision = decide(
      [PR_ONE, PR_TWO],
      [verdict('main', 'clean', [1, 2])],
    );
    assert.equal(decision.run, false);
    assert.match(decision.reason, /already covers this SHA/);
  });

  it('runs when a base conflicts — pull_request never fires', () => {
    const decision = decide([PR_ONE], [verdict('main', 'conflict')]);
    assert.equal(decision.run, true);
    assert.match(decision.reason, /conflicts with main/);
  });

  it('runs when any one of several bases conflicts', () => {
    const decision = decide(
      [PR_ONE, PR_STACKED],
      [verdict('feature/base', 'clean', [3]), verdict('main', 'conflict')],
    );
    assert.equal(decision.run, true);
    assert.match(decision.reason, /conflicts with main/);
  });

  it('skips only when every base of every PR is clean', () => {
    const decision = decide(
      [PR_ONE, PR_STACKED],
      [verdict('feature/base', 'clean', [3]), verdict('main', 'clean')],
    );
    assert.equal(decision.run, false);
  });

  it('fails open on an indeterminate probe', () => {
    const decision = decide([PR_ONE], [verdict('main', 'unknown')]);
    assert.equal(decision.run, true);
    assert.match(decision.reason, /indeterminate/);
  });

  it('prefers the conflict reason over the indeterminate one', () => {
    const decision = decide(
      [PR_ONE, PR_STACKED],
      [verdict('feature/base', 'unknown', [3]), verdict('main', 'conflict')],
    );
    assert.equal(decision.run, true);
    assert.match(decision.reason, /conflicts with main/);
  });

  it('fails open when PRs exist but no probe ran', () => {
    const decision = decide([PR_ONE], []);
    assert.equal(decision.run, true);
    assert.match(decision.reason, /no merge probe ran/);
  });
});

describe('summaryMarkdown', () => {
  const sha = '0123456789abcdef0123456789abcdef01234567';

  it('explains a skip with the bases it cleared', () => {
    const verdicts = [verdict('main', 'clean', [1, 2])];
    const markdown = summaryMarkdown(
      'topic',
      sha,
      [PR_ONE, PR_TWO],
      verdicts,
      decide([PR_ONE, PR_TWO], verdicts),
    );
    assert.match(markdown, /skipping/);
    assert.match(markdown, /`topic` @ `0123456789ab`/);
    assert.match(markdown, /\| `main` \| #1, #2 \| mergeable \|/);
  });

  it('names the conflicting base on a run', () => {
    const verdicts = [verdict('main', 'conflict')];
    const markdown = summaryMarkdown(
      'topic',
      sha,
      [PR_ONE],
      verdicts,
      decide([PR_ONE], verdicts),
    );
    assert.match(markdown, /running/);
    assert.match(markdown, /CONFLICTS/);
  });

  it('states the no-PR case instead of an empty table', () => {
    const markdown = summaryMarkdown('topic', sha, [], [], decide([], []));
    assert.match(markdown, /No open pull requests/);
    assert.doesNotMatch(markdown, /\| base \|/);
  });
});
