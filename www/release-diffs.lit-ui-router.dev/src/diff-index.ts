// Each file's section of an `npm diff` patch: where its bytes sit, what kind of change it is, how many lines it adds and removes, and which presets show it.
import { type FileFilter, filtersOf } from './file-filter.ts';

/** How `npm diff` reports a file: it never pairs a removed file with an added one as a rename. */
export type ChangeKind = 'added' | 'deleted' | 'modified';

/** One file's section of the patch; `offset` and `length` count UTF-8 bytes. */
export interface DiffFile {
  path: string;
  kind: ChangeKind;
  added: number;
  removed: number;
  offset: number;
  length: number;
  filters: FileFilter[];
}

/** A patch's files in the order the patch prints them, and its size in bytes. */
export interface DiffIndex {
  files: DiffFile[];
  bytes: number;
}

const HEADER = 'diff --git a/';

const header = new TextEncoder().encode(HEADER);

const utf8 = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });

const NEWLINE = 0x0a;

/** Whether a file section starts at `at`: the patch's start or a line's, reading `diff --git a/`. */
const startsSection = (patch: Uint8Array, at: number): boolean =>
  (at === 0 || patch[at - 1] === NEWLINE) &&
  header.every((byte, i) => patch[at + i] === byte);

/** The byte offset of every file section; a hunk line always starts with a prefix, so only a header can match. */
const sectionStarts = (patch: Uint8Array): number[] => {
  const starts: number[] = [];

  for (let at = 0; at < patch.length; at++)
    if (startsSection(patch, at)) starts.push(at);

  return starts;
};

/** The path `diff --git a/<path> b/<path>` names twice, so a path holding ` b/` still splits. */
const pathOf = (firstLine: string): string =>
  firstLine.slice(HEADER.length, (firstLine.length + HEADER.length - 3) / 2);

const kindOf = (lines: readonly string[]): ChangeKind => {
  if (lines.some((line) => line.startsWith('new file mode '))) return 'added';

  if (lines.some((line) => line.startsWith('deleted file mode ')))
    return 'deleted';

  return 'modified';
};

/** One section's facts; lines before the first hunk are headers, whatever they start with. */
const fileOf = (text: string, offset: number, length: number): DiffFile => {
  const lines = text.split('\n');
  const firstHunk = lines.findIndex((line) => line.startsWith('@@ '));
  const headers = firstHunk === -1 ? lines : lines.slice(0, firstHunk);
  const body = firstHunk === -1 ? [] : lines.slice(firstHunk);

  const path = pathOf(lines[0] ?? '');

  return {
    path,
    kind: kindOf(headers),
    added: body.filter((line) => line.startsWith('+')).length,
    removed: body.filter((line) => line.startsWith('-')).length,
    offset,
    length,
    filters: filtersOf(path),
  };
};

/** The index of an `npm diff` patch, read from its bytes. */
export const indexPatch = (patch: Uint8Array): DiffIndex => {
  const starts = sectionStarts(patch);

  const files = starts.map((offset, i) => {
    const end = starts[i + 1] ?? patch.length;

    return fileOf(
      utf8.decode(patch.subarray(offset, end)),
      offset,
      end - offset,
    );
  });

  return { files, bytes: patch.length };
};
