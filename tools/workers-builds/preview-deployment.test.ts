import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import type { Json } from '@tools/bootstrap/types.ts';
import type { CloudflareApi } from '@tools/cloudflare-api/call.ts';

import {
  type Build,
  type Preview,
  type Version,
  candidateVersions,
  createDeploymentArgs,
  createStatusArgs,
  deploymentsFromApi,
  existingDeployment,
  latestPreviewDeployments,
  parseDetailsUrl,
  previewFor,
  previewRecord,
} from './preview-deployment.core.ts';
import { resolvePreview } from './preview-deployment.ts';

type BuildFixture = { detailsUrl?: string; build: { [key: string]: Json } };

type Fixtures = {
  accountId: string;
  docs: BuildFixture & {
    detailsUrl: string;
    versions: { [key: string]: Json }[];
    buildsByVersion: { [key: string]: Json };
    expected: {
      sha: string;
      versionId: string;
      commitUrl: string;
      branchUrl: string;
    };
  };
  previews: BuildFixture & { detailsUrl: string };
  production: BuildFixture;
};

// SAFETY: the checked-in fixture file is authored in the Fixtures shape
const fixtures = JSON.parse(
  await readFile(
    join(import.meta.dirname, 'preview-deployment.fixtures.json'),
    'utf8',
  ),
) as Fixtures;

const { docs, previews, production } = fixtures;

/** An API answering each GET by path: one build, one versions page, one builds-by-version map. */
const routed = (build: Json, versions: Json, buildsByVersion: Json) => {
  const requests: URL[] = [];

  const api: CloudflareApi = {
    token: 'test-token',
    accountId: fixtures.accountId,
    fetch: (input, init) => {
      const url = new URL(new Request(input, init).url);
      requests.push(url);

      const result = url.pathname.endsWith('/versions')
        ? versions
        : url.pathname.endsWith('/builds/builds')
          ? buildsByVersion
          : build;

      return Promise.resolve(
        Response.json({ success: true, errors: [], messages: [], result }),
      );
    },
  };

  return { api, requests };
};

const REPO = 'simshanith/lit-ui-router';

describe('parseDetailsUrl', () => {
  it('reads the worker and build from a version-upload build URL', () => {
    assert.deepEqual(parseDetailsUrl(docs.detailsUrl), {
      worker: 'lit-ui-router',
      buildUuid: '963e54c1-a8ee-4145-8873-d1277a7adacc',
    });
  });

  it('reads the Previews slug from a Workers Previews build URL', () => {
    assert.deepEqual(parseDetailsUrl(previews.detailsUrl), {
      worker: 'release-ledger',
      buildUuid: '2fd99747-aaba-4631-aa11-058ef12b9d3b',
      previewSlug: 'fix-distilled-rc20-workers-builds-patch',
    });
  });

  it('rejects another host, another path, and a non-UUID build', () => {
    for (const url of [
      docs.detailsUrl.replace('dash.cloudflare.com', 'example.com'),
      docs.detailsUrl.replace('/builds/', '/deployments/'),
      docs.detailsUrl.replace(/[0-9a-f-]+$/, 'latest'),
      'not a url',
    ]) {
      assert.equal(parseDetailsUrl(url), undefined, url);
    }
  });
});

describe('resolvePreview', () => {
  it("finds PR #2270's commit preview through the builds-by-version map", async () => {
    const ref = parseDetailsUrl(docs.detailsUrl);
    assert.ok(ref);

    const { api, requests } = routed(
      docs.build,
      docs.versions,
      docs.buildsByVersion,
    );

    const preview = await resolvePreview(api, ref, docs.detailsUrl);

    assert.deepEqual(preview, {
      worker: 'lit-ui-router',
      environment: 'preview/lit-ui-router',
      sha: docs.expected.sha,
      branch: 'docs/v1-snapshot-llms-full',
      buildUuid: ref.buildUuid,
      versionId: docs.expected.versionId,
      commitUrl: docs.expected.commitUrl,
      branchUrl: docs.expected.branchUrl,
      logUrl: docs.detailsUrl,
    });

    // Only the version created while the build ran is asked about.
    assert.deepEqual(
      requests.map((url) => url.searchParams.get('version_ids')),
      [null, null, docs.expected.versionId],
    );
  });

  it('skips a Workers Previews build, which uploads no version', async () => {
    const ref = parseDetailsUrl(previews.detailsUrl);
    assert.ok(ref);

    const { api, requests } = routed(previews.build, [], { builds: {} });

    assert.deepEqual(await resolvePreview(api, ref, previews.detailsUrl), {
      skip: 'Workers Previews build (fix-distilled-rc20-workers-builds-patch) uploaded no Worker version with a URL',
    });
    assert.equal(requests.length, 2);
  });
});

