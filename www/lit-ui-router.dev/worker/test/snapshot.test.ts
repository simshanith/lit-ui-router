import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { parse } from 'jsonc-parser';
import * as v from 'valibot';

import worker from '../index.ts';
import {
  candidates,
  contentTypeOf,
  IMMUTABLE,
  isSnapshotPath,
  lineAt,
  notFoundKeys,
  objectKey,
  REVALIDATE,
  serveSnapshot,
  SNAPSHOT_LINES,
  type SnapshotBucket,
  snapshotLines,
  siteLineLink,
} from '../snapshot.ts';

const ORIGIN = 'http://docs.test';

const SITE = join(import.meta.dirname, '../..');

/** The snapshot's layout as the bake writes it, keyed as the bucket holds it. */
const OBJECTS = {
  'v1/index.html': 'home',
  'v1/404.html': 'v1-404',
  'v1/introduction.html': 'introduction',
  'v1/introduction.md': '# Introduction',
  'v1/guides/index.html': 'guides',
  'v1/guides/route-guards.html': 'route guards',
  'v1/assets/app.abc123.js': 'app()',
  'v1/llms.txt': 'llms',
  'v1/examples/solar/index.html': 'solar',
  'v1/examples/solar/404.html': 'solar-404',
  'v1/examples/solar/_redirects': '/a /b 302',
  'v1/café.html': 'cafe',
  'packages/ui-router-server/v0.html': 'server package page',
  'reference/ui-router-server/v0/index.html': 'server reference',
  'reference/ui-router-server/v0/404.html': 'server-404',
  'reference/ui-router-server/v0/assets/chunk.def456.js': 'chunk()',
} satisfies Readonly<Record<string, string>>;

const md5 = (text: string): string =>
  createHash('md5').update(text).digest('hex');

/** An in-memory bucket with R2's read contract: null for a miss, and a bodiless object when `onlyIf` fails. */
function memoryBucket(objects: Readonly<Record<string, string>> = OBJECTS) {
  const reads: string[] = [];

  const meta = (key: string) => {
    const body = objects[key];

    return body === undefined
      ? null
      : {
          body,
          // What `cf r2 objects put --file` stores without --content-type; the route ignores it.
          object: {
            httpEtag: `"${md5(body)}"`,
            httpMetadata: { contentType: 'application/octet-stream' },
          },
        };
  };

  const bucket: SnapshotBucket = {
    head: (key) => {
      reads.push(`head ${key}`);

      return Promise.resolve(meta(key)?.object ?? null);
    },
    get: (key, options) => {
      reads.push(`get ${key}`);
      const found = meta(key);

      if (!found) return Promise.resolve(null);

      if (options?.onlyIf.get('If-None-Match') === found.object.httpEtag)
        return Promise.resolve(found.object);

      const body = new Response(found.body).body;

      return Promise.resolve(body && { ...found.object, body });
    },
  };

  return { bucket, reads };
}

const LINES = snapshotLines({
  others: [{ id: 'v1', path: '/v1/' }],
  packages: { 'ui-router-server': [{ id: 'v0' }] },
});

const serve = (
  path: string,
  init?: RequestInit,
  bucket: SnapshotBucket | undefined = memoryBucket().bucket,
) => serveSnapshot(new Request(`${ORIGIN}${path}`, init), bucket, LINES);

describe('snapshotLines', () => {
  it('maps a site-wide version to its path and a package line to its page and reference', () => {
    assert.deepEqual(LINES, [
      { id: 'v1', roots: ['/v1/'], site: true },
      {
        id: 'ui-router-server/v0',
        roots: [
          '/packages/ui-router-server/v0/',
          '/reference/ui-router-server/v0/',
        ],
        site: false,
      },
    ]);
  });

  it('reads the bundled manifest', () => {
    assert.ok(SNAPSHOT_LINES.some(({ id }) => id === 'v1'));
  });
});

