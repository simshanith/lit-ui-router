import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type DiffBucket,
  type DiffPair,
  indexKey,
  patchKey,
  type StoredBody,
} from '@tools/npm-diff';
import { type DiffIndex, indexPatch } from '@tools/npm-diff/diff-index';

import '../dom-shim.ts';
import {
  type DiffBuilder,
  type DiffSource,
  diffSource,
} from '../releases/diff-data.ts';
import { isDiffData } from '../releases/routes.ts';
import { serveReleases } from '../releases/serve.ts';
import { fixtureLedger } from './ledger-stub/rows.ts';

const ORIGIN = 'http://docs.test';

const PAGE = '/releases/lit-ui-router/diff/1.9.0...1.10.0';

const section = (path: string, header = '', body = '@@ -1,1 +1,1 @@\n-a\n+b') =>
  `diff --git a/${path} b/${path}\n${header}index v1.9.0..v1.10.0 100644\n--- a/${path}\n+++ b/${path}\n${body}\n`;

const PATCH_TEXT = [
  section('dist/index.js'),
  section('src/index.ts'),
  section('dist/index.d.ts'),
  section('package.json'),
].join('');

const PATCH = new Uint8Array(new TextEncoder().encode(PATCH_TEXT));

const PAIR: DiffPair = { name: 'lit-ui-router', from: '1.9.0', to: '1.10.0' };

const memoryBucket = (objects = new Map<string, Uint8Array>()) => {
  const puts: string[] = [];

  const bodyOf = (bytes: Uint8Array): StoredBody => ({
    arrayBuffer: () => new Response(bytes.slice()).arrayBuffer(),
    text: () => Promise.resolve(new TextDecoder().decode(bytes)),
    body: new ReadableStream<Uint8Array>({
      start: (controller) => {
        controller.enqueue(bytes.slice());
        controller.close();
      },
    }),
  });

  const bucket: DiffBucket = {
    get: (key, options) => {
      const stored = objects.get(key);
      const range = options?.range;

      return Promise.resolve(
        stored === undefined
          ? null
          : bodyOf(
              range
                ? stored.subarray(range.offset, range.offset + range.length)
                : stored,
            ),
      );
    },
    put: (key, value) => {
      puts.push(key);
      objects.set(key, value);

      return Promise.resolve(null);
    },
  };

  return { bucket, objects, puts };
};

/** A bucket holding the pair's complete entry. */
const storedBucket = () =>
  memoryBucket(
    new Map([
      [patchKey(PAIR), PATCH],
      [
        indexKey(PAIR),
        new TextEncoder().encode(JSON.stringify(indexPatch(PATCH))),
      ],
    ]),
  );

/** A DiffSource over the stored entry that records each pair it is asked for. */
const recordingSource = () => {
  const asked: DiffPair[] = [];
  const read = diffSource(storedBucket().bucket, unreachable);

  const source: DiffSource = (pair) => {
    asked.push(pair);

    return read(pair);
  };

  return { source, asked };
};

const unreachable: DiffBuilder = {
  releaseDiff: () => Promise.reject(new Error('no releaseDiff method')),
};

const serve = (path: string, source: DiffSource, init?: RequestInit) =>
  serveReleases(new Request(`${ORIGIN}${path}`, init), fixtureLedger, source);

