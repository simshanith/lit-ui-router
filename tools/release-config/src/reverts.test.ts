import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cancelledCommits, prNumber, revertRefs } from './reverts.js';

interface Commit {
  hash: string;
  type: string;
  header: string;
  body?: string;
  footer?: string;
}

const commit = (
  hash: string,
  header: string,
  body?: string,
  footer?: string,
): Commit => ({
  hash,
  type: /^(\w+)/.exec(header)?.[1] ?? '',
  header,
  body,
  footer,
});

function roles(commits: Commit[]) {
  return [...cancelledCommits(commits)].map(
    ([c, { role, partner }]) => `${c.hash} ${role} ${partner.hash}`,
  );
}

describe('revertRefs', () => {
  it('reads the Reverts trailer, GitHub’s line and git’s sentence', () => {
    assert.deepEqual(
      revertRefs(
        commit(
          'r',
          'revert(a): hold back x (#3)',
          'Reverts owner/repo#1\n\nThis reverts commit 0123abcd.',
          'Reverts: #2',
        ),
      ),
      { prs: ['1', '2'], hashes: ['0123abcd'] },
    );
  });

  it('reads nothing off a commit that is not a revert', () => {
    assert.deepEqual(
      revertRefs(commit('f', 'feat(a): x (#4)', undefined, 'Reverts: #2')),
      { prs: [], hashes: [] },
    );
  });
});

describe('prNumber', () => {
  it('reads the squash suffix only', () => {
    assert.equal(prNumber('feat(a): x (#12)'), '12');
    assert.equal(prNumber('feat(a): handle #12 links'), undefined);
  });
});

describe('cancelledCommits', () => {
  it('cancels a revert and its target, leaving the re-land (newest first)', () => {
    const land = commit('aaaa', 'feat(b): carry the base (#1)');

    const revert = commit(
      'bbbb',
      'revert(a): hold back the base (#2)',
      undefined,
      'Reverts: #1',
    );

    const reland = commit('cccc', 'feat(a): prerender under the base (#3)');

    assert.deepEqual(roles([reland, revert, land]), [
      'bbbb reverts aaaa',
      'aaaa revertedBy bbbb',
    ]);
  });

  it('matches git’s sentence by hash prefix', () => {
    const land = commit('1234567890abcdef', 'feat(a): x (#1)');

    const revert = commit(
      'ffff',
      'revert: x (#2)',
      'This reverts commit 1234567890ab.',
    );

    assert.deepEqual(roles([revert, land]), [
      'ffff reverts 1234567890abcdef',
      '1234567890abcdef revertedBy ffff',
    ]);
  });

  it('keeps a revert whose target is outside the range', () => {
    assert.deepEqual(
      roles([commit('r', 'revert(a): x (#9)', undefined, 'Reverts: #1')]),
      [],
    );
  });

  it('lets a revert of a revert restore the original', () => {
    const land = commit('a', 'feat(a): x (#1)');
    const revert = commit('b', 'revert(a): x (#2)', undefined, 'Reverts: #1');

    const unrevert = commit(
      'c',
      'revert(a): restore x (#3)',
      undefined,
      'Reverts: #2',
    );

    assert.deepEqual(roles([unrevert, revert, land]), [
      'c reverts b',
      'b revertedBy c',
    ]);
  });
});
