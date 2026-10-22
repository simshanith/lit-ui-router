import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import '../dom-shim.ts';
import type { DiffIndex, ReleaseDiffs } from '../releases/diff-data.ts';
import type { EdgeCache } from '../releases/edge-cache.ts';
import type { FileFilter } from '../releases/npm-diff/file-filter.ts';
import { serveReleases } from '../releases/serve.ts';
import { fixtureLedger } from './ledger-stub/rows.ts';
import { memoryEdge } from './memory-cache.ts';

const ORIGIN = 'http://docs.test';

const PAGE = '/releases/lit-ui-router/diff/1.9.0...1.10.0';

const INDEX: DiffIndex = {
  files: [
    {
      path: 'src/index.ts',
      kind: 'modified',
      added: 1,
      removed: 1,
      offset: 0,
      length: 10,
      filters: ['src', 'all'],
    },
  ],
  bytes: 10,
};

const PATCH = 'diff --git a/src/index.ts b/src/index.ts\n';

const streamOf = (text: string): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start: (controller) => {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });

/** A stub of the RELEASE_DIFFS binding that records each call; `fail` makes every call reject, as a broken binding does. */
const stubDiffs = ({ fail = false } = {}) => {
  const calls: string[] = [];

  const call = <T>(name: string, value: () => T): Promise<T> => {
    calls.push(name);

    return fail
      ? Promise.reject(new Error('NotPublished: lit-ui-router@1.10.0'))
      : Promise.resolve(value());
  };

  const diffs: ReleaseDiffs = {
    index: (pair) => call(`index ${pair.from}...${pair.to}`, () => INDEX),
    files: (pair, filter: FileFilter) =>
      call(`files ${pair.from}...${pair.to} ${filter}`, () =>
        streamOf(`${filter}:${PATCH}`),
      ),
    patch: (pair) =>
      call(`patch ${pair.from}...${pair.to}`, () => streamOf(PATCH)),
  };

  return { diffs, calls };
};

const serve = (
  path: string,
  diffs: ReleaseDiffs,
  init?: RequestInit,
  edge?: EdgeCache,
) =>
  serveReleases(
    new Request(`${ORIGIN}${path}`, init),
    fixtureLedger,
    diffs,
    edge,
  );

const IMMUTABLE = 'public, max-age=31536000, immutable';

