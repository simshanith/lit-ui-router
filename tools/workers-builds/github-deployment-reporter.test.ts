import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import type { Json } from '@tools/bootstrap/types.ts';
import * as v from 'valibot';

import {
  ListedDeploymentsSchema,
  OUTPUT_DIRECTORY_ENV,
  OUTPUT_PATH_ENV,
  TOKEN_ENV,
  childPlan,
  ciContext,
  deploymentRequests,
  exitCodeOf,
  isStillActive,
  parseOutputEntries,
  previewTarget,
  redact,
  reporterArgs,
  supersededDeploymentIds,
} from './github-deployment-reporter.core.ts';
import { report } from './github-deployment-reporter.ts';

type Fixtures = {
  sha: string;
  buildUuid: string;
  branch: string;
  versionsUpload: Json[];
  previewsDeploy: Json[];
  failed: Json[];
};

// SAFETY: the checked-in fixture file is authored in the Fixtures shape
const fixtures = JSON.parse(
  await readFile(
    join(import.meta.dirname, 'github-deployment-reporter.fixtures.json'),
    'utf8',
  ),
) as Fixtures;

const ndjson = (lines: readonly Json[]): string =>
  lines.map((line) => `${JSON.stringify(line)}\n`).join('');

const ciEnv = {
  WORKERS_CI_COMMIT_SHA: fixtures.sha,
  WORKERS_CI_BRANCH: fixtures.branch,
  WORKERS_CI_BUILD_UUID: fixtures.buildUuid,
};

const TOKEN = 'github_pat_11AAAAAAA0abcdefghijklmnopqrstuvwxyz0123456789';

describe('parseOutputEntries', () => {
  it('reads the version-upload entry and skips the session line', () => {
    const entries = parseOutputEntries(ndjson(fixtures.versionsUpload));

    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.type, 'version-upload');
  });

  it('ignores entry types it does not report', () => {
    assert.deepEqual(parseOutputEntries(ndjson(fixtures.failed)), []);
    assert.deepEqual(parseOutputEntries(''), []);
  });

  it('throws on a line that is not JSON', () => {
    assert.throws(() => parseOutputEntries('{"type":\n'), SyntaxError);
  });

  it('throws on a preview entry with a malformed URL', () => {
    assert.throws(
      () =>
        parseOutputEntries(
          ndjson([
            { type: 'version-upload', worker_name: 'w', preview_url: 'nope' },
          ]),
        ),
      /output line 1: preview_url/,
    );
  });
});

describe('previewTarget', () => {
  it('points a versions upload at its commit preview, with the branch alias beside it', () => {
    const target = previewTarget(
      parseOutputEntries(ndjson(fixtures.versionsUpload)),
    );

    assert.deepEqual(target, {
      ok: true,
      target: {
        kind: 'version-upload',
        worker: 'lit-ui-router',
        url: 'https://2bb6eca1-lit-ui-router.shane-cf1.workers.dev',
        aliasUrl:
          'https://docs-v1-snapshot-llms-full-lit-ui-router.shane-cf1.workers.dev',
        id: '2bb6eca1-5d0e-4c8f-9a3b-7e6f5d4c3b2a',
      },
    });
  });

  it('points a Workers Preview at its deployment URL', () => {
    const target = previewTarget(
      parseOutputEntries(ndjson(fixtures.previewsDeploy)),
    );

    assert.ok(target.ok);
    assert.equal(
      target.target.url,
      'https://a1b2c3d4-release-ledger.shane-cf1.workers.dev',
    );
    assert.equal(target.target.worker, 'release-ledger');
  });

  it('explains an upload without preview URLs', () => {
    const target = previewTarget(
      parseOutputEntries(
        ndjson([{ type: 'version-upload', worker_name: 'w', version_id: 'x' }]),
      ),
    );

    assert.equal(target.ok, false);
  });
});

