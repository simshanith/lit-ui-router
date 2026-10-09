import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { checkRunApiArgs } from './publish-check-runs.core.ts';
import {
  PAGES_DEPLOY_CHECK_RUN_NAME,
  branchHeadApiArgs,
  parseBranchHead,
  toPagesDeployCheckRun,
} from './pages-deploy-check-runs.core.ts';

const REPO = 'simshanith/lit-ui-router';
const HEAD = '7c893cda19015bdc5e50629e13808e89d7c5da34';

describe('PAGES_DEPLOY_CHECK_RUN_NAME', () => {
  it('is the name the www/DEPLOY.md badge filters on', () => {
    assert.equal(PAGES_DEPLOY_CHECK_RUN_NAME, 'pages-deploy (altitude-atlas)');
  });
});

describe('branchHeadApiArgs', () => {
  it('reads the www/atlas ref, not main', () => {
    assert.deepEqual(branchHeadApiArgs(REPO), [
      'api',
      `repos/${REPO}/git/ref/heads/www/atlas`,
      '--jq',
      '.object.sha',
    ]);
  });
});

describe('parseBranchHead', () => {
  it('returns the printed sha', () => {
    assert.equal(parseBranchHead(`${HEAD}\n`), HEAD);
  });

  it('throws on anything but a full sha', () => {
    assert.throws(() => parseBranchHead(''), /did not resolve/);
    assert.throws(() => parseBranchHead('null\n'), /did not resolve/);
  });
});

describe('toPagesDeployCheckRun', () => {
  it('maps exit 0 to success', () => {
    const payload = toPagesDeployCheckRun({
      exitCode: 0,
      output: '✓ production serves the www/atlas head.',
    });
    assert.equal(payload.name, PAGES_DEPLOY_CHECK_RUN_NAME);
    assert.equal(payload.conclusion, 'success');
    assert.match(payload.summary, /production serves/);
  });

  it('maps exit 1 to action_required, never failure', () => {
    const payload = toPagesDeployCheckRun({
      exitCode: 1,
      output:
        '✗ production does not serve the www/atlas head; a deploy is owed.',
    });
    assert.equal(payload.conclusion, 'action_required');
    assert.match(payload.title, /a deploy is owed/);
    assert.match(payload.summary, /release-signals/);
  });

  it('maps exit 2 to neutral so a 403 never reads as a deploy owed', () => {
    const payload = toPagesDeployCheckRun({
      exitCode: 2,
      output:
        'Cloudflare API GET /x/pages/projects/altitude-atlas/deployments?env=production failed (HTTP 403) — 10000: Authentication error',
    });
    assert.equal(payload.conclusion, 'neutral');
    assert.match(payload.title, /observer error/);
    assert.match(payload.summary, /HTTP 403/);
  });

  it('treats any unexpected exit code as an observer failure', () => {
    for (const exitCode of [3, 127, 137]) {
      assert.equal(
        toPagesDeployCheckRun({ exitCode, output: '' }).conclusion,
        'neutral',
      );
    }
  });

  it('feeds the shared gh api argv builder on the branch head', () => {
    const payload = toPagesDeployCheckRun({ exitCode: 0, output: 'ok' });
    const args = checkRunApiArgs(REPO, HEAD, payload);
    assert.ok(args.includes(`name=${PAGES_DEPLOY_CHECK_RUN_NAME}`));
    assert.ok(args.includes(`head_sha=${HEAD}`));
    assert.ok(args.includes('conclusion=success'));
  });
});