describe('lineAt', () => {
  it('claims each root, bare and with its subpaths, and nothing beside it', () => {
    for (const path of [
      '/v1',
      '/v1/',
      '/v1/guides/route-guards',
      '/packages/ui-router-server/v0',
      '/reference/ui-router-server/v0/',
    ])
      assert.ok(lineAt(path, LINES), path);

    for (const path of [
      '/v10/',
      '/v1-notes',
      '/guides/v1/',
      '/packages/ui-router-server',
      '/packages/ui-router-server/v01',
      '/reference/ui-router-server/',
    ])
      assert.equal(lineAt(path, LINES), undefined, path);
  });

  it('claims the bundled lines through isSnapshotPath', () => {
    assert.ok(isSnapshotPath('/v1/'));
    assert.ok(!isSnapshotPath('/v10/'));
  });
});

describe('object keys and content types', () => {
  it('mirrors the URL path, decoded', () => {
    assert.equal(objectKey('/v1/guides/'), 'v1/guides/');
    assert.equal(objectKey('/v1/caf%C3%A9'), 'v1/café');
    assert.equal(objectKey('/v1/%E0%A4%A'), 'v1/%E0%A4%A');
  });

  it('types a key as the assets binding does, and leaves an unknown one untyped', () => {
    assert.equal(contentTypeOf('v1/index.html'), 'text/html');
    assert.equal(contentTypeOf('v1/assets/a.js'), 'text/javascript');
    assert.equal(contentTypeOf('v1/favicon.ico'), 'image/vnd.microsoft.icon');
    assert.equal(contentTypeOf('v1/examples/solar/_redirects'), undefined);
    assert.equal(contentTypeOf('v1/.hidden'), undefined);
  });

  it('tries the steps auto-trailing-slash takes', () => {
    assert.deepEqual(candidates('/v1/guides'), [
      { key: 'v1/guides' },
      { key: 'v1/guides.html' },
      { key: 'v1/guides/index.html', redirect: '/v1/guides/' },
    ]);
    assert.deepEqual(candidates('/v1/guides/'), [
      { key: 'v1/guides/index.html' },
      { key: 'v1/guides.html', redirect: '/v1/guides' },
    ]);
    assert.deepEqual(candidates('/v1/guides/index'), [
      { key: 'v1/guides/index.html', redirect: '/v1/guides/' },
    ]);
    assert.deepEqual(candidates('/v1/introduction.html'), [
      { key: 'v1/introduction.html', redirect: '/v1/introduction' },
      { key: 'v1/introduction/index.html', redirect: '/v1/introduction/' },
    ]);
  });

  it('walks up to the root for a 404 page', () => {
    assert.deepEqual(notFoundKeys('/v1/examples/solar/a/b', '/v1/'), [
      'v1/examples/solar/a/404.html',
      'v1/examples/solar/404.html',
      'v1/examples/404.html',
      'v1/404.html',
    ]);
    assert.deepEqual(notFoundKeys('/v1', '/v1/'), ['v1/404.html']);
  });
});