describe('the diff page data routes', () => {
  it('serves the index as immutable json', async () => {
    const { diffs, calls } = stubDiffs();
    const response = await serve(`${PAGE}/index.json`, diffs);

    assert.equal(response?.status, 200);
    assert.equal(response?.headers.get('Content-Type'), 'application/json');
    assert.equal(response?.headers.get('Cache-Control'), IMMUTABLE);
    assert.deepEqual(await response?.json(), INDEX);
    assert.deepEqual(calls, ['index 1.9.0...1.10.0']);
  });

  it("serves a preset's files from the binding", async () => {
    const { diffs, calls } = stubDiffs();
    const response = await serve(`${PAGE}/files/types`, diffs);

    assert.equal(response?.status, 200);
    assert.equal(
      response?.headers.get('Content-Type'),
      'text/x-diff; charset=utf-8',
    );
    assert.equal(response?.headers.get('Cache-Control'), IMMUTABLE);
    assert.equal(await response?.text(), `types:${PATCH}`);
    assert.deepEqual(calls, ['files 1.9.0...1.10.0 types']);
  });

  it('serves the whole patch as a download', async () => {
    const { diffs, calls } = stubDiffs();
    const response = await serve(`${PAGE}/patch`, diffs);

    assert.equal(response?.status, 200);
    assert.equal(
      response?.headers.get('Content-Disposition'),
      'attachment; filename="lit-ui-router-1.9.0...1.10.0.patch"',
    );
    assert.equal(await response?.text(), PATCH);
    assert.deepEqual(calls, ['patch 1.9.0...1.10.0']);
  });

  it('asks for a reversed pair as written', async () => {
    const { diffs, calls } = stubDiffs();

    await serve(
      '/releases/lit-ui-router/diff/1.10.0...1.9.0/index.json',
      diffs,
    );

    assert.deepEqual(calls, ['index 1.10.0...1.9.0']);
  });

  it('answers HEAD without a body', async () => {
    const { diffs } = stubDiffs();

    const response = await serve(`${PAGE}/index.json`, diffs, {
      method: 'HEAD',
    });

    assert.equal(response?.status, 200);
    assert.equal(response?.body, null);
  });

  const unknown = [
    '/releases/lit-ui-router/diff/1.9.0...9.9.9/index.json',
    '/releases/lit-ui-router/diff/9.9.9...1.10.0/patch',
    '/releases/not-a-package/diff/1.9.0...1.10.0/index.json',
    `${PAGE}/files/everything`,
  ];

  for (const path of unknown) {
    it(`answers 404 for ${path} before calling the binding`, async () => {
      const { diffs, calls } = stubDiffs();
      const response = await serve(path, diffs);

      assert.equal(response?.status, 404);
      assert.deepEqual(calls, []);
    });
  }

  it('answers 404 before calling the binding for a version npm never published', async () => {
    const { diffs, calls } = stubDiffs();

    const response = await serveReleases(
      new Request(`${ORIGIN}${PAGE}/index.json`),
      {
        ...fixtureLedger,
        versions: async (name) =>
          (await fixtureLedger.versions(name)).map((row) =>
            row.version === '1.9.0' ? { ...row, npm_integrity: null } : row,
          ),
      },
      diffs,
    );

    assert.equal(response?.status, 404);
    assert.deepEqual(calls, []);
  });

  for (const route of ['index.json', 'files/src', 'patch']) {
    it(`answers ${route} with an uncached 503 when the binding fails`, async () => {
      const { diffs } = stubDiffs({ fail: true });
      const memory = memoryEdge();
      const response = await serve(`${PAGE}/${route}`, diffs, {}, memory.edge);
      await memory.settled();

      assert.equal(response?.status, 503);
      assert.equal(response?.headers.get('Cache-Control'), 'no-store');
      assert.equal(memory.entries.size, 0);
    });
  }
});

describe('the diff page data routes at the edge', () => {
  const KEY = `${ORIGIN}${PAGE}/files/src`;

  it('stores an answer under the GET url and serves it without the ledger or the binding', async () => {
    const memory = memoryEdge();
    const first = stubDiffs();

    const miss = await serve(`${PAGE}/files/src`, first.diffs, {}, memory.edge);
    assert.equal(await miss?.text(), `src:${PATCH}`);
    await memory.settled();

    assert.deepEqual([...memory.entries.keys()], [KEY]);
    assert.equal(
      memory.entries.get(KEY)?.headers.get('Cache-Control'),
      IMMUTABLE,
    );

    const second = stubDiffs({ fail: true });
    memory.advance(365 * 86_400_000);

    const hit = await serveReleases(
      new Request(KEY),
      {
        packages: () => Promise.reject(new Error('ledger read')),
        tagged: () => Promise.reject(new Error('ledger read')),
        versions: () => Promise.reject(new Error('ledger read')),
      },
      second.diffs,
      memory.edge,
    );

    assert.equal(hit?.status, 200);
    assert.equal(hit?.headers.get('Cache-Control'), IMMUTABLE);
    assert.equal(await hit?.text(), `src:${PATCH}`);
    assert.deepEqual(second.calls, []);
    assert.equal(memory.background(), 1, 'an immutable hit never refreshes');
  });

  it('answers HEAD from the GET entry', async () => {
    const memory = memoryEdge();
    const { diffs, calls } = stubDiffs();

    await serve(`${PAGE}/index.json`, diffs, {}, memory.edge);
    await memory.settled();

    const head = await serve(
      `${PAGE}/index.json`,
      diffs,
      { method: 'HEAD' },
      memory.edge,
    );

    assert.equal(head?.status, 200);
    assert.equal(head?.body, null);
    assert.deepEqual(calls, ['index 1.9.0...1.10.0']);
  });
});
