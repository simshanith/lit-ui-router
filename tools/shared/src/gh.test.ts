import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Exec } from './exec.ts';
import { ensureGh } from './gh.ts';

// Fake Exec: records argv, fails every call when told to.
function recordingExec(fail = false) {
  const calls: string[][] = [];

  const exec: Exec = (command, args) => {
    calls.push([command, ...args]);

    return fail
      ? Promise.reject(new Error('scripted failure'))
      : Promise.resolve({ stdout: '', stderr: '' });
  };

  return { exec, calls };
}

describe('ensureGh', () => {
  it('probes gh --version', async () => {
    const { exec, calls } = recordingExec();
    await ensureGh(exec);
    assert.deepEqual(calls, [['gh', '--version']]);
  });

  it('maps a missing binary to install guidance', async () => {
    const { exec } = recordingExec(true);
    await assert.rejects(ensureGh(exec), /gh CLI not found/);
  });
});
