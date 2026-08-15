import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { checkRunApiArgs } from './publish-check-runs.core.ts';
import {
  WORKERS_BUILDS_CHECK_RUN_NAME,
  toWorkersBuildsCheckRun,
} from './workers-builds-check-runs.core.ts';

const REPO = 'simshanith/lit-ui-router';

describe('toWorkersBuildsCheckRun', () => {
  it('maps exit 0 to success', () => {
    const payload = toWorkersBuildsCheckRun(
      { exitCode: 0, output: 'worker: lit-ui-router (abc)\n\nin sync' },
      REPO,
    );
    assert.equal(payload.name, WORKERS_BUILDS_CHECK_RUN_NAME);
    assert.equal(payload.conclusion, 'success');
    assert.match(payload.summary, /in sync/);
  });

  it('maps exit 1 to action_required, never failure', () => {
    const payload = toWorkersBuildsCheckRun(
      { exitCode: 1, output: 'build_command: "a" != "b"' },
      REPO,
    );
    assert.equal(payload.conclusion, 'action_required');
    assert.match(payload.title, /drift/);
    assert.match(payload.summary, /build_command/);
    // CI is read-only by design: the resolve path is a local --apply.
    assert.match(payload.summary, /--apply/);
  });

  it('maps exit 2 to neutral so an observer failure never reads as drift', () => {
    const missingSecret = toWorkersBuildsCheckRun(
      { exitCode: 2, output: 'Missing required env: set CLOUDFLARE_API_TOKEN' },
      REPO,
    );
    assert.equal(missingSecret.conclusion, 'neutral');
    assert.match(missingSecret.title, /observer error/);
    assert.match(missingSecret.summary, /CLOUDFLARE_API_TOKEN/);
  });

  it('treats any unexpected exit code as an observer failure', () => {
    for (const exitCode of [3, 127, 137]) {
      assert.equal(
        toWorkersBuildsCheckRun({ exitCode, output: '' }, REPO).conclusion,
        'neutral',
      );
    }
  });

  it('omits the report block when the CLI printed nothing', () => {
    const payload = toWorkersBuildsCheckRun(
      { exitCode: 2, output: '  ' },
      REPO,
    );
    assert.doesNotMatch(payload.summary, /```/);
  });

  it('truncates a runaway report to stay under the Checks API summary cap', () => {
    const payload = toWorkersBuildsCheckRun(
      { exitCode: 1, output: 'x'.repeat(200_000) },
      REPO,
    );
    assert.ok(payload.summary.length < 65_535);
    assert.match(payload.summary, /report truncated/);
  });

  it('feeds the shared gh api argv builder', () => {
    const payload = toWorkersBuildsCheckRun(
      { exitCode: 0, output: 'ok' },
      REPO,
    );
    const args = checkRunApiArgs(REPO, 'deadbeef', payload);
    assert.deepEqual(args.slice(0, 2), ['api', `repos/${REPO}/check-runs`]);
    assert.ok(args.includes(`name=${WORKERS_BUILDS_CHECK_RUN_NAME}`));
    assert.ok(args.includes('conclusion=success'));
  });
});
