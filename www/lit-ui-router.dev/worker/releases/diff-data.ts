// A version pair's diff for the diff page's data routes: read from R2, built by the release ledger's ReleaseDiff object on a miss.
import {
  buildPatch,
  type ByteRange,
  type DiffBucket,
  type DiffPair,
  objectName,
  patchRange,
  readIndex,
  readPatch,
  readSections,
} from '@tools/npm-diff';
import {
  type DiffFile,
  type DiffIndex,
  indexPatch,
} from '@tools/npm-diff/diff-index';

/** The release-ledger `LedgerReader` method that has a pair's `ReleaseDiff` object build its entry. */
export interface DiffBuilder {
  releaseDiff(pair: DiffPair): Promise<DiffIndex>;
}

/** One pair's diff: its index, some files' patch sections, and the whole patch. */
export interface PairDiff {
  index: DiffIndex;
  files(files: readonly DiffFile[]): Promise<string>;
  patch(): Promise<ReadableStream<Uint8Array> | Uint8Array<ArrayBuffer>>;
}

/** A pair's diff, for a pair the ledger has validated. */
export type DiffSource = (pair: DiffPair) => Promise<PairDiff>;

const stored = (
  bucket: DiffBucket,
  pair: DiffPair,
  index: DiffIndex,
): PairDiff => ({
  index,
  files: (files) => readSections(patchRange(bucket, pair), files),
  patch: () => readPatch(bucket, pair),
});

const inMemory = (patch: Uint8Array<ArrayBuffer>): PairDiff => ({
  index: indexPatch(patch),
  files: (files) =>
    readSections(
      ({ offset, length }: ByteRange) =>
        Promise.resolve(patch.subarray(offset, offset + length)),
      files,
    ),
  patch: () => Promise.resolve(patch),
});

/**
 * R2 first, then the pair's ReleaseDiff object, which builds and stores the entry. Without the object (a
 * ledger that predates `releaseDiff`, or one that fails) the pair builds here and nothing is stored: only the
 * production ledger writes the bucket that previews share.
 */
export const diffSource =
  (bucket: DiffBucket, builder: DiffBuilder, build = buildPatch): DiffSource =>
  async (pair) => {
    const index = await readIndex(bucket, pair);

    if (index) return stored(bucket, pair, index);

    try {
      return stored(bucket, pair, await builder.releaseDiff(pair));
    } catch (error) {
      console.warn(`${objectName(pair)}: the ledger did not build it`, error);

      return inMemory(await build(pair));
    }
  };
