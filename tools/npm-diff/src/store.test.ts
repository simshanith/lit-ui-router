import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { DiffFile } from './diff-index.ts';
import { formatDiff } from './format-diff.ts';
import { files } from './npm-diff-fixtures.ts';
import {
  type ByteRange,
  type DiffBucket,
  DiffEntry,
  type DiffPair,
  indexKey,
  objectName,
  patchKey,
  rangesOf,
  readIndex,
  readSections,
  type StoredBody,
} from './store.ts';

const encoder = new TextEncoder();

/** An in-memory bucket that records each put's key and each get's range. */
const memoryBucket = () => {
  const objects = new Map<string, Uint8Array>();
  const puts: string[] = [];
  const gets: { key: string; range?: ByteRange }[] = [];

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
      gets.push({ key, ...options });

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

  return { bucket, objects, puts, gets };
};

const PAIR: DiffPair = { name: '@scope/pkg', from: '1.0.0', to: '2.0.0' };

const PATCH = encoder.encode(
  `${formatDiff({
    a: files(['a.js', 'a\n'], ['b.js', 'b\n'], ['c.js', 'c\n']),
    b: files(['a.js', 'A\n'], ['b.js', 'B\n'], ['c.js', 'C\n']),
    versions: { a: PAIR.from, b: PAIR.to },
  })}\n`,
);

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
    assert.equal(indexKey(PAIR), 'v1/@scope/pkg/1.0.0...2.0.0/index.json');
    assert.equal(objectName(PAIR), '@scope/pkg@1.0.0...2.0.0');
    assert.notEqual(
      objectName({ ...PAIR, from: PAIR.to, to: PAIR.from }),
      objectName(PAIR),
    );
  });
});

describe('DiffEntry', () => {
  it('builds on a miss, writing the patch before the index, then reads R2', async () => {
    const { bucket, objects, puts } = memoryBucket();
    const builds = gatedBuild();
    builds.release();

    const index = await new DiffEntry(bucket, PAIR, builds.build).index();

    assert.deepEqual(puts, [patchKey(PAIR), indexKey(PAIR)]);
    assert.deepEqual(objects.get(patchKey(PAIR)), PATCH);
    assert.deepEqual(await readIndex(bucket, PAIR), index);

    // Another object over the same bucket finds the entry complete.
    const again = gatedBuild();

    assert.deepEqual(
      await new DiffEntry(bucket, PAIR, again.build).index(),
      index,
    );
    assert.equal(again.calls(), 0);
    assert.equal(puts.length, 2);
  });

  it('rebuilds an entry whose index never landed', async () => {
    const { bucket, objects, puts } = memoryBucket();
    objects.set(patchKey(PAIR), encoder.encode('partial'));

    const builds = gatedBuild();
    builds.release();
    await new DiffEntry(bucket, PAIR, builds.build).index();

    assert.equal(builds.calls(), 1);
    assert.deepEqual(objects.get(patchKey(PAIR)), PATCH);
    assert.deepEqual(puts, [patchKey(PAIR), indexKey(PAIR)]);
  });

  it('shares one build between concurrent calls', async () => {
    const { bucket, puts } = memoryBucket();
    const builds = gatedBuild();
    const entry = new DiffEntry(bucket, PAIR, builds.build);

    const pending = Promise.all([
      entry.index(),
      entry.files(['b.js']),
      entry.patch(),
      entry.index(),
    ]);

    builds.release();

    const [first, , , last] = await pending;

    assert.equal(builds.calls(), 1);
    assert.equal(first, last);
    assert.deepEqual(puts, [patchKey(PAIR), indexKey(PAIR)]);
  });

  it("reads only the asked files' sections, in patch order", async () => {
    const { bucket, gets } = memoryBucket();
    const builds = gatedBuild();
    builds.release();

    const entry = new DiffEntry(bucket, PAIR, builds.build);
    const { files: listed } = await entry.index();
    const text = await entry.files(['c.js', 'a.js']);
    const decoded = new TextDecoder().decode(PATCH);

    const section = (file: DiffFile | undefined) =>
      file
        ? new TextDecoder().decode(
            PATCH.subarray(file.offset, file.offset + file.length),
          )
        : '';

    assert.equal(text, section(listed[0]) + section(listed[2]));
    assert.ok(decoded.startsWith(section(listed[0])));
    assert.ok(
      gets.some(({ key, range }) => key === patchKey(PAIR) && range),
      'read the patch by range',
    );
  });

  it('streams the whole patch', async () => {
    const { bucket } = memoryBucket();
    const builds = gatedBuild();
    builds.release();

    const stream = await new DiffEntry(bucket, PAIR, builds.build).patch();

    assert.deepEqual(
      new Uint8Array(await new Response(stream).arrayBuffer()),
      PATCH,
    );
  });
});

describe('rangesOf', () => {
  const at = (offset: number, length: number): DiffFile => ({
    path: `${offset}`,
    kind: 'modified',
    added: 0,
    removed: 0,
    offset,
    length,
  });

  it('merges neighbors within 16 KiB and keeps far files apart', () => {
    assert.deepEqual(
      rangesOf([at(100_000, 10), at(0, 10), at(20, 30)]).map(
        ({ range }) => range,
      ),
      [
        { offset: 0, length: 50 },
        { offset: 100_000, length: 10 },
      ],
    );
  });
});

describe('readSections', () => {
  it('slices multibyte sections out of merged ranges', async () => {
    const bytes = encoder.encode('ünïcode|skip|ëñd');
    const first = fileAt(0, encoder.encode('ünïcode').length);

    const last = fileAt(
      bytes.length - encoder.encode('ëñd').length,
      encoder.encode('ëñd').length,
    );

    assert.equal(
      await readSections(
        (range) =>
          Promise.resolve(
            bytes.subarray(range.offset, range.offset + range.length),
          ),
        [last, first],
      ),
      'ünïcodeëñd',
    );
  });
});

function fileAt(offset: number, length: number): DiffFile {
  return {
    path: `${offset}`,
    kind: 'modified',
    added: 0,
    removed: 0,
    offset,
    length,
  };
}
