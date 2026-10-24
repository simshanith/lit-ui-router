// The release-diffs worker: each version pair's npm diff, read from R2, built once by that pair's ReleaseDiff object on a miss.
import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers';
import * as v from 'valibot';

import type { DiffIndex } from '../src/diff-index.ts';
import { FILE_FILTERS, type FileFilter } from '../src/file-filter.ts';
import {
  DiffEntry,
  type DiffPair,
  DiffPairSchema,
  filesKey,
  objectName,
  patchKey,
  readIndex,
  readStored,
} from '../src/store.ts';

/** Builds one version pair's entry into R2; R2 holds the result, so the object stores nothing and keeps a build to one at a time. */
export class ReleaseDiff extends DurableObject<Env> {
  #entry: DiffEntry | undefined;

  /** The pair's index, built from the npm registry's tarballs unless R2 holds a complete entry. */
  build(pair: DiffPair): Promise<DiffIndex> {
    this.#entry ??= new DiffEntry(this.env.DIFFS, pair);

    return this.#entry.index();
  }
}

/** The RPC surface the docs worker's service binding calls; each method builds the pair on a miss. */
export default class ReleaseDiffs extends WorkerEntrypoint<Env> {
  /** The pair's files, in patch order, with their kinds, line counts, byte ranges and presets. */
  async index(pair: DiffPair): Promise<DiffIndex> {
    const valid = v.parse(DiffPairSchema, pair);

    return (
      (await readIndex(this.env.DIFFS, valid)) ??
      this.ctx.exports.ReleaseDiff.getByName(objectName(valid)).build(valid)
    );
  }

  /** The patch sections of the files `filter` shows, in patch order. */
  async files(
    pair: DiffPair,
    filter: FileFilter,
  ): Promise<ReadableStream<Uint8Array>> {
    const preset = v.parse(v.picklist(FILE_FILTERS), filter);

    await this.index(pair);

    return readStored(this.env.DIFFS, filesKey(pair, preset));
  }

  /** The whole patch `npm diff` prints. */
  async patch(pair: DiffPair): Promise<ReadableStream<Uint8Array>> {
    await this.index(pair);

    return readStored(this.env.DIFFS, patchKey(pair));
  }

  override fetch(): Response {
    return new Response(null, { status: 404 });
  }
}
