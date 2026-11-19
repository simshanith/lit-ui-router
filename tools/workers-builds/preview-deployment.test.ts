import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  type CheckRun,
  type Preview,
  branchDeployments,
  checkRunFromApi,
  checkRunOf,
  createDeploymentArgs,
  createStatusArgs,
  deploymentPagesFromApi,
  deploymentsFromApi,
  existingDeployment,
  inactiveStatusArgs,
  latestPreviewDeployments,
  needsInactive,
  parseSummary,
  previewFromCheckRun,
  previewRecord,
  supersededDeployments,
  workerOf,
} from './preview-deployment.core.ts';

/** A check run as the event payload carries it. */
type EventCheckRun = {
  id: number;
  name: string;
  head_sha: string;
  status: string;
  conclusion: string;
  details_url: string;
  app: { slug: string };
  check_suite: { id: number; head_branch: string };
  output: { title: string; summary: string };
};

type Fixtures = {
  versionsUpload: EventCheckRun;
  pr2270: EventCheckRun;
  production: EventCheckRun;
  previews: EventCheckRun;
};

// SAFETY: the checked-in fixture file is authored in the Fixtures shape
const fixtures = JSON.parse(
  await readFile(
    join(import.meta.dirname, 'preview-deployment.fixtures.json'),
    'utf8',
  ),
) as Fixtures;

/** The fields the workflow passes from `github.event.check_run`. */
const fromEvent = (run: EventCheckRun): CheckRun => ({
  name: run.name,
  headSha: run.head_sha,
  headBranch: run.check_suite.head_branch,
  detailsUrl: run.details_url,
  summary: run.output.summary,
});

const REPO = 'simshanith/lit-ui-router';

