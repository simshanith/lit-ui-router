import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  type Deployment,
  PAGES_PROJECT,
  deployVerdict,
  deploymentsFromApi,
  isCommitSha,
  liveProductionDeployment,
} from './pages-deploy.core.ts';

// Expected values live in the fixture so it doubles as documentation of the
// API deployment shape.
type Fixtures = {
  liveCommit: string;
  branchAhead: string;
  deployments: unknown[];
  forbidden: unknown;
};
const fixtures = JSON.parse(
  await readFile(
    join(import.meta.dirname, 'pages-deploy.fixtures.json'),
    'utf8',
  ),
) as Fixtures;
const { liveCommit, branchAhead, forbidden } = fixtures;
const deployments = deploymentsFromApi(fixtures.deployments);

describe('deploymentsFromApi', () => {
  it('accepts the documented deployment shape', () => {
    assert.equal(deployments.length, fixtures.deployments.length);
  });

  it('names the path of a field the check cannot read', () => {
    assert.throws(
      () => deploymentsFromApi([{ ...deployments[0], latest_stage: null }]),
      /0\.latest_stage/,
    );
  });

  it('rejects an envelope result that is not a list', () => {
    assert.throws(() => deploymentsFromApi(null), /unexpected Pages/);
  });
});

describe('liveProductionDeployment', () => {
  it('picks the newest successful production deployment, whatever the order', () => {
    assert.equal(liveProductionDeployment(deployments)?.id, '4a5b6c7d-live');
    assert.equal(
      liveProductionDeployment([...deployments].reverse())?.id,
      '4a5b6c7d-live',
    );
  });

  it('ignores preview deployments', () => {
    const previews = deployments.map((deployment): Deployment => ({
      ...deployment,
      environment: 'preview',
    }));
    assert.equal(liveProductionDeployment(previews), undefined);
  });
});

describe('deployVerdict', () => {
  it('is in sync when production serves the branch head', () => {
    const report = deployVerdict(deployments, liveCommit);
    assert.equal(report.ok, true);
    assert.match(report.text, new RegExp(`deployed commit: ${liveCommit}`));
    assert.match(report.text, /✓ production serves the www\/atlas head/);
  });

  // The newer failed upload of branchAhead must not count as deployed.
  it('owes a deploy when the branch head is not the deployed commit', () => {
    const report = deployVerdict(deployments, branchAhead);
    assert.equal(report.ok, false);
    assert.match(report.text, /a deploy is owed/);
    assert.match(report.text, new RegExp(`deployed commit: ${liveCommit}`));
  });

  it('owes a deploy when no production deployment succeeded', () => {
    const report = deployVerdict([], liveCommit);
    assert.equal(report.ok, false);
    assert.match(report.text, /no successful production deployment/);
  });

  it('owes a deploy when the live deployment recorded no commit', () => {
    const live = liveProductionDeployment(deployments);
    assert.ok(live);
    const report = deployVerdict(
      [{ ...live, deployment_trigger: { type: 'ad_hoc', metadata: null } }],
      liveCommit,
    );
    assert.equal(report.ok, false);
    assert.match(report.text, /deployed commit: \(none recorded\)/);
  });
});

describe('isCommitSha', () => {
  it('accepts only a full lowercase sha', () => {
    assert.equal(isCommitSha(liveCommit), true);
    assert.equal(isCommitSha(liveCommit.slice(0, 12)), false);
    assert.equal(isCommitSha(liveCommit.toUpperCase()), false);
  });
});

describe('pages-deploy CLI', () => {
  const script = join(import.meta.dirname, 'pages-deploy.ts');

  // Preloads a fetch stub, so the CLI's exit code is exercised end to end
  // without reaching Cloudflare.
  const runCheck = (
    args: string[],
    response?: { status: number; body: unknown },
    env: NodeJS.ProcessEnv = {
      CLOUDFLARE_API_TOKEN: 'test-token',
      CLOUDFLARE_ACCOUNT_ID: 'test-account',
    },
  ) => {
    const stub = response
      ? `globalThis.fetch = async (url) => { if (!String(url).includes('/pages/projects/${PAGES_PROJECT}/deployments?env=production')) throw new Error('unexpected ' + url); return new Response(${JSON.stringify(JSON.stringify(response.body))}, { status: ${response.status} }); };`
      : `globalThis.fetch = async () => { throw new Error('fetch failed'); };`;
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        `data:text/javascript,${encodeURIComponent(stub)}`,
        script,
        ...args,
      ],
      {
        encoding: 'utf8',
        // The ambient Cloudflare credentials never reach the stubbed run.
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: undefined,
          CLOUDFLARE_ACCOUNT_ID: undefined,
          ...env,
        },
      },
    );
    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`,
    };
  };

  const ok = (result: unknown) => ({
    status: 200,
    body: { success: true, errors: [], messages: [], result },
  });

  it('exits 0 in sync', () => {
    const { status, output } = runCheck([liveCommit], ok(fixtures.deployments));
    assert.equal(status, 0, output);
    assert.match(output, /✓ production serves/);
  });

  it('exits 1 when a deploy is owed', () => {
    const { status, output } = runCheck(
      [branchAhead],
      ok(fixtures.deployments),
    );
    assert.equal(status, 1, output);
    assert.match(output, /a deploy is owed/);
  });

  it('exits 2 when the token lacks Pages read scope', () => {
    const { status, output } = runCheck([liveCommit], {
      status: 403,
      body: forbidden,
    });
    assert.equal(status, 2, output);
    assert.match(output, /HTTP 403/);
    assert.match(output, /Authentication error/);
    assert.doesNotMatch(output, /test-token/);
  });

  it('exits 2 when Cloudflare is unreachable', () => {
    const { status, output } = runCheck([liveCommit]);
    assert.equal(status, 2, output);
    assert.match(output, /fetch failed/);
  });

  it('exits 2 on a response it cannot read', () => {
    const { status, output } = runCheck([liveCommit], ok({ items: [] }));
    assert.equal(status, 2, output);
    assert.match(output, /unexpected Pages deployments response/);
  });

  it('exits 2 without credentials, before any request', () => {
    const { status, output } = runCheck([liveCommit], undefined, {});
    assert.equal(status, 2, output);
    assert.match(output, /Missing required env/);
  });

  it('prints usage and exits 2 without a full sha', () => {
    for (const args of [[], ['main'], [liveCommit, 'extra']]) {
      const { status, output } = runCheck(args, ok(fixtures.deployments));
      assert.equal(status, 2, output);
      assert.match(output, /usage: pages-deploy\.ts <www\/atlas head sha>/);
    }
  });
});
