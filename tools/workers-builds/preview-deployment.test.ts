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
  environmentOf,
  existingDeployment,
  inactiveStatusArgs,
  latestPreviewDeployments,
  needsInactive,
  parseSummary,
  previewEnvironments,
  previewFromCheckRun,
  previewLink,
  previewRecords,
  previewTargets,
  supersededDeployments,
  workerOf,
  workerOfEnvironment,
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

const [branchTarget, commitTarget] = previewTargets(typed);

assert.ok(branchTarget && commitTarget);

describe('environments', () => {
  it('links the branch alias in preview/<worker> and the commit preview in preview/<worker>/commit', () => {
    assert.deepEqual(previewTargets(typed), [
      {
        link: 'branch',
        environment: 'preview/lit-ui-router',
        url: typed.branchUrl,
      },
      {
        link: 'commit',
        environment: 'preview/lit-ui-router/commit',
        url: typed.commitUrl,
      },
    ]);
  });

  it('posts only the commit preview when the summary has no branch alias', () => {
    assert.deepEqual(
      previewTargets({ ...typed, branchUrl: null }).map(
        ({ environment }) => environment,
      ),
      ['preview/lit-ui-router/commit'],
    );
  });

  it('reads the worker back from either environment', () => {
    for (const link of ['branch', 'commit'] as const) {
      assert.equal(
        workerOfEnvironment(environmentOf('release-diffs', link)),
        'release-diffs',
      );
    }
  });
});

describe('GitHub requests', () => {
  it('creates a transient, non-production deployment on the sha recording its branch and link', () => {
    const args = createDeploymentArgs(REPO, typed, branchTarget);

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
      'payload[link]=branch',
    ]) {
      assert.ok(args.includes(field), field);
    }

    assert.ok(
      createDeploymentArgs(REPO, typed, commitTarget).includes(
        'environment=preview/lit-ui-router/commit',
      ),
    );
  });

  it('omits the branch alias when the summary has none', () => {
    const args = createDeploymentArgs(
      REPO,
      { ...typed, branchUrl: null },
      commitTarget,
    );

    assert.ok(!args.some((arg) => arg.startsWith('payload[branch_url]')));
  });

  it("marks each deployment live at its target's URL, linking the build log", () => {
    for (const [target, description] of [
      [branchTarget, 'Branch preview'],
      [commitTarget, 'Commit preview'],
    ] as const) {
      const args = createStatusArgs(REPO, 42, typed, target);

      assert.equal(args[3], `repos/${REPO}/deployments/42/statuses`);

      for (const field of [
        'state=success',
        `environment_url=${target.url}`,
        `log_url=${typed.logUrl}`,
        `description=${description} ${typed.versionId.slice(0, 8)}`,
      ]) {
        assert.ok(args.includes(field), field);
      }
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
    payload: { [key: string]: string | null },
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
      deployment(20, '2026-11-19T19:00:00Z', {
        build_uuid: 'newer',
        branch,
        link: 'branch',
      }),
      deployment(10, '2026-11-19T18:50:00Z', {
        build_uuid: typed.buildUuid,
        branch,
        link: 'branch',
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
      // A payload posted as a string reads as an empty one.
      {
        id: 5,
        sha: typed.sha,
        environment: 'tag-release',
        created_at: '2026-11-19T18:10:00Z',
        payload: '',
      },
    ]),
  );

  it('finds the deployment a rerun already posted for this build and link', () => {
    assert.equal(existingDeployment(listed, typed, branchTarget)?.id, 10);
    assert.equal(
      existingDeployment(listed, { ...typed, buildUuid: 'new' }, branchTarget),
      undefined,
    );
  });

  it('never reuses a deployment posted before the branch link, which linked the commit', () => {
    const legacy = deploymentsFromApi(
      JSON.stringify([
        deployment(3, '2026-11-19T18:00:00Z', {
          build_uuid: typed.buildUuid,
          branch,
        }),
      ]),
    );

    assert.equal(legacy[0]?.payload.link, 'commit');
    assert.equal(existingDeployment(legacy, typed, branchTarget), undefined);
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

  it('retires across preview environments only', () => {
    assert.deepEqual(
      previewEnvironments(
        'bump-version\npreview/lit-ui-router\npreview/lit-ui-router/commit\npublish\npreview/release-diffs\n',
      ),
      [
        'preview/lit-ui-router',
        'preview/lit-ui-router/commit',
        'preview/release-diffs',
      ],
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
    assert.deepEqual(
      latestPreviewDeployments(listed).map(({ id }) => id),
      [20, 6],
    );
  });

  it("reads one record per worker with both links, a pre-split deployment's URL as the commit's", () => {
    const status = (url: string) =>
      JSON.stringify([
        { state: 'success', environment_url: url, log_url: typed.logUrl },
      ]);

    const [split, legacy] = deploymentsFromApi(
      JSON.stringify([
        deployment(
          31,
          '2026-11-19T20:00:00Z',
          { branch, link: 'commit' },
          'preview/lit-ui-router/commit',
        ),
        deployment(
          21,
          '2026-11-19T18:00:00Z',
          { branch },
          'preview/release-diffs',
        ),
      ]),
    );

    const [newest] = latestPreviewDeployments(listed);

    assert.ok(split && legacy && newest);
    assert.deepEqual(
      previewRecords([
        previewLink(newest, status(typed.branchUrl ?? '')),
        previewLink(split, status(typed.commitUrl)),
        previewLink(legacy, status('https://legacy.example')),
      ]),
      [
        {
          worker: 'lit-ui-router',
          state: 'success',
          branchUrl: typed.branchUrl,
          commitUrl: typed.commitUrl,
          logUrl: typed.logUrl,
        },
        {
          worker: 'release-diffs',
          state: 'success',
          branchUrl: null,
          commitUrl: 'https://legacy.example',
          logUrl: typed.logUrl,
        },
      ],
    );
  });
});