describe('parseSummary', () => {
  it('reads every line of a versions-upload branch build', () => {
    assert.deepEqual(parseSummary(fixtures.pr2270.output.summary), {
      buildUuid: '963e54c1-a8ee-4145-8873-d1277a7adacc',
      buildUrl: fixtures.pr2270.details_url,
      versionId: '2bb6eca1-9373-4c50-9d20-e7e0fa742fb2',
      previewUrl: 'https://2bb6eca1-lit-ui-router.shane-cf1.workers.dev',
      aliasUrl:
        'https://docs-v1-snapshot-llms-full-lit-ui-router.shane-cf1.workers.dev',
    });
  });

  it('reads a production build: a version, no preview URL', () => {
    const summary = parseSummary(fixtures.production.output.summary);

    assert.equal(summary.versionId, '36884872-67a5-40a4-b67b-5b9472bbb4b2');
    assert.equal(summary.previewUrl, null);
  });

  it('reads a Workers Previews build: a /previews/ build link and nothing else', () => {
    const summary = parseSummary(fixtures.previews.output.summary);

    assert.match(summary.buildUrl ?? '', /\/previews\/[a-z0-9-]+\/builds\//);
    assert.equal(summary.versionId, null);
    assert.equal(summary.previewUrl, null);
  });
});

describe('previewFromCheckRun', () => {
  it("posts #2270's commit preview with its branch alias", () => {
    assert.deepEqual(previewFromCheckRun(fromEvent(fixtures.pr2270)), {
      worker: 'lit-ui-router',
      environment: 'preview/lit-ui-router',
      sha: '99c2ed6fc79c23dff476d5671774dfd5dc5ddd74',
      branch: 'docs/v1-snapshot-llms-full',
      buildUuid: '963e54c1-a8ee-4145-8873-d1277a7adacc',
      versionId: '2bb6eca1-9373-4c50-9d20-e7e0fa742fb2',
      commitUrl: 'https://2bb6eca1-lit-ui-router.shane-cf1.workers.dev',
      branchUrl:
        'https://docs-v1-snapshot-llms-full-lit-ui-router.shane-cf1.workers.dev',
      logUrl: fixtures.pr2270.details_url,
    });
  });

  it('skips a production main build', () => {
    assert.deepEqual(previewFromCheckRun(fromEvent(fixtures.production)), {
      worker: 'lit-ui-router',
      skip: 'a main build is a production deploy',
    });
  });

  it('skips a Workers Previews build with no URL, saying why', () => {
    assert.deepEqual(previewFromCheckRun(fromEvent(fixtures.previews)), {
      worker: 'release-ledger',
      skip: 'Workers Previews build with preview URLs off: its summary names no URL',
    });
  });

  it('fails loudly on a branch build of a versions-upload Worker without a Preview URL line', () => {
    const run = fromEvent(fixtures.versionsUpload);

    const summary = run.summary
      .split('\n')
      .filter((line) => !line.startsWith('Preview URL:'))
      .join('\n');

    assert.throws(
      () => previewFromCheckRun({ ...run, summary }),
      /summary format may have changed/,
    );
  });

  it('refuses a check run another app or check named', () => {
    assert.throws(() => workerOf('Cloudflare Pages'), /not a Workers Builds/);
    assert.throws(
      () => workerOf('Workers Builds: ../etc'),
      /not a Workers Builds/,
    );
  });

  it('reads the REST check run fetched for --check-run like the event', () => {
    const { check_suite: suite, ...run } = fixtures.versionsUpload;

    const rest = checkRunFromApi(
      JSON.stringify({ ...run, check_suite: { id: suite.id } }),
    );

    assert.deepEqual(
      checkRunOf(rest, suite.head_branch),
      fromEvent(fixtures.versionsUpload),
    );
    assert.throws(
      () =>
        checkRunFromApi(
          JSON.stringify({ ...run, conclusion: 'failure', check_suite: suite }),
        ),
      /concluded failure/,
    );
  });
});

const preview = previewFromCheckRun(fromEvent(fixtures.versionsUpload));

assert.ok(!('skip' in preview));

const typed: Preview = preview;

describe('GitHub requests', () => {
  it('creates a transient, non-production deployment on the sha recording its branch', () => {
    const args = createDeploymentArgs(REPO, typed);

    assert.deepEqual(args.slice(0, 4), [
      'api',
      '--method',
      'POST',
      `repos/${REPO}/deployments`,
    ]);

    for (const field of [
      `ref=${typed.sha}`,
      'environment=preview/lit-ui-router',
      'auto_merge=false',
      'required_contexts[]',
      'transient_environment=true',
      'production_environment=false',
      `payload[build_uuid]=${typed.buildUuid}`,
      'payload[branch]=t3/async-pr-metadata-bubbling',
      `payload[branch_url]=${typed.branchUrl ?? ''}`,
    ]) {
      assert.ok(args.includes(field), field);
    }
  });

  it('omits the branch alias when the summary has none', () => {
    const args = createDeploymentArgs(REPO, { ...typed, branchUrl: null });

    assert.ok(!args.some((arg) => arg.startsWith('payload[branch_url]')));
  });

  it('marks the deployment live at the commit preview, linking the build log', () => {
    const args = createStatusArgs(REPO, 42, typed);

    assert.equal(args[3], `repos/${REPO}/deployments/42/statuses`);

    for (const field of [
      'state=success',
      `environment_url=${typed.commitUrl}`,
      `log_url=${typed.logUrl}`,
    ]) {
      assert.ok(args.includes(field), field);
    }
  });

  it('posts an inactive status with its reason', () => {
    const args = inactiveStatusArgs(REPO, 11, 'Pull request closed');

    assert.equal(args[3], `repos/${REPO}/deployments/11/statuses`);
    assert.ok(args.includes('state=inactive'));
    assert.ok(args.includes('description=Pull request closed'));
  });
});

describe('deployments', () => {
  const environment = 'preview/lit-ui-router';
  const { branch } = typed;

  const deployment = (
    id: number,
    createdAt: string,
    payload: { [key: string]: string | null } | string,
    env = environment,
  ) => ({
    id,
    sha: typed.sha,
    environment: env,
    created_at: createdAt,
    payload,
  });

  const listed = deploymentsFromApi(
    JSON.stringify([
      deployment(20, '2026-11-19T19:00:00Z', { build_uuid: 'newer', branch }),
      deployment(10, '2026-11-19T18:50:00Z', {
        build_uuid: typed.buildUuid,
        branch,
      }),
      deployment(9, '2026-11-19T18:50:00Z', { build_uuid: 'tie', branch }),
      deployment(8, '2026-11-19T18:40:00Z', { build_uuid: 'older', branch }),
      deployment(7, '2026-11-19T18:30:00Z', {
        build_uuid: null,
        branch: 'feat/other',
      }),
      deployment(
        6,
        '2026-11-19T18:20:00Z',
        { build_uuid: 'other-worker', branch },
        'preview/release-diffs',
      ),
      deployment(5, '2026-11-19T18:10:00Z', '', 'tag-release'),
    ]),
  );

  it('finds the deployment a rerun already posted for this build', () => {
    assert.equal(existingDeployment(listed, typed)?.id, 10);
    assert.equal(
      existingDeployment(listed, { ...typed, buildUuid: 'new' }),
      undefined,
    );
  });

  it("retires only the branch's deployments created before the current one, never a newer one", () => {
    const current = listed.find(({ id }) => id === 10);

    assert.ok(current);
    assert.deepEqual(
      supersededDeployments(listed, current, branch).map(({ id }) => id),
      [9, 8],
    );
  });

  it('retires nothing when the current deployment is the oldest', () => {
    const oldest = listed.find(({ id }) => id === 8);

    assert.ok(oldest);
    assert.deepEqual(supersededDeployments(listed, oldest, branch), []);
  });

  it("selects a closed branch's deployments in every preview environment", () => {
    assert.deepEqual(
      branchDeployments(listed, branch).map(({ id }) => id),
      [20, 10, 9, 8, 6],
    );
  });

  it('flattens the paginated listing', () => {
    assert.deepEqual(
      deploymentPagesFromApi(
        JSON.stringify([
          [deployment(2, '2026-11-19T18:00:00Z', { branch })],
          [deployment(1, '2026-11-19T17:00:00Z', { branch })],
        ]),
      ).map(({ id }) => id),
      [2, 1],
    );
  });

  it('deactivates only a deployment whose newest status is not inactive', () => {
    assert.equal(needsInactive(JSON.stringify([{ state: 'success' }])), true);
    assert.equal(needsInactive(JSON.stringify([])), true);
    assert.equal(needsInactive(JSON.stringify([{ state: 'inactive' }])), false);
  });

  it('reads back the newest preview deployment per environment', () => {
    const latest = latestPreviewDeployments(listed);

    assert.deepEqual(
      latest.map(({ id }) => id),
      [20, 6],
    );

    const [newest] = latest;

    assert.ok(newest);
    assert.deepEqual(
      previewRecord(
        newest,
        JSON.stringify([
          {
            state: 'success',
            environment_url: typed.commitUrl,
            log_url: typed.logUrl,
          },
        ]),
      ),
      {
        worker: 'lit-ui-router',
        environment,
        sha: typed.sha,
        state: 'success',
        url: typed.commitUrl,
        logUrl: typed.logUrl,
      },
    );
  });
});
