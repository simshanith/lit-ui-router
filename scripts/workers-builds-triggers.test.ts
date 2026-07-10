import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  type DesiredState,
  type Trigger,
  classifyTrigger,
  diffTriggers,
  parseJsonc,
  workerNameFromConfig,
} from './workers-builds-triggers.core.ts';

const desired: DesiredState = {
  productionBranch: 'main',
  production: {
    build_command: 'npx turbo docs#build',
    deploy_command: 'pnpm wrangler deploy',
  },
  preview: {
    build_command: 'npx turbo docs#build',
    deploy_command: 'pnpm wrangler versions upload',
  },
};

const production: Trigger = {
  trigger_uuid: 'prod-uuid',
  trigger_name: 'Deploy production',
  build_command: 'npx turbo docs#build',
  deploy_command: 'pnpm wrangler deploy',
  branch_includes: ['main'],
  branch_excludes: [],
};

const preview: Trigger = {
  trigger_uuid: 'preview-uuid',
  trigger_name: 'Preview',
  build_command: 'npx turbo docs#build',
  deploy_command: 'pnpm wrangler versions upload',
  branch_includes: ['*'],
  branch_excludes: ['main'],
};

describe('parseJsonc', () => {
  it('parses the repo wrangler.jsonc (comments + trailing commas)', async () => {
    const raw = await readFile(
      join(import.meta.dirname, '..', 'wrangler.jsonc'),
      'utf8',
    );
    assert.equal(workerNameFromConfig(parseJsonc(raw)), 'lit-ui-router');
  });

  it('leaves comment-like content inside strings alone', () => {
    assert.deepEqual(parseJsonc('{"url": "https://x", /* gone */ "a": 1,}'), {
      url: 'https://x',
      a: 1,
    });
  });

  it('handles escaped quotes and line comments', () => {
    assert.deepEqual(parseJsonc('{"a": "q\\"//not a comment"} // trailing'), {
      a: 'q"//not a comment',
    });
  });
});

describe('workerNameFromConfig', () => {
  it('throws when name is missing', () => {
    assert.throws(() => workerNameFromConfig({}), /no "name" field/);
    assert.throws(() => workerNameFromConfig(null), /no "name" field/);
  });
});

describe('classifyTrigger', () => {
  it('marks the main-building trigger production', () => {
    assert.equal(classifyTrigger(production, 'main'), 'production');
  });

  it('marks wildcard-with-main-excluded triggers preview', () => {
    assert.equal(classifyTrigger(preview, 'main'), 'preview');
  });

  it('treats a trigger with no branch config as preview', () => {
    assert.equal(classifyTrigger({ trigger_uuid: 'x' }, 'main'), 'preview');
  });
});

describe('diffTriggers', () => {
  it('passes when both triggers match', () => {
    const { report, drifts } = diffTriggers([production, preview], desired);
    assert.equal(report.ok, true);
    assert.deepEqual(drifts, []);
    assert.match(report.text, /✓ Workers Builds triggers match/);
  });

  it('emits a PATCH body containing only the drifted pinned fields', () => {
    const drifted = { ...preview, deploy_command: 'npx wrangler deploy' };
    const { report, drifts } = diffTriggers([production, drifted], desired);
    assert.equal(report.ok, false);
    assert.deepEqual(drifts, [
      {
        trigger_uuid: 'preview-uuid',
        kind: 'preview',
        patch: { deploy_command: 'pnpm wrangler versions upload' },
      },
    ]);
    assert.match(report.text, /wanted: pnpm wrangler versions upload/);
  });

  it('never drifts on unpinned fields like root_directory', () => {
    const withRoot = { ...production, root_directory: '/docs' };
    const { report, drifts } = diffTriggers([withRoot, preview], desired);
    assert.equal(report.ok, true);
    assert.deepEqual(drifts, []);
    assert.match(report.text, /root_directory {5}\/docs \(not pinned\)/);
  });

  it('reports a missing trigger kind as unfixable drift', () => {
    const { report, drifts } = diffTriggers([production], desired);
    assert.equal(report.ok, false);
    assert.deepEqual(drifts, []);
    assert.match(report.text, /no preview trigger found/);
  });
});