describe('serveSnapshot', () => {
  it('serves a page, its Markdown and a text file with the revalidating cache rule and the moved Link', async () => {
    for (const [path, body, type] of [
      ['/v1/', 'home', 'text/html'],
      ['/v1/introduction', 'introduction', 'text/html'],
      ['/v1/guides/', 'guides', 'text/html'],
      ['/v1/introduction.md', '# Introduction', 'text/markdown'],
      ['/v1/llms.txt', 'llms', 'text/plain'],
      ['/v1/caf%C3%A9', 'cafe', 'text/html'],
    ] as const) {
      const response = await serve(path);

      assert.equal(response.status, 200, path);
      assert.equal(await response.text(), body);
      assert.equal(response.headers.get('Content-Type'), type);
      assert.equal(response.headers.get('Cache-Control'), REVALIDATE);
      assert.equal(response.headers.get('Link'), siteLineLink('/v1/'));
      assert.equal(response.headers.get('ETag'), `"${md5(body)}"`);
    }
  });

  it('serves a hashed asset immutable and without the Link', async () => {
    const response = await serve('/v1/assets/app.abc123.js');

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'text/javascript');
    assert.equal(response.headers.get('Cache-Control'), IMMUTABLE);
    assert.equal(response.headers.get('Link'), null);
  });

  it('sends a file of no known type without a Content-Type', async () => {
    const response = await serve('/v1/examples/solar/_redirects');

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), null);
  });

  it('redirects to the canonical URL with a 307, query kept', async () => {
    for (const [path, location] of [
      ['/v1', '/v1/'],
      ['/v1/guides', '/v1/guides/'],
      ['/v1/guides?x=1', '/v1/guides/?x=1'],
      ['/v1/guides/index', '/v1/guides/'],
      ['/v1/guides/index.html', '/v1/guides/'],
      ['/v1/guides.html', '/v1/guides/'],
      ['/v1/introduction/', '/v1/introduction'],
      ['/v1/introduction.html?x=1', '/v1/introduction?x=1'],
      ['/v1/index.html', '/v1/'],
      ['/v1/examples/solar', '/v1/examples/solar/'],
    ] as const) {
      const response = await serve(path);

      assert.equal(response.status, 307, path);
      assert.equal(response.headers.get('Location'), location, path);
    }
  });

  it('carries the Link on a redirect under the base, not on the bare root', async () => {
    assert.equal(
      (await serve('/v1/guides')).headers.get('Link'),
      siteLineLink('/v1/'),
    );
    assert.equal((await serve('/v1')).headers.get('Link'), null);
  });

  it("sends a path into the worker's mounts to the unversioned mount with a 301", async () => {
    for (const [path, location] of [
      ['/v1/app', '/app'],
      ['/v1/app/foo?x=1', '/app/foo?x=1'],
      ['/v1/releases/lit-ui-router/', '/releases/lit-ui-router/'],
      ['/v1/gh/foo', '/gh/foo'],
    ] as const) {
      const response = await serve(path);

      assert.equal(response.status, 301, path);
      assert.equal(response.headers.get('Location'), location, path);
    }

    assert.equal((await serve('/v1/app-notes')).status, 404);
  });

  it('answers a miss with the nearest 404 page at 404, revalidating even under assets', async () => {
    for (const [path, body] of [
      ['/v1/nope', 'v1-404'],
      ['/v1/examples/nope', 'v1-404'],
      ['/v1/examples/solar/nope', 'solar-404'],
      ['/v1/examples/solar/a/b', 'solar-404'],
      ['/v1/assets/nope.js', 'v1-404'],
      ['/reference/ui-router-server/v0/nope', 'server-404'],
    ] as const) {
      const response = await serve(path);

      assert.equal(response.status, 404, path);
      assert.equal(await response.text(), body, path);
      assert.equal(response.headers.get('Content-Type'), 'text/html');
      assert.equal(response.headers.get('Cache-Control'), REVALIDATE);
    }
  });

  it('serves the 404 page itself at 200, as the binding did', async () => {
    const response = await serve('/v1/404');

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'v1-404');
  });

  it('answers a plain 404 when the line has no 404 page', async () => {
    const response = await serve('/packages/ui-router-server/v0/nope');

    assert.equal(response.status, 404);
    assert.match(response.headers.get('Content-Type') ?? '', /^text\/plain/);
  });

  it("serves a package line's page and reference, without the site-wide Link", async () => {
    const page = await serve('/packages/ui-router-server/v0');

    assert.equal(page.status, 200);
    assert.equal(await page.text(), 'server package page');
    assert.equal(page.headers.get('Link'), null);

    const reference = await serve('/reference/ui-router-server/v0');

    assert.equal(reference.status, 307);
    assert.equal(
      reference.headers.get('Location'),
      '/reference/ui-router-server/v0/',
    );

    const chunk = await serve(
      '/reference/ui-router-server/v0/assets/chunk.def456.js',
    );

    assert.equal(chunk.headers.get('Cache-Control'), IMMUTABLE);
  });

  it('answers a matching If-None-Match with a bodiless 304', async () => {
    const response = await serve('/v1/assets/app.abc123.js', {
      headers: { 'If-None-Match': `"${md5('app()')}"` },
    });

    assert.equal(response.status, 304);
    assert.equal(response.body, null);
    assert.equal(response.headers.get('ETag'), `"${md5('app()')}"`);
  });

  it('answers a HEAD from metadata alone, a miss included', async () => {
    const { bucket, reads } = memoryBucket();
    const page = await serve('/v1/introduction', { method: 'HEAD' }, bucket);

    assert.equal(page.status, 200);
    assert.equal(page.body, null);
    assert.equal(page.headers.get('Content-Type'), 'text/html');

    const miss = await serve('/v1/nope', { method: 'HEAD' }, bucket);

    assert.equal(miss.status, 404);
    assert.equal(miss.body, null);
    assert.ok(reads.every((read) => read.startsWith('head ')));
  });

  it('refuses other methods with a 405', async () => {
    const response = await serve('/v1/', { method: 'POST' });

    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'GET, HEAD');
  });

  it('answers a plain 503 without a bucket or when a read fails, never a main-site page', async () => {
    const failing: SnapshotBucket = {
      head: () => Promise.reject(new Error('R2 down')),
      get: () => Promise.reject(new Error('R2 down')),
    };

    for (const bucket of [undefined, failing]) {
      const response = await serveSnapshot(
        new Request(`${ORIGIN}/v1/guides/`),
        bucket,
        LINES,
      );

      assert.equal(response.status, 503);
      assert.match(response.headers.get('Content-Type') ?? '', /^text\/plain/);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    }
  });
});

