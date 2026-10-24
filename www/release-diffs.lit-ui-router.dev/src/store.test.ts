import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { indexPatch } from './diff-index.ts';
import { FILE_FILTERS } from './file-filter.ts';
import { formatDiff } from './format-diff.ts';
import { files } from './npm-diff-fixtures.ts';
import {
  type DiffBucket,
  DiffEntry,
  type DiffPair,
  filesKey,
  indexKey,
  objectName,
  patchKey,
  readIndex,
  sectionsOf,
  type StoredBody,
} from './store.ts';

const encoder = new TextEncoder();

const decoder = new TextDecoder();

/** An in-memory bucket that records each put's key. */
const memoryBucket = () => {
  const objects = new Map<string, Uint8Array>();
  const puts: string[] = [];

  const bodyOf = (bytes: Uint8Array): StoredBody => ({
    text: () => Promise.resolve(decoder.decode(bytes)),
    body: new ReadableStream<Uint8Array>({
      start: (controller) => {
        controller.enqueue(bytes.slice());
        controller.close();
      },
    }),
  });

  const bucket: DiffBucket = {
    get: (key) => {
      const stored = objects.get(key);

      return Promise.resolve(stored === undefined ? null : bodyOf(stored));
    },
    put: (key, value) => {
      puts.push(key);
      objects.set(key, value);

      return Promise.resolve(null);
    },
  };

  return { bucket, objects, puts };
};

const PAIR: DiffPair = { name: '@scope/pkg', from: '1.0.0', to: '2.0.0' };

const PATCH = encoder.encode(
  `${formatDiff({
    a: files(['src/a.ts', 'a\n'], ['dist/a.js', 'a\n'], ['dist/a.d.ts', 'a\n']),
    b: files(['src/a.ts', 'A\n'], ['dist/a.js', 'A\n'], ['dist/a.d.ts', 'A\n']),
    versions: { a: PAIR.from, b: PAIR.to },
  })}\n`,
);

/** Every key an entry writes, the index last. */
const ENTRY_KEYS = [
  patchKey(PAIR),
  ...FILE_FILTERS.map((filter) => filesKey(PAIR, filter)),
  indexKey(PAIR),
];

/** A build that counts its calls and resolves when `release` is called. */
const gatedBuild = () => {
  let calls = 0;
  let release = () => {};

  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  return {
    build: async () => {
      calls++;
      await gate;

      return PATCH;
    },
    calls: () => calls,
    release: () => release(),
  };
};

describe('the R2 layout', () => {
  it('keys a pair under its layout version, package and range', () => {
    assert.equal(patchKey(PAIR), 'v1/@scope/pkg/1.0.0...2.0.0/patch');
    assert.equal(filesKey(PAIR, 'js'), 'v1/@scope/pkg/1.0.0...2.0.0/files/js');
    assert.equal(indexKey(PAIR), 'v1/@scope/pkg/1.0.0...2.0.0/index.json');
    assert.equal(objectName(PAIR), '@scope/pkg@1.0.0...2.0.0');
    assert.notEqual(
      objectName({ ...PAIR, from: PAIR.to, to: PAIR.from }),
      objectName(PAIR),
    );
  });
});

describe('sectionsOf', () => {
  const index = indexPatch(PATCH);

  const text = (filter: (typeof FILE_FILTERS)[number]) =>
    decoder.decode(sectionsOf(PATCH, index, filter));

  it("joins the sections of a preset's files, in patch order", () => {
    assert.match(text('src'), /^diff --git a\/src\/a\.ts b\/src\/a\.ts\n/);
    assert.doesNotMatch(text('src'), /dist\//);
    assert.match(text('js'), /^diff --git a\/dist\/a\.js /);
    assert.match(text('types'), /^diff --git a\/dist\/a\.d\.ts /);
    assert.doesNotMatch(text('types'), /a\/dist\/a\.js /);
  });

  it('keeps the whole patch under All', () => {
    assert.deepEqual(sectionsOf(PATCH, index, 'all'), PATCH);
  });
});

describe('DiffEntry', () => {
  it("builds on a miss, writing the patch and each preset's sections before the index, then reads R2", async () => {
    const { bucket, objects, puts } = memoryBucket();
    const builds = gatedBuild();
    builds.release();

    const index = await new DiffEntry(bucket, PAIR, builds.build).index();

    assert.deepEqual(puts, ENTRY_KEYS);
    assert.deepEqual(objects.get(patchKey(PAIR)), PATCH);
    assert.deepEqual(objects.get(filesKey(PAIR, 'all')), PATCH);
    assert.deepEqual(await readIndex(bucket, PAIR), index);

    // Another object over the same bucket finds the entry complete.
    const again = gatedBuild();

    assert.deepEqual(
      await new DiffEntry(bucket, PAIR, again.build).index(),
      index,
    );
    assert.equal(again.calls(), 0);
    assert.equal(puts.length, ENTRY_KEYS.length);
  });

  it('rebuilds an entry whose index never landed', async () => {
    const { bucket, objects, puts } = memoryBucket();
    objects.set(patchKey(PAIR), encoder.encode('partial'));

    const builds = gatedBuild();
    builds.release();
    await new DiffEntry(bucket, PAIR, builds.build).index();

    assert.equal(builds.calls(), 1);
    assert.deepEqual(objects.get(patchKey(PAIR)), PATCH);
    assert.deepEqual(puts, ENTRY_KEYS);
  });

  it('shares one build between concurrent calls', async () => {
    const { bucket, puts } = memoryBucket();
    const builds = gatedBuild();
    const entry = new DiffEntry(bucket, PAIR, builds.build);

    const pending = Promise.all([entry.index(), entry.index(), entry.index()]);

    builds.release();

    const [first, , last] = await pending;

    assert.equal(builds.calls(), 1);
    assert.equal(first, last);
    assert.deepEqual(puts, ENTRY_KEYS);
  });

  it('builds again after a failed build', async () => {
    const { bucket, puts } = memoryBucket();
    let calls = 0;

    const entry = new DiffEntry(bucket, PAIR, () => {
      calls++;

      return calls === 1
        ? Promise.reject(new Error('registry down'))
        : Promise.resolve(PATCH);
    });

    await assert.rejects(entry.index(), /registry down/);
    assert.deepEqual(puts, []);

    await entry.index();
    assert.equal(calls, 2);
    assert.deepEqual(puts, ENTRY_KEYS);
  });
});