describe('deploymentRequests', () => {
  it('builds a transient preview/<worker> deployment that never auto-merges', () => {
    const target = previewTarget(
      parseOutputEntries(ndjson(fixtures.versionsUpload)),
    );

    const ci = ciContext(ciEnv);
    assert.ok(target.ok && ci.ok);

    const { deployment, status } = deploymentRequests(target.target, ci.ci);

    assert.equal(deployment.ref, fixtures.sha);
    assert.equal(deployment.environment, 'preview/lit-ui-router');
    assert.equal(deployment.auto_merge, false);
    assert.deepEqual(deployment.required_contexts, []);
    assert.equal(deployment.transient_environment, true);
    assert.equal(status.state, 'success');
    assert.equal(status.auto_inactive, true);
    assert.equal(
      status.environment_url,
      'https://2bb6eca1-lit-ui-router.shane-cf1.workers.dev',
    );
    assert.match(String(status.log_url), /\/:account\/.*\/builds\/963e54c1-/);
  });

  it('refuses a short sha', () => {
    assert.equal(ciContext({ WORKERS_CI_COMMIT_SHA: '99c2ed6f' }).ok, false);
  });
});

describe('supersededDeploymentIds and isStillActive', () => {
  const at = (minute: number) =>
    `2026-11-19T04:${String(minute).padStart(2, '0')}:00Z`;

  it('keeps the same branch, drops this deployment and foreign payloads', () => {
    const listed = v.parse(ListedDeploymentsSchema, [
      { id: 3, created_at: at(3), payload: { branch: 'a' } },
      { id: 2, created_at: at(2), payload: { branch: 'b' } },
      { id: 1, created_at: at(1), payload: 'free text' },
      { id: 0, created_at: at(0), payload: { branch: 'a' } },
    ]);

    assert.deepEqual(supersededDeploymentIds(listed, 'a', 3), [0]);
    assert.throws(() => v.parse(ListedDeploymentsSchema, { message: 'x' }));
  });

  // A rerun of an older build reports after the branch has moved on.
  it('never retires a newer deployment on the branch', () => {
    const listed = v.parse(ListedDeploymentsSchema, [
      { id: 12, created_at: at(12), payload: { branch: 'a' } },
      { id: 13, created_at: at(10), payload: { branch: 'a' } },
      { id: 11, created_at: at(10), payload: { branch: 'a' } },
      { id: 10, created_at: at(5), payload: { branch: 'a' } },
    ]);

    assert.deepEqual(supersededDeploymentIds(listed, 'a', 11), [10]);
    assert.deepEqual(supersededDeploymentIds(listed, 'a', 99), []);
  });

  it('reads the newest status', () => {
    assert.equal(isStillActive([{ state: 'success' }]), true);
    assert.equal(isStillActive([]), true);
    assert.equal(
      isStillActive([{ state: 'inactive' }, { state: 'success' }]),
      false,
    );
  });
});

describe('redact', () => {
  it('scrubs the token itself and any GitHub-token-shaped string', () => {
    const text = `Bearer ${TOKEN} and ghp_${'a'.repeat(36)}`;

    assert.equal(redact(text, [TOKEN]), 'Bearer *** and ***');
    assert.equal(redact('nothing here', [undefined, '']), 'nothing here');
  });
});

describe('childPlan', () => {
  it('strips the token from the child and points wrangler at a temp file', () => {
    const plan = childPlan(
      { [TOKEN_ENV]: TOKEN, PATH: '/bin' },
      '/tmp/out.ndjson',
    );

    assert.equal(plan.env[TOKEN_ENV], undefined);
    assert.equal(plan.env.PATH, '/bin');
    assert.equal(plan.env[OUTPUT_PATH_ENV], '/tmp/out.ndjson');
    assert.deepEqual(plan.source, {
      kind: 'file',
      path: '/tmp/out.ndjson',
      owned: true,
    });
  });

  it('keeps an output location the caller already set', () => {
    assert.deepEqual(
      childPlan({ [OUTPUT_PATH_ENV]: '/cf/out.json' }, '/tmp/x').source,
      { kind: 'file', path: '/cf/out.json', owned: false },
    );
    assert.deepEqual(childPlan({ [OUTPUT_DIRECTORY_ENV]: '/cf' }, '/tmp/x'), {
      env: { [OUTPUT_DIRECTORY_ENV]: '/cf' },
      source: { kind: 'directory', path: '/cf' },
    });
  });
});

