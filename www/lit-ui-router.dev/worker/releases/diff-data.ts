// The release-diffs worker's RPC surface, as the docs worker calls it through the RELEASE_DIFFS service binding.
import type { FileFilter } from './npm-diff/file-filter.ts';

/** Two published versions of one package, older or newer first. */
export interface DiffPair {
  name: string;
  from: string;
  to: string;
}

/** One file's entry in a pair's index; `offset` and `length` are UTF-8 bytes into the patch. */
export interface DiffFile {
  path: string;
  kind: 'added' | 'deleted' | 'modified';
  added: number;
  removed: number;
  offset: number;
  length: number;
  /** The presets that show this file. */
  filters: FileFilter[];
}

/** A pair's files in patch order, and the patch's size in bytes. */
export interface DiffIndex {
  files: DiffFile[];
  bytes: number;
}

/** The release-diffs worker's default entrypoint; each method builds the pair on a miss and rejects when it can't. */
export interface ReleaseDiffs {
  index(pair: DiffPair): Promise<DiffIndex>;
  files(
    pair: DiffPair,
    filter: FileFilter,
  ): Promise<ReadableStream<Uint8Array>>;
  patch(pair: DiffPair): Promise<ReadableStream<Uint8Array>>;
}