describe('the diff page data routes', () => {
  it('serves the index as immutable json', async () => {
    const { source, asked } = recordingSource();
    const response = await serve(`${PAGE}/index.json`, source);

    assert.equal(response?.status, 200);
    assert.equal(response?.headers.get('Content-Type'), 'application/json');
    assert.equal(
      response?.headers.get('Cache-Control'),
      'public, max-age=31536000, immutable',
    );
    assert.deepEqual(await response?.json(), indexPatch(PATCH));
    assert.deepEqual(asked, [PAIR]);
  });

  it("serves only a preset's files, in patch order", async () => {
    const { source } = recordingSource();

    const text = async (preset: string) =>
      (await serve(`${PAGE}/files/${preset}`, source))?.text();

    assert.equal(
      await text('src'),
      section('src/index.ts') + section('package.json'),
    );
    assert.equal(await text('js'), section('dist/index.js'));
    assert.equal(await text('types'), section('dist/index.d.ts'));
    assert.equal(await text('all'), PATCH_TEXT);
  });

  it('serves the whole patch as a download', async () => {
    const { source } = recordingSource();
    const response = await serve(`${PAGE}/patch`, source);

    assert.equal(response?.status, 200);
    assert.equal(
      response?.headers.get('Content-Type'),
      'text/x-diff; charset=utf-8',
    );
    assert.equal(
      response?.headers.get('Content-Disposition'),
      'attachment; filename="lit-ui-router-1.9.0...1.10.0.patch"',
    );
    assert.equal(await response?.text(), PATCH_TEXT);
  });

  it('answers HEAD without a body', async () => {
    const { source } = recordingSource();

    const response = await serve(`${PAGE}/index.json`, source, {
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
    it(`answers 404 for ${path} before reading or building a diff`, async () => {
      const { source, asked } = recordingSource();
      const response = await serve(path, source);

      assert.equal(response?.status, 404);
      assert.deepEqual(asked, []);
    });
  }

  it('answers 404 before reading a diff for a version npm never published', async () => {
    const { source, asked } = recordingSource();

    const response = await serveReleases(
      new Request(`${ORIGIN}${PAGE}/index.json`),
      {
        ...fixtureLedger,
        versions: async (name) =>
          (await fixtureLedger.versions(name)).map((row) =>
            row.version === '1.9.0' ? { ...row, npm_integrity: null } : row,
          ),
      },
      source,
    );

    assert.equal(response?.status, 404);
    assert.deepEqual(asked, []);
  });

  it('names only the data routes as edge-cacheable', () => {
    assert.ok(isDiffData(`${PAGE}/index.json`));
    assert.ok(isDiffData(`${PAGE}/files/src`));
    assert.ok(isDiffData(`${PAGE}/patch`));
    assert.ok(isDiffData('/releases/%40scope%2Fpkg/diff/1.0.0...2.0.0/patch'));
    assert.ok(!isDiffData(`${PAGE}/`));
    assert.ok(!isDiffData('/releases/lit-ui-router/diff'));
    assert.ok(!isDiffData('/releases/lit-ui-router/1.10.0/'));
  });
});

describe('diffSource', () => {
  /** A builder that stores the entry, as the ledger's ReleaseDiff object does, and counts its calls. */
  const storingBuilder = (
    bucket: DiffBucket,
    objects: Map<string, Uint8Array>,
  ) => {
    let calls = 0;

    const builder: DiffBuilder = {
      releaseDiff: (pair): Promise<DiffIndex> => {
        calls++;

        const index = indexPatch(PATCH);

        objects.set(patchKey(pair), PATCH);
        objects.set(
          indexKey(pair),
          new TextEncoder().encode(JSON.stringify(index)),
        );

        return Promise.resolve(index);
      },
    };

    return { builder, calls: () => calls, bucket };
  };

  it('reads a stored entry without asking the ledger', async () => {
    const { bucket, objects } = storedBucket();
    const { builder, calls } = storingBuilder(bucket, objects);
    const diff = await diffSource(bucket, builder)(PAIR);

    assert.equal(calls(), 0);
    assert.deepEqual(diff.index, indexPatch(PATCH));
  });

  it("asks the pair's object on a miss, then reads what it stored", async () => {
    const { bucket, objects, puts } = memoryBucket();
    const { builder, calls } = storingBuilder(bucket, objects);
    const diff = await diffSource(bucket, builder)(PAIR);

    assert.equal(calls(), 1);
    assert.equal(
      await diff.files(diff.index.files.slice(1, 2)),
      section('src/index.ts'),
    );
    assert.deepEqual(puts, [], 'the docs worker never writes the bucket');
  });

  it('builds in place, storing nothing, when the ledger cannot', async () => {
    const { bucket, puts } = memoryBucket();
    const built: DiffPair[] = [];

    const diff = await diffSource(bucket, unreachable, (pair) => {
      built.push(pair);

      return Promise.resolve(PATCH);
    })(PAIR);

    assert.deepEqual(built, [PAIR]);
    assert.deepEqual(diff.index, indexPatch(PATCH));
    assert.equal(await diff.files(diff.index.files), PATCH_TEXT);
    assert.deepEqual(puts, []);
  });
});