describe('reporterArgs and exitCodeOf', () => {
  it('passes everything after -- through verbatim', () => {
    assert.deepEqual(
      reporterArgs(['--dry-run', '--', 'deploy', 'branch', '--', 'x']),
      {
        ok: true,
        args: {
          dryRun: true,
          flags: [],
          command: ['deploy', 'branch', '--', 'x'],
        },
      },
    );
    assert.equal(reporterArgs(['deploy']).ok, false);
    assert.equal(reporterArgs(['--']).ok, false);
  });

  it('reports a signal as 128 + its number', () => {
    assert.equal(exitCodeOf(3, null), 3);
    assert.equal(exitCodeOf(null, 'SIGTERM'), 143);
  });
});

describe('report', () => {
  const output = ndjson(fixtures.versionsUpload);

  it('skips a failed deploy', async () => {
    assert.deepEqual(
      await report({
        exitCode: 1,
        output,
        env: { ...ciEnv, [TOKEN_ENV]: TOKEN },
        dryRun: false,
      }),
      { outcome: 'skipped', reason: 'the command exited 1' },
    );
  });

  it('skips without a token', async () => {
    const result = await report({
      exitCode: 0,
      output,
      env: ciEnv,
      dryRun: false,
    });

    assert.deepEqual(result, {
      outcome: 'skipped',
      reason: `${TOKEN_ENV} is not set`,
    });
  });

  it("posts the deployment and its status, then retires the branch's earlier one", async () => {
    const requests: Request[] = [];
    const { branch } = fixtures;

    // GitHub lists newest first; 43 is the one this run creates, 44 a newer push it must leave alone.
    const listed = [
      { id: 44, created_at: '2026-11-19T04:05:00Z', payload: { branch } },
      { id: 43, created_at: '2026-11-19T04:04:00Z', payload: { branch } },
      { id: 42, created_at: '2026-11-19T04:03:00Z', payload: { branch } },
      {
        id: 41,
        created_at: '2026-11-19T04:02:00Z',
        payload: { branch: 'other' },
      },
      { id: 40, created_at: '2026-11-19T04:01:00Z', payload: '' },
      { id: 39, created_at: '2026-11-19T04:00:00Z', payload: { branch } },
    ];

    const statuses = new Map([
      ['42', [{ state: 'success' }]],
      ['39', [{ state: 'inactive' }]],
    ]);

    const fetch = (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      const path = new URL(request.url).pathname;
      const statusesOf = /\/deployments\/(\d+)\/statuses$/.exec(path)?.[1];

      if (request.method === 'POST') {
        return Promise.resolve(
          Response.json(
            { id: 43, url: 'https://api.github.com/x/43' },
            { status: 201 },
          ),
        );
      }

      return Promise.resolve(
        Response.json(
          statusesOf === undefined ? listed : statuses.get(statusesOf),
        ),
      );
    };

    const result = await report(
      {
        exitCode: 0,
        output,
        env: { ...ciEnv, [TOKEN_ENV]: TOKEN },
        dryRun: false,
      },
      fetch,
    );

    assert.ok(result.outcome === 'reported');
    assert.deepEqual(result.deactivated, [42]);
    assert.equal(result.warning, undefined);
    assert.deepEqual(
      requests.map(
        (request) => `${request.method} ${new URL(request.url).pathname}`,
      ),
      [
        'POST /repos/simshanith/lit-ui-router/deployments',
        'POST /repos/simshanith/lit-ui-router/deployments/43/statuses',
        'GET /repos/simshanith/lit-ui-router/deployments',
        'GET /repos/simshanith/lit-ui-router/deployments/42/statuses',
        'POST /repos/simshanith/lit-ui-router/deployments/42/statuses',
        'GET /repos/simshanith/lit-ui-router/deployments/39/statuses',
      ],
    );
    assert.equal(
      new URL(requests[2]?.url ?? '').searchParams.get('environment'),
      'preview/lit-ui-router',
    );
    assert.deepEqual(await requests[4]?.json(), {
      state: 'inactive',
      description: 'Superseded by a newer push to the branch',
    });
    assert.equal(requests[0]?.headers.get('authorization'), `Bearer ${TOKEN}`);
  });

  it('warns, without failing the report, when retiring earlier deployments fails', async () => {
    const fetch = (input: string | URL | Request, init?: RequestInit) =>
      Promise.resolve(
        new Request(input, init).method === 'POST'
          ? Response.json({ id: 43, url: 'u' }, { status: 201 })
          : new Response(`rate limited ${TOKEN}`, { status: 403 }),
      );

    const result = await report(
      {
        exitCode: 0,
        output,
        env: { ...ciEnv, [TOKEN_ENV]: TOKEN },
        dryRun: false,
      },
      fetch,
    );

    assert.ok(result.outcome === 'reported');
    assert.match(
      result.warning ?? '',
      /retiring earlier deployments failed: GET .*HTTP 403/,
    );
    assert.doesNotMatch(result.warning ?? '', new RegExp(TOKEN));
  });

  it('surfaces an HTTP error whose text the caller can scrub', async () => {
    const fetch = () =>
      Promise.resolve(
        new Response(`bad credentials for ${TOKEN}`, { status: 401 }),
      );

    await assert.rejects(
      report(
        {
          exitCode: 0,
          output,
          env: { ...ciEnv, [TOKEN_ENV]: TOKEN },
          dryRun: false,
        },
        fetch,
      ),
      (error: Error) => {
        assert.match(error.message, /HTTP 401/);
        assert.doesNotMatch(redact(error.message, [TOKEN]), new RegExp(TOKEN));

        return true;
      },
    );
  });
});

