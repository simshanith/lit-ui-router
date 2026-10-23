// Built release diffs in R2: one entry per version pair, its patch and then its index, never rewritten.
import { type DiffFile, type DiffIndex, indexPatch } from './diff-index.ts';
import { npmDiff } from './registry.ts';

/** Two versions of one package, in the order `npm diff` compares them. */
export interface DiffPair {
  name: string;
  from: string;
  to: string;
}

/** A byte range of a stored object. */
export interface ByteRange {
  offset: number;
  length: number;
}

/** A stored object's body. */
export interface StoredBody {
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  readonly body: ReadableStream<Uint8Array>;
}

/** The R2 calls the store makes, which an `R2Bucket` binding answers. */
export interface DiffBucket {
  get(key: string, options?: { range?: ByteRange }): Promise<StoredBody | null>;
  put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<object | null>;
}

/** Bump to rebuild every entry under a new prefix when the patch or index format changes. */
export const LAYOUT = 'v1';

/** The key prefix of a pair's entry. */
export const entryPrefix = ({ name, from, to }: DiffPair): string =>
  `${LAYOUT}/${name}/${from}...${to}/`;

export const patchKey = (pair: DiffPair): string => `${entryPrefix(pair)}patch`;

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

/** A pair's index, or null while its entry is incomplete; the index is written last. */
export const readIndex = async (
  bucket: DiffBucket,
  pair: DiffPair,
): Promise<DiffIndex | null> => {
  const stored = await bucket.get(indexKey(pair));

  // SAFETY: only writeEntry writes this key, from indexPatch's output.
  return stored ? (JSON.parse(await stored.text()) as DiffIndex) : null;
};

/** Stores a pair's patch, then its index, and returns the index. */
export const writeEntry = async (
  bucket: DiffBucket,
  pair: DiffPair,
  patch: Uint8Array,
): Promise<DiffIndex> => {
  const index = indexPatch(patch);

  await bucket.put(patchKey(pair), patch, {
    httpMetadata: { contentType: PATCH_TYPE },
  });
  await bucket.put(indexKey(pair), encoder.encode(JSON.stringify(index)), {
    httpMetadata: { contentType: INDEX_TYPE },
  });

  return index;
};

/** Ranges closer than this read as one. */
const GAP = 16 * 1024;

/** `files`' sections in patch order, neighbors within `GAP` bytes merged into one range. */
export const rangesOf = (
  files: readonly DiffFile[],
): { range: ByteRange; files: DiffFile[] }[] => {
  const ordered = [...files].sort((a, b) => a.offset - b.offset);
  const ranges: { range: ByteRange; files: DiffFile[] }[] = [];

  for (const file of ordered) {
    const last = ranges.at(-1);
    const end = last && last.range.offset + last.range.length;

    if (last && end !== undefined && file.offset - end <= GAP) {
      last.range.length = file.offset + file.length - last.range.offset;
      last.files.push(file);
    } else {
      ranges.push({
        range: { offset: file.offset, length: file.length },
        files: [file],
      });
    }
  }

  return ranges;
};

const utf8 = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });

/** `files`' sections of a patch, in patch order, read through `read` one merged range at a time. */
export const readSections = async (
  read: (range: ByteRange) => Promise<Uint8Array>,
  files: readonly DiffFile[],
): Promise<string> => {
  const parts = await Promise.all(
    rangesOf(files).map(async ({ range, files: inRange }) => {
      const bytes = await read(range);

      return inRange
        .map((file) =>
          utf8.decode(
            bytes.subarray(
              file.offset - range.offset,
              file.offset - range.offset + file.length,
            ),
          ),
        )
        .join('');
    }),
  );

  return parts.join('');
};

/** A range of a pair's stored patch. */
export const patchRange =
  (bucket: DiffBucket, pair: DiffPair) =>
  async (range: ByteRange): Promise<Uint8Array> => {
    const stored = await bucket.get(patchKey(pair), { range });

    if (!stored) throw new Error(`${patchKey(pair)} is missing`);

    return new Uint8Array(await stored.arrayBuffer());
  };

/** A pair's stored patch as a stream. */
export const readPatch = async (
  bucket: DiffBucket,
  pair: DiffPair,
): Promise<ReadableStream<Uint8Array>> => {
  const stored = await bucket.get(patchKey(pair));

  if (!stored) throw new Error(`${patchKey(pair)} is missing`);

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

  /** The sections of the files at `paths`, in patch order. */
  async files(paths: readonly string[]): Promise<string> {
    const wanted = new Set(paths);
    const { files } = await this.index();

    return readSections(
      patchRange(this.#bucket, this.#pair),
      files.filter(({ path }) => wanted.has(path)),
    );
  }

  /** The whole patch, as `npm diff` prints it. */
  async patch(): Promise<ReadableStream<Uint8Array>> {
    await this.index();

    return readPatch(this.#bucket, this.#pair);
  }

  async #load(): Promise<DiffIndex> {
    const stored = await readIndex(this.#bucket, this.#pair);

    return (
      stored ??
      writeEntry(this.#bucket, this.#pair, await this.#build(this.#pair))
    );
  }
}