describe('the site config', () => {
  const config = v.parse(
    v.object({
      assets: v.object({ run_worker_first: v.array(v.string()) }),
      r2_buckets: v.array(
        v.object({ binding: v.string(), bucket_name: v.string() }),
      ),
    }),
    parse(readFileSync(join(SITE, 'wrangler.jsonc'), 'utf8')),
  );

  it('runs the worker first for every root of every manifest line, bare and with its subpaths', () => {
    const first = new Set(config.assets.run_worker_first);

    for (const { id, roots } of SNAPSHOT_LINES)
      for (const root of roots) {
        assert.ok(first.has(root.slice(0, -1)), `${id}: ${root.slice(0, -1)}`);
        assert.ok(first.has(`${root}*`), `${id}: ${root}*`);
      }
  });

  it('binds the snapshot bucket', () => {
    assert.deepEqual(
      config.r2_buckets.find(({ binding }) => binding === 'DOCS_SNAPSHOTS'),
      {
        binding: 'DOCS_SNAPSHOTS',
        bucket_name: 'lit-ui-router-docs-snapshots',
      },
    );
  });

  it('matches the Link rule the bake moves from public/_headers', () => {
    const headers = readFileSync(join(SITE, 'public/_headers'), 'utf8');
    const link = /^\s*Link: (.*)$/m.exec(headers)?.[1];

    assert.equal(link, siteLineLink('/'));
  });
});

describe('the docs worker', () => {
  it('serves /v1 and every /v1/ path from the snapshot bucket', async () => {
    const { bucket, reads } = memoryBucket();

    // SAFETY: a /v1 request reads only the snapshot bucket.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- a one-binding object shares too few members with Env for one assertion
    const env = { DOCS_SNAPSHOTS: bucket } as unknown as Env;

    // SAFETY: a /v1 request never touches the context.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- an empty object shares no members with ExecutionContext
    const ctx = {} as unknown as ExecutionContext;

    const home = await worker.fetch(new Request(`${ORIGIN}/v1/`), env, ctx);

    assert.equal(home.status, 200);
    assert.equal(await home.text(), 'home');

    const bare = await worker.fetch(new Request(`${ORIGIN}/v1`), env, ctx);

    assert.equal(bare.status, 307);

    const mount = await worker.fetch(
      new Request(`${ORIGIN}/v1/releases/`),
      env,
      ctx,
    );

    assert.equal(mount.status, 301);
    assert.equal(mount.headers.get('Location'), '/releases/');
    assert.ok(reads.length > 0);
  });
});