describe('previewFor', () => {
  const ref = { worker: 'lit-ui-router', buildUuid: '' };

  // SAFETY: the fixture versions carry these wire fields with these types
  const versions: Version[] = (
    docs.versions as { id: string; created_on: string; urls: string[] }[]
  ).map((version) => ({
    id: version.id,
    createdOn: version.created_on,
    urls: version.urls,
  }));

  // The SDK's camelCase output for a fixture build, typed as the core reads it.
  const camel = (build: { [key: string]: Json }): Build => {
    // SAFETY: the fixture builds carry these wire fields with these types
    const wire = build as {
      build_uuid: string;
      build_outcome: string;
      created_on: string;
      stopped_on: string;
      preview_url?: string;
      build_trigger_metadata: { branch: string; commit_hash: string };
    };

    return {
      buildUuid: wire.build_uuid,
      buildOutcome: wire.build_outcome,
      createdOn: wire.created_on,
      stoppedOn: wire.stopped_on,
      previewUrl: wire.preview_url ?? null,
      buildTriggerMetadata: {
        branch: wire.build_trigger_metadata.branch,
        commitHash: wire.build_trigger_metadata.commit_hash,
      },
    };
  };

  it('skips a production build', () => {
    const build = camel(production.build);

    assert.deepEqual(
      previewFor({
        ref: { ...ref, buildUuid: build.buildUuid },
        build,
        versions,
        buildsByVersion: new Map(),
        logUrl: '',
      }),
      { skip: 'a main build is a production deploy' },
    );
  });

  it('skips a failed build', () => {
    const build = { ...camel(docs.build), buildOutcome: 'fail' };

    assert.deepEqual(
      previewFor({
        ref: { ...ref, buildUuid: build.buildUuid },
        build,
        versions,
        buildsByVersion: new Map(),
        logUrl: '',
      }),
      { skip: 'build outcome is fail' },
    );
  });

  it('never takes a version another build uploaded in the same window', () => {
    const build = camel(docs.build);

    const window = candidateVersions(versions, {
      ...build,
      createdOn: '2026-11-19T03:00:00Z',
      stoppedOn: null,
    });

    assert.equal(window.length, versions.length);
    assert.deepEqual(
      previewFor({
        ref: { ...ref, buildUuid: build.buildUuid },
        build,
        versions: window,
        buildsByVersion: new Map(
          window.map((version) => [version.id, 'some-other-build']),
        ),
        logUrl: '',
      }),
      { skip: 'no Worker version with a URL came from this build' },
    );
  });

  it('refuses a build Cloudflare returned for another UUID', () => {
    assert.throws(
      () =>
        previewFor({
          ref: { ...ref, buildUuid: 'another' },
          build: camel(docs.build),
          versions,
          buildsByVersion: new Map(),
          logUrl: '',
        }),
      /asked for build another/,
    );
  });
});

const preview: Preview = {
  worker: 'lit-ui-router',
  environment: 'preview/lit-ui-router',
  sha: docs.expected.sha,
  branch: 'docs/v1-snapshot-llms-full',
  buildUuid: '963e54c1-a8ee-4145-8873-d1277a7adacc',
  versionId: docs.expected.versionId,
  commitUrl: docs.expected.commitUrl,
  branchUrl: docs.expected.branchUrl,
  logUrl: docs.detailsUrl,
};

describe('GitHub requests', () => {
  it('creates a transient, non-production deployment on the sha with no required contexts', () => {
    const args = createDeploymentArgs(REPO, preview);

    assert.deepEqual(args.slice(0, 4), [
      'api',
      '--method',
      'POST',
      `repos/${REPO}/deployments`,
    ]);

    for (const field of [
      `ref=${docs.expected.sha}`,
      'environment=preview/lit-ui-router',
      'auto_merge=false',
      'required_contexts[]',
      'transient_environment=true',
      'production_environment=false',
      `payload[build_uuid]=${preview.buildUuid}`,
      `payload[branch_url]=${docs.expected.branchUrl}`,
    ]) {
      assert.ok(args.includes(field), field);
    }
  });

  it('omits the branch alias when the build has none', () => {
    const args = createDeploymentArgs(REPO, { ...preview, branchUrl: null });

    assert.ok(!args.some((arg) => arg.startsWith('payload[branch_url]')));
  });

  it('marks the deployment live at the commit preview, linking the build log', () => {
    const args = createStatusArgs(REPO, 42, preview);

    assert.equal(args[3], `repos/${REPO}/deployments/42/statuses`);

    for (const field of [
      'state=success',
      `environment_url=${docs.expected.commitUrl}`,
      `log_url=${docs.detailsUrl}`,
      'auto_inactive=true',
    ]) {
      assert.ok(args.includes(field), field);
    }
  });

  const listed = deploymentsFromApi(
    JSON.stringify([
      {
        id: 1,
        sha: preview.sha,
        environment: 'preview/lit-ui-router',
        created_at: '2026-11-19T03:20:00Z',
        payload: { build_uuid: 'an-earlier-build' },
      },
      {
        id: 2,
        sha: preview.sha,
        environment: 'preview/lit-ui-router',
        created_at: '2026-11-19T03:21:00Z',
        payload: { build_uuid: preview.buildUuid },
      },
      {
        id: 3,
        sha: preview.sha,
        environment: 'tag-release',
        created_at: '2026-11-19T03:22:00Z',
        payload: '',
      },
    ]),
  );

  it('finds the deployment a rerun already posted for this build', () => {
    assert.equal(existingDeployment(listed, preview)?.id, 2);
    assert.equal(
      existingDeployment(listed, { ...preview, buildUuid: 'new' }),
      undefined,
    );
  });

  it('reads back the newest preview deployment per environment', () => {
    const latest = latestPreviewDeployments(listed);

    assert.deepEqual(
      latest.map((deployment) => deployment.id),
      [2],
    );

    const [deployment] = latest;
    assert.ok(deployment);
    assert.deepEqual(
      previewRecord(
        deployment,
        JSON.stringify([
          {
            state: 'success',
            environment_url: docs.expected.commitUrl,
            log_url: docs.detailsUrl,
          },
        ]),
      ),
      {
        worker: 'lit-ui-router',
        environment: 'preview/lit-ui-router',
        sha: preview.sha,
        state: 'success',
        url: docs.expected.commitUrl,
        logUrl: docs.detailsUrl,
      },
    );
  });
});