describe('github-deployment-reporter', () => {
  const script = join(import.meta.dirname, 'github-deployment-reporter.ts');
  const dir = mkdtempSync(join(tmpdir(), 'github-deployment-reporter-test-'));
  const lines = join(dir, 'lines.ndjson');
  writeFileSync(lines, ndjson(fixtures.versionsUpload));

  // A stand-in deploy: writes the fixture where wrangler would, reports whether it saw the token.
  const stub = (code: number) => [
    process.execPath,
    '-e',
    `const fs = require('node:fs');
     fs.appendFileSync(process.env.${OUTPUT_PATH_ENV}, fs.readFileSync(${JSON.stringify(lines)}));
     console.log('token in child: ' + (process.env.${TOKEN_ENV} !== undefined));
     process.exit(${code});`,
  ];

  const run = (args: readonly string[], env: Record<string, string>) =>
    spawnSync(process.execPath, [script, ...args], {
      encoding: 'utf8',
      env,
    });

  it('propagates the exit code and hides the token from the command', () => {
    const result = run(['--', ...stub(7)], { ...ciEnv, [TOKEN_ENV]: TOKEN });

    assert.equal(result.status, 7);
    assert.match(result.stdout, /token in child: false/);
    assert.match(result.stderr, /skipped: the command exited 7/);
    assert.doesNotMatch(result.stdout + result.stderr, new RegExp(TOKEN));
  });

  it('prints the requests in a dry run and exits 0', () => {
    const result = run(['--dry-run', '--json', '--', ...stub(0)], ciEnv);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /dry run, would send/);

    // the stub's own line comes first on the shared stdout
    const json = v.parse(
      v.object({
        outcome: v.literal('dry-run'),
        requests: v.object({
          deployment: v.looseObject({ environment: v.string() }),
          status: v.looseObject({ environment_url: v.string() }),
        }),
      }),
      JSON.parse(result.stdout.slice(result.stdout.indexOf('{'))),
    );

    assert.equal(json.requests.deployment.environment, 'preview/lit-ui-router');
    assert.equal(
      json.requests.status.environment_url,
      'https://2bb6eca1-lit-ui-router.shane-cf1.workers.dev',
    );
  });

  it('skips with one line when no token is set', () => {
    const result = run(['--', ...stub(0)], ciEnv);

    assert.equal(result.status, 0);
    assert.match(result.stderr, new RegExp(`skipped: ${TOKEN_ENV} is not set`));
  });

  it('reads only the entries appended to a caller-set output file', () => {
    const existing = join(dir, 'cloudflare.ndjson');
    writeFileSync(existing, ndjson(fixtures.previewsDeploy));

    const result = run(['--dry-run', '--', ...stub(0)], {
      ...ciEnv,
      [OUTPUT_PATH_ENV]: existing,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /preview\/lit-ui-router/);
    assert.match(
      readFileSync(existing, 'utf8'),
      /release-ledger[\s\S]*lit-ui-router/,
    );
  });

  it('exits 2 without running anything on a missing --', () => {
    const result = run(['echo', 'hi'], ciEnv);

    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
  });
});
