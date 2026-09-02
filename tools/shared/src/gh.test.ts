import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Exec } from './exec.ts';
import { createReleasePr, ensureGh, prCreateArgs } from './gh.ts';

// gh pr create prints the new PR's URL, newline-terminated.
const PR_URL_STDOUT = 'https://github.com/o/r/pull/683\n';

// Fake Exec: records argv, replays scripted outcomes.
function recordingExec(
  fail: (
    command: string,
    args: readonly string[],
    call: number,
  ) => boolean = () => false,
): { exec: Exec; calls: string[][] } {
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

describe('ensureGh', () => {
  it('probes gh --version', async () => {
    const { exec, calls } = recordingExec();
    await ensureGh(exec);
    assert.deepEqual(calls, [['gh', '--version']]);
  });

  it('maps a missing binary to install guidance', async () => {
    const { exec } = recordingExec(() => true);
    await assert.rejects(ensureGh(exec), /gh CLI not found/);
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
