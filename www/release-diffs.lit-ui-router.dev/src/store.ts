// Built release diffs in R2: one entry per version pair, its patch, each preset's sections and then its index, never rewritten.
import * as v from 'valibot';

import { type DiffIndex, indexPatch } from './diff-index.ts';
import { FILE_FILTERS, type FileFilter } from './file-filter.ts';
import { npmDiff } from './registry.ts';

const PACKAGE_NAME = /^(?:@[a-z0-9][\w.~-]*\/)?[a-z0-9][\w.~-]*$/;

const VERSION = /^\d+\.\d+\.\d+(?:-[\da-z.-]+)?(?:\+[\da-z.-]+)?$/i;

/** Two versions of one package, in the order `npm diff` compares them; each pair names an object and an R2 prefix, so its fields are checked. */
export const DiffPairSchema = v.strictObject({
  name: v.pipe(v.string(), v.regex(PACKAGE_NAME)),
  from: v.pipe(v.string(), v.regex(VERSION)),
  to: v.pipe(v.string(), v.regex(VERSION)),
});

export type DiffPair = v.InferOutput<typeof DiffPairSchema>;

/** A stored object's body. */
export interface StoredBody {
  text(): Promise<string>;
  readonly body: ReadableStream<Uint8Array>;
}

/** The R2 calls the store makes, which an `R2Bucket` binding answers. */
export interface DiffBucket {
  get(key: string): Promise<StoredBody | null>;
  put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<object | null>;
}

/** Bump to rebuild every entry under a new prefix when the stored format changes. */
export const LAYOUT = 'v1';

/** The key prefix of a pair's entry. */
export const entryPrefix = ({ name, from, to }: DiffPair): string =>
  `${LAYOUT}/${name}/${from}...${to}/`;

export const patchKey = (pair: DiffPair): string => `${entryPrefix(pair)}patch`;

export const filesKey = (pair: DiffPair, filter: FileFilter): string =>
  `${entryPrefix(pair)}files/${filter}`;

export const indexKey = (pair: DiffPair): string =>
  `${entryPrefix(pair)}index.json`;

/** The name of the one object that builds a pair's entry; a reversed pair is another entry. */
export const objectName = ({ name, from, to }: DiffPair): string =>
  `${name}@${from}...${to}`;

export const PATCH_TYPE = 'text/x-diff; charset=utf-8';

export const INDEX_TYPE = 'application/json';

const encoder = new TextEncoder();

/** The bytes `npm diff` prints for a pair: the patch and a final newline, or nothing for identical files. */
export const buildPatch = async (
  pair: DiffPair,
): Promise<Uint8Array<ArrayBuffer>> => {
  const patch = await npmDiff(pair.name, pair.from, pair.to);

  // workerd types encode()'s buffer as ArrayBufferLike, which a Response body refuses.
  return new Uint8Array(encoder.encode(patch === '' ? '' : `${patch}\n`));
};

/** The sections of the files `filter` shows, in patch order. */
export const sectionsOf = (
  patch: Uint8Array,
  { files }: DiffIndex,
  filter: FileFilter,
): Uint8Array => {
  const shown = files.filter(({ filters }) => filters.includes(filter));

  const out = new Uint8Array(
    shown.reduce((total, { length }) => total + length, 0),
  );

  let at = 0;

  for (const { offset, length } of shown) {
    out.set(patch.subarray(offset, offset + length), at);
    at += length;
  }

  return out;
};

/** A pair's index, or null while its entry is incomplete; the index is written last. */
export const readIndex = async (
  bucket: DiffBucket,
  pair: DiffPair,
): Promise<DiffIndex | null> => {
  const stored = await bucket.get(indexKey(pair));

  // SAFETY: only writeEntry writes this key, from indexPatch's output.
  return stored ? (JSON.parse(await stored.text()) as DiffIndex) : null;
};

/** Stores a pair's patch and each preset's sections, then its index, and returns the index. */
export const writeEntry = async (
  bucket: DiffBucket,
  pair: DiffPair,
  patch: Uint8Array,
): Promise<DiffIndex> => {
  const index = indexPatch(patch);
  const asPatch = { httpMetadata: { contentType: PATCH_TYPE } };

  await Promise.all([
    bucket.put(patchKey(pair), patch, asPatch),
    ...FILE_FILTERS.map((filter) =>
      bucket.put(
        filesKey(pair, filter),
        sectionsOf(patch, index, filter),
        asPatch,
      ),
    ),
  ]);
  await bucket.put(indexKey(pair), encoder.encode(JSON.stringify(index)), {
    httpMetadata: { contentType: INDEX_TYPE },
  });

  return index;
};

/** A stored object of a complete entry, as a stream. */
export const readStored = async (
  bucket: DiffBucket,
  key: string,
): Promise<ReadableStream<Uint8Array>> => {
  const stored = await bucket.get(key);

  if (!stored) throw new Error(`${key} is missing`);

  return stored.body;
};

/** One pair's stored entry: read from R2, built and stored on a miss, with one build in flight at a time. */
export class DiffEntry {
  readonly #bucket: DiffBucket;
  readonly #pair: DiffPair;
  readonly #build: (pair: DiffPair) => Promise<Uint8Array>;
  #pending: Promise<DiffIndex> | undefined;

  constructor(bucket: DiffBucket, pair: DiffPair, build = buildPatch) {
    this.#bucket = bucket;
    this.#pair = pair;
    this.#build = build;
  }

  /** The pair's index, building the entry first if R2 has no complete one; concurrent calls share one read and one build. */
  index(): Promise<DiffIndex> {
    this.#pending ??= this.#load().finally(() => {
      this.#pending = undefined;
    });

    return this.#pending;
  }

  async #load(): Promise<DiffIndex> {
    const stored = await readIndex(this.#bucket, this.#pair);

    return (
      stored ??
      writeEntry(this.#bucket, this.#pair, await this.#build(this.#pair))
    );
  }
}
