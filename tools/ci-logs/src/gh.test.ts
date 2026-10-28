import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Exec } from '@tools/shared/exec.ts';

import {
  artifactListArgs,
  downloadArgs,
  downloadArtifact,
  listArtifacts,
  parseArtifactListing,
  runViewArgs,
  viewRun,
} from './gh.ts';

// Fake Exec: records argv, replays one scripted stdout.
function recordingExec(stdout = '') {
  const calls: string[][] = [];

  const exec: Exec = (command, args) => {
    calls.push([command, ...args]);

    return Promise.resolve({ stdout, stderr: '' });
  };

  return { exec, calls };
}

const RUN_VIEW = {
  databaseId: 38828991098,
  workflowName: 'Build and Test',
  displayTitle: 'feat: x',
  event: 'push',
  headBranch: 'main',
  headSha: 'b35db797',
  conclusion: 'success',
  url: 'https://github.com/o/r/actions/runs/38828991098',
};

describe('argv', () => {
  it('views the run with every header field', () => {
    assert.deepEqual(runViewArgs('38828991098'), [
      'run',
      'view',
      '38828991098',
      '--json',
      'databaseId,workflowName,displayTitle,event,headBranch,headSha,conclusion,url',
    ]);
  });

  it('lists every page of artifacts as name and expired', () => {
    assert.deepEqual(artifactListArgs('38828991098'), [
      'api',
      '--paginate',
      'repos/{owner}/{repo}/actions/runs/38828991098/artifacts',
      '--jq',
      '.artifacts[] | {name, expired}',
    ]);
  });

  it('downloads one artifact by name into its own directory', () => {
    assert.deepEqual(
      downloadArgs(
        '38828991098',
        'turbo-task-logs-docs',
        '/tmp/x/turbo-task-logs-docs',
      ),
      [
        'run',
        'download',
        '38828991098',
        '-n',
        'turbo-task-logs-docs',
        '--dir',
        '/tmp/x/turbo-task-logs-docs',
      ],
    );
  });
});

describe('the gh edge', () => {
  it('parses the run view', async () => {
    const { exec, calls } = recordingExec(JSON.stringify(RUN_VIEW));

    assert.deepEqual(await viewRun('38828991098', exec), RUN_VIEW);
    assert.deepEqual(calls, [['gh', ...runViewArgs('38828991098')]]);
  });

  it('parses one artifact per line, skipping the trailing newline', async () => {
    const { exec, calls } = recordingExec(
      '{"name":"turbo-task-logs","expired":true}\n{"name":"turbo-run-summaries","expired":false}\n',
    );

    assert.deepEqual(await listArtifacts('1', exec), [
      { name: 'turbo-task-logs', expired: true },
      { name: 'turbo-run-summaries', expired: false },
    ]);
    assert.deepEqual(calls, [['gh', ...artifactListArgs('1')]]);
  });

  it('reads an empty listing as no artifacts', () => {
    assert.deepEqual(parseArtifactListing(''), []);
  });

  it('downloads with the exact argv', async () => {
    const { exec, calls } = recordingExec();

    await downloadArtifact('1', 'turbo-run-summaries', '/tmp/d', exec);
    assert.deepEqual(calls, [
      ['gh', ...downloadArgs('1', 'turbo-run-summaries', '/tmp/d')],
    ]);
  });
});
