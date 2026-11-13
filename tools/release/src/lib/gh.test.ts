import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Exec } from '@tools/shared/exec.ts';
import {
  createReleasePr,
  enableAutoMergeArgs,
  enableReleasePrAutoMerge,
  prCreateArgs,
  prNodeIdArgs,
} from './gh.ts';

// gh pr create prints the new PR's URL, newline-terminated.
const PR_URL_STDOUT = 'https://github.com/o/r/pull/683\n';

// Fake Exec: records argv, replays scripted outcomes.
function recordingExec(
  fail: (
    command: string,
    args: readonly string[],
    call: number,
  ) => boolean = () => false,
) {
  const calls: string[][] = [];

  const exec: Exec = (command, args) => {
    calls.push([command, ...args]);

    return fail(command, args, calls.length)
      ? Promise.reject(new Error('scripted failure'))
      : Promise.resolve({ stdout: PR_URL_STDOUT, stderr: '' });
  };

  return { exec, calls };
}

describe('prCreateArgs', () => {
  it('matches bump-version.yml Create PR argv verbatim', () => {
    assert.deepEqual(prCreateArgs('main', 'release/lit-ui-router/v1.8.0'), [
      'pr',
      'create',
      '--base',
      'main',
      '--head',
      'release/lit-ui-router/v1.8.0',
      '--fill-verbose',
      '--label',
      'release',
    ]);
  });

  it('rejects blank branch names', () => {
    assert.throws(() => prCreateArgs('', 'x'), /base/);
    assert.throws(() => prCreateArgs('main', ' '), /head/);
  });
});

describe('createReleasePr', () => {
  it('guards, creates the PR with the exact argv, returns its URL', async () => {
    const { exec, calls } = recordingExec();
    const url = await createReleasePr('main', 'release/pkg/v1.0.0', exec);
    assert.equal(url, 'https://github.com/o/r/pull/683');
    assert.deepEqual(calls, [
      ['gh', '--version'],
      [
        'gh',
        'pr',
        'create',
        '--base',
        'main',
        '--head',
        'release/pkg/v1.0.0',
        '--fill-verbose',
        '--label',
        'release',
      ],
    ]);
  });
});

describe('prNodeIdArgs', () => {
  it('views the PR id by URL', () => {
    assert.deepEqual(prNodeIdArgs('https://github.com/o/r/pull/683'), [
      'pr',
      'view',
      'https://github.com/o/r/pull/683',
      '--json',
      'id',
      '--jq',
      '.id',
    ]);
  });

  it('rejects a blank URL', () => {
    assert.throws(() => prNodeIdArgs(' '), /prUrl/);
  });
});

describe('enableAutoMergeArgs', () => {
  it('runs the squash enablePullRequestAutoMerge mutation for the id', () => {
    const args = enableAutoMergeArgs('PR_kw1');
    assert.deepEqual(args.slice(0, 3), ['api', 'graphql', '-f']);
    assert.match(args[3] ?? '', /^query=mutation/);
    assert.match(args[3] ?? '', /enablePullRequestAutoMerge/);
    assert.match(args[3] ?? '', /mergeMethod: SQUASH/);
    assert.deepEqual(args.slice(4), ['-f', 'pullRequestId=PR_kw1']);
  });

  it('rejects a blank id', () => {
    assert.throws(() => enableAutoMergeArgs(''), /pullRequestId/);
  });
});

describe('enableReleasePrAutoMerge', () => {
  const url = 'https://github.com/o/r/pull/683';

  function autoMergeExec(enableFails: () => boolean = () => false) {
    const calls: string[][] = [];

    const exec: Exec = (command, args) => {
      calls.push([command, ...args]);

      if (args[0] === 'api' && enableFails()) {
        return Promise.reject(
          new Error('GraphQL: Pull request Pull request is in clean status'),
        );
      }

      return Promise.resolve({
        stdout: args[0] === 'pr' ? 'PR_kw1\n' : '{}',
        stderr: '',
      });
    };

    return { exec, calls };
  }

  it('guards, resolves the node id, then enables auto-merge on it', async () => {
    const { exec, calls } = autoMergeExec();
    await enableReleasePrAutoMerge(url, exec);
    assert.deepEqual(calls, [
      ['gh', '--version'],
      ['gh', ...prNodeIdArgs(url)],
      ['gh', ...enableAutoMergeArgs('PR_kw1')],
    ]);
  });

  it('fails loudly when GitHub keeps refusing to enable auto-merge', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { exec, calls } = autoMergeExec(() => true);
    const pending = enableReleasePrAutoMerge(url, exec);

    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
      t.mock.timers.tick(10_000);
    }

    await assert.rejects(pending, /clean status/);
    assert.equal(calls.filter(([, sub]) => sub === 'api').length, 3);
  });
});
