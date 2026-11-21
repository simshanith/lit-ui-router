import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { getByRole } from '@testing-library/dom';
import { parseHtml } from '@tools/lit-test-env/parse-html.ts';
import {
  element,
  hasAttribute,
  parseMarkup,
} from '@tools/lit-test-env/ssr-tree.ts';
import { type ParseError, parse, printParseErrorCode } from 'jsonc-parser';
import * as v from 'valibot';
import { createTestHarness } from 'wrangler';
import { LAYOUT } from '@www/release-diffs.lit-ui-router.dev/layout';

import { notesAsset } from '../releases/notes.ts';
import { FIXTURE_NOTES } from './notes-stub.ts';

// The docs worker's bundle in workerd, its LEDGER and RELEASE_DIFFS bindings served by stub workers over RPC, its snapshot bucket local.
const SITE = join(import.meta.dirname, '../..');

// wrangler writes its bundles under <root>/.wrangler; keep them out of the tree turbo hashes.
const SCRATCH = mkdtempSync(join(tmpdir(), 'docs-releases-'));

const WranglerConfig = v.object({
  name: v.string(),
  compatibility_date: v.string(),
  compatibility_flags: v.optional(v.array(v.string()), []),
  alias: v.record(v.string(), v.string()),
  assets: v.object({ run_worker_first: v.array(v.string()) }),
  services: v.tuple([
    v.object({
      binding: v.string(),
      service: v.string(),
      entrypoint: v.string(),
    }),
    v.object({ binding: v.string(), service: v.string() }),
  ]),
  r2_buckets: v.tuple([
    v.object({ binding: v.string(), bucket_name: v.string() }),
  ]),
});

const readSite = () => {
  const errors: ParseError[] = [];

  const config: unknown = parse(
    readFileSync(join(SITE, 'wrangler.jsonc'), 'utf8'),
    errors,
    { allowTrailingComma: true },
  );

  if (errors.length > 0) {
    throw new Error(
      `wrangler.jsonc: ${errors.map((e) => printParseErrorCode(e.error)).join(', ')}`,
    );
  }

  return v.parse(WranglerConfig, config);
};

const site = readSite();

// The built notes the worker reads through its assets binding.
const ASSETS = join(SCRATCH, 'assets');

for (const [name, notes] of Object.entries(FIXTURE_NOTES)) {
  const file = join(ASSETS, notesAsset(name));

  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(notes));
}

const [ledger, diffs] = site.services;

const server = createTestHarness({
  root: SCRATCH,
  workers: [
    {
      config: {
        name: site.name,
        main: join(SITE, 'worker/index.ts'),
        compatibility_date: site.compatibility_date,
        compatibility_flags: site.compatibility_flags,
        // esbuild resolves an alias from the working directory, which here is SCRATCH.
        alias: Object.fromEntries(
          Object.entries(site.alias).map(([from, to]) => [
            from,
            join(SITE, to),
          ]),
        ),
        services: [ledger, diffs],
        // Local storage under SCRATCH, seeded by the snapshot tests.
        r2_buckets: site.r2_buckets,
        assets: {
          directory: ASSETS,
          binding: 'ASSETS',
          run_worker_first: site.assets.run_worker_first,
        },
      },
    },
    {
      config: {
        name: ledger.service,
        main: join(SITE, 'worker/test/ledger-stub/index.ts'),
        compatibility_date: site.compatibility_date,
      },
    },
    {
      config: {
        name: diffs.service,
        main: join(SITE, 'worker/test/release-diffs-stub/index.ts'),
        compatibility_date: site.compatibility_date,
      },
    },
  ],
});

before(() => server.listen());

after(async () => {
  await server.close();
  rmSync(SCRATCH, { recursive: true, force: true });
});

