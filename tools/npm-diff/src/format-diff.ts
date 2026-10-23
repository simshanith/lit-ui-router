// Ported from libnpmdiff 8.1.12 (ISC, Copyright (c) GitHub Inc.) — lib/format-diff.js, lib/should-print-patch.js and untar.js's file keys, https://github.com/npm/cli/tree/latest/workspaces/libnpmdiff
import binaryExtensions from 'binary-extensions';
import { structuredPatch } from 'diff';
import type { StructuredPatch } from 'diff';

import type { TarFile } from './tar.ts';

/** A published file as `npm diff` compares it: its text and its git-style mode. */
export interface PackageFile {
  content: string;
  mode: string;
}

/** A tarball's files keyed by path below its top directory, in archive order. */
export type PackageFiles = ReadonlyMap<string, PackageFile>;

// Node's Buffer#toString keeps a leading BOM, where TextDecoder drops it by default.
const utf8 = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });

/** A tarball's files as libnpmdiff's untar reads them: the first path segment dropped, a later duplicate winning. */
export const packageFiles = (entries: readonly TarFile[]): PackageFiles =>
  new Map(
    entries.map(({ path, mode, data }) => [
      path.replace(/^[^/]+\/?/, ''),
      { content: utf8.decode(data), mode: `100${mode.toString(8)}` },
    ]),
  );

const binary = new Set(binaryExtensions);

/** Whether `npm diff` prints a patch for `path`: anything but a known binary extension. */
export const shouldPrintPatch = (path: string): boolean => {
  const filename = path.slice(path.lastIndexOf('/') + 1);
  const dot = filename.lastIndexOf('.');

  // node:path's extname: a leading dot alone starts no extension.
  const extension = filename.startsWith('.')
    ? filename.slice(1)
    : dot > 0
      ? filename.slice(dot + 1)
      : '';

  return !binary.has(extension);
};

/** jsdiff 8's formatPatch with empty headers, as libnpmdiff trims it: no underline, no trailing tabs. */
const formatHunks = (names: { a: string; b: string }, patch: StructuredPatch) =>
  [
    `--- ${names.a}`,
    `+++ ${names.b}`,
    ...patch.hunks.flatMap((hunk) => [
      // A zero-length range starts one line before its first line.
      `@@ -${hunk.oldLines === 0 ? hunk.oldStart - 1 : hunk.oldStart},${hunk.oldLines} +${hunk.newLines === 0 ? hunk.newStart - 1 : hunk.newStart},${hunk.newLines} @@`,
      ...hunk.lines,
    ]),
    '',
  ]
    .join('\n')
    .replace(/\t\n/g, '\n');

/** The header lines for a file whose mode differs between the versions. */
const modeHeaders = (
  a: PackageFile | undefined,
  b: PackageFile | undefined,
): string[] => {
  if (a?.mode === b?.mode) return [];

  if (!b) return [`deleted file mode ${a?.mode}`];

  if (!a) return [`new file mode ${b.mode}`];

  return [`old mode ${a.mode}`, `new mode ${b.mode}`];
};

/** A file's git-style header: its paths, any mode change, and the index line. */
const headerOf = (
  filename: string,
  a: PackageFile | undefined,
  b: PackageFile | undefined,
  versions: { a: string; b: string },
): string => {
  // The index line names the mode only when both versions share it.
  const mode = a?.mode === b?.mode ? (a?.mode ?? '') : '';

  return [
    `diff --git a/${filename} b/${filename}`,
    ...modeHeaders(a, b),
    `index v${versions.a}..v${versions.b} ${mode}`,
    '',
  ].join('\n');
};

/** One file's patch, or '' when neither its content nor its mode changed. */
const filePatch = (
  filename: string,
  a: PackageFile | undefined,
  b: PackageFile | undefined,
  versions: { a: string; b: string },
): string => {
  if (a?.content === b?.content && a?.mode === b?.mode) return '';

  const names = { a: `a/${filename}`, b: `b/${filename}` };
  const header = headerOf(filename, a, b, versions);

  if (!shouldPrintPatch(filename))
    return `${header}--- ${names.a}\n+++ ${names.b}\n`;

  const patch = structuredPatch(
    names.a,
    names.b,
    a?.content ?? '',
    b?.content ?? '',
    '',
    '',
    { context: 3 },
  );

  return header + formatHunks(names, patch);
};

/** `npm diff --diff=<a> --diff=<b>` with its default options, without the trailing newline npm prints. */
export const formatDiff = ({
  a,
  b,
  versions,
}: {
  a: PackageFiles;
  b: PackageFiles;
  versions: { a: string; b: string };
}): string =>
  [...new Set([...a.keys(), ...b.keys()])]
    .map((filename) =>
      filePatch(filename, a.get(filename), b.get(filename), versions),
    )
    .join('')
    .trim();
