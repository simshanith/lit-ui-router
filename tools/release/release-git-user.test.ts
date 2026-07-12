import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { gitUserConfigArgs } from './release-git-user.core.ts';

describe('gitUserConfigArgs', () => {
  it('pins the exact bot identity the workflows configured', () => {
    assert.deepEqual(gitUserConfigArgs(), [
      ['config', '--global', 'user.name', 'github-actions[bot]'],
      [
        'config',
        '--global',
        'user.email',
        'github-actions[bot]@users.noreply.github.com',
      ],
    ]);
  });
});

describe('release-git-user.ts', () => {
  it('refuses to run outside GitHub Actions (would clobber --global config)', () => {
    const scriptPath = fileURLToPath(
      new URL('./release-git-user.ts', import.meta.url),
    );
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_ACTIONS: '' },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /refusing to write --global git config/);
  });
});