describe('the release pages in workerd', { timeout: 120_000 }, () => {
  it('binds the ledger read-only, through its LedgerReader entrypoint', () => {
    assert.deepEqual(ledger, {
      binding: 'LEDGER',
      service: 'release-ledger',
      entrypoint: 'LedgerReader',
    });
  });

  it("binds the release diffs through their worker's default entrypoint", () => {
    assert.deepEqual(diffs, {
      binding: 'RELEASE_DIFFS',
      service: 'release-diffs',
    });
  });

  it('serves a diff index and a preset over RPC', async () => {
    const diff = `/releases/lit-ui-router/diff/1.9.0...1.10.0/${LAYOUT}`;
    const index = await server.fetch(`${diff}/index.json`);

    assert.equal(index.status, 200);
    assert.equal(
      v.parse(
        v.object({ files: v.array(v.object({ path: v.string() })) }),
        await index.json(),
      ).files[0]?.path,
      'package.json',
    );

    const files = await server.fetch(`${diff}/files/src`);

    assert.equal(files.status, 200);
    assert.match(await files.text(), /^diff --git a\/package\.json/);
  });

  it('renders a known version at 200', async () => {
    const response = await server.fetch('/releases/lit-ui-router/1.10.0/');
    const body = await response.text();

    assert.equal(response.status, 200, body);
    assert.equal(parseHtml(body).title, 'lit-ui-router@1.10.0 | Lit UI Router');
    getByRole(parseHtml(body).body, 'heading', {
      level: 2,
      name: 'Release notes',
    });
    // The header reads the navigation catalog, bundled into the worker.
    assert.equal(
      getByRole(parseHtml(body).body, 'link', { name: 'Guides' }).getAttribute(
        'href',
      ),
      '/guides/',
    );
    assert.ok(
      hasAttribute(element(parseMarkup(body), 'ui-view'), 'defer-hydration'),
    );
  });

  it('answers 404 for the notes file itself, which only the binding reads', async () => {
    const response = await server.fetch(notesAsset('lit-ui-router'));

    assert.equal(response.status, 404);
  });

  it('answers 404 for a version the ledger lacks', async () => {
    const response = await server.fetch('/releases/lit-ui-router/9.9.9/');

    assert.equal(response.status, 404);
    getByRole(parseHtml(await response.text()).body, 'heading', {
      level: 1,
      name: 'Not found',
    });
  });

  it('redirects latest to the newest stable version', async () => {
    const response = await server.fetch('/releases/lit-ui-router/latest', {
      redirect: 'manual',
    });

    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get('Location'),
      '/releases/lit-ui-router/1.10.0/',
    );
  });

  it('redirects another dist-tag to the version it points at', async () => {
    const response = await server.fetch('/releases/lit-ui-router/next', {
      redirect: 'manual',
    });

    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get('Location'),
      '/releases/lit-ui-router/1.11.0-rc.0/',
    );
  });

  it("redirects /gh latest to that version's GitHub release", async () => {
    const response = await server.fetch(
      '/gh/releases/ui-router-server/latest?ref=badge',
      { redirect: 'manual' },
    );

    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get('Location'),
      'https://github.com/simshanith/lit-ui-router/releases/tag/ui-router-server%400.3.0',
    );
  });

  it('answers 404 for the old /gh release pages', async () => {
    const response = await server.fetch('/gh/releases/');

    assert.equal(response.status, 404);
    getByRole(parseHtml(await response.text()).body, 'heading', {
      level: 1,
      name: 'Not found',
    });
  });
});

describe('the snapshot bucket in workerd', { timeout: 120_000 }, () => {
  before(async () => {
    const env = await server
      .getWorker<{
        DOCS_SNAPSHOTS: {
          put: (key: string, value: string) => Promise<object | null>;
        };
      }>()
      .getEnv();

    await env.DOCS_SNAPSHOTS.put('v1/index.html', '<h1>1.x</h1>');
    await env.DOCS_SNAPSHOTS.put('v1/404.html', '<h1>Not found</h1>');
    await env.DOCS_SNAPSHOTS.put('v1/assets/app.abc123.js', 'app()');
  });

  it('serves a page through run_worker_first, with the snapshot headers', async () => {
    const response = await server.fetch('/v1/');

    assert.equal(response.status, 200);
    assert.equal(await response.text(), '<h1>1.x</h1>');
    assert.equal(response.headers.get('Content-Type'), 'text/html');
    assert.equal(
      response.headers.get('Cache-Control'),
      'public, max-age=0, must-revalidate',
    );
    assert.match(response.headers.get('Link') ?? '', /<\/v1\/llms\.txt>/);
  });

  it('redirects the bare prefix and answers a miss with the 404 page', async () => {
    const bare = await server.fetch('/v1', { redirect: 'manual' });

    assert.equal(bare.status, 307);
    assert.equal(bare.headers.get('Location'), '/v1/');

    const miss = await server.fetch('/v1/nope');

    assert.equal(miss.status, 404);
    assert.equal(await miss.text(), '<h1>Not found</h1>');
  });

  it("answers R2's own ETag with a 304 on a revalidation", async () => {
    const first = await server.fetch('/v1/assets/app.abc123.js');
    const etag = first.headers.get('ETag');

    await first.arrayBuffer();
    assert.ok(etag);
    assert.equal(
      first.headers.get('Cache-Control'),
      'public, max-age=31536000, immutable',
    );

    const again = await server.fetch('/v1/assets/app.abc123.js', {
      headers: { 'If-None-Match': etag },
    });

    assert.equal(again.status, 304);
  });
});
