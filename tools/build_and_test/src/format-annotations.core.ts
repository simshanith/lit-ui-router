// oxfmt and taplo name files, not lines; run-summary.ts diffs each against the formatter's stdout.
// The same diffs make the step-summary previews and the `git apply` patch.

import { basename } from 'node:path';

import {
  type AnnotationTier,
  type RunSummary,
  type ToolAnnotation,
  cell,
  failedTasks,
  fenceFor,
  inlineCode,
  repoRelativeFile,
  stripAnsi,
} from './run-summary.core.ts';

export type FormatTool = 'oxfmt' | 'taplo';

/** The fix for every formatting failure, workspace-wide. */
export const FORMAT_FIX = 'pnpm format';

/** Past this many files, per-file annotations are noise; one line says it all. */
export const FORMAT_FILE_LIMIT = 3;

/** Files diffed per job; the rest are listed without lines. */
export const FORMAT_DIFF_LIMIT = 50;

/** Hunk ranges listed per file in the step summary. */
export const HUNK_LIST_LIMIT = 20;

/** Files whose first hunk is previewed in the step summary; the rest list ranges only. */
export const PREVIEW_FILE_LIMIT = 5;

/** Removed and added lines shown per preview, each side. */
export const PREVIEW_CHANGE_LIMIT = 1;

/** Characters kept of each previewed line. */
export const PREVIEW_WIDTH = 160;

/** Where the reporter writes the patch, repo-root-relative. */
export const FORMAT_PATCH = '.turbo/format.patch';

/** The run artifact that holds `format.patch`; build-test-run.yml uploads it. */
export const FORMAT_PATCH_ARTIFACT = 'format-patch';

/** A changed range of the file as committed, 1-based and inclusive. */
export interface Hunk {
  line: number;
  endLine: number;
}

export interface FormatFinding {
  tool: FormatTool;
  /** Where the task ran, repo-root-relative; the formatter reruns there. */
  directory: string;
  /** As the tool printed it: relative to `directory`, or absolute. */
  path: string;
  /** Repo-root-relative. */
  file: string;
  /** Undefined until diffed, or when the diff could not be taken. */
  hunks?: Hunk[];
  /** The first hunk, cut to `PREVIEW_CHANGE_LIMIT` lines a side. */
  preview?: DiffPreview;
  /** This file's `git apply` section, with repo-relative `a/` and `b/` paths. */
  patch?: string;
}

export interface DiffPreview {
  /** The `@@ -a,b +c,d @@` range, without git's function context. */
  header: string;
  removed: string[];
  added: string[];
  /** Changed lines of the hunk left out. */
  more: number;
}

/** What the summary says about the patch the reporter wrote. */
export interface PatchNote {
  command: string;
  /** Files the patch fixes; the findings past it need `pnpm format`. */
  files: number;
}

function clean(rawLine: string): string {
  return stripAnsi(rawLine).replace(/\r$/, '');
}

const OXFMT_START = /^Checking formatting\.\.\.$/;

const OXFMT_FILE = /^(\S.*) \(\d+(?:\.\d+)?(?:ms|s)\)$/;

const OXFMT_END = /^Format issues found in above \d+ files?\./;

/** `src/core.ts (76ms)` lines between oxfmt's banner and its verdict. */
export function parseOxfmtFiles(log: string): string[] {
  const files: string[] = [];
  let inList = false;

  for (const line of log.split('\n').map(clean)) {
    if (OXFMT_START.test(line)) {
      inList = true;
      files.length = 0;
    } else if (OXFMT_END.test(line)) {
      return inList ? files : [];
    } else if (inList) {
      const match = OXFMT_FILE.exec(line);

      if (match?.[1] !== undefined) files.push(match[1]);
    }
  }

  return [];
}

const TAPLO_FILE =
  /\bERROR taplo:format_files: the file is not properly formatted path="([^"]+)"/;

/** taplo's per-file ERROR log line; the path is absolute. */
export function parseTaploFiles(log: string): string[] {
  return log.split('\n').flatMap((line) => {
    const match = TAPLO_FILE.exec(clean(line));

    return match?.[1] === undefined ? [] : [match[1]];
  });
}

/** Failed tasks only: a green log never names a file that needs formatting. */
export function extractFormatFindings(
  summary: RunSummary,
  logs: Map<string, string>,
  root?: string,
): FormatFinding[] {
  return failedTasks(summary).flatMap((task) => {
    const log = logs.get(task.taskId);

    if (log === undefined) return [];

    const findings = (tool: FormatTool, paths: string[]): FormatFinding[] =>
      paths.flatMap((path) => {
        const file = repoRelativeFile(path, task.directory, root);

        return file === undefined
          ? []
          : [{ tool, directory: task.directory, path, file }];
      });

    return [
      ...findings('oxfmt', parseOxfmtFiles(log)),
      ...findings('taplo', parseTaploFiles(log)),
    ];
  });
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/;

/** Old-side ranges of a `diff -U0`; a pure insertion lands on the line above it. */
export function parseHunks(diff: string): Hunk[] {
  return diff.split('\n').flatMap((line) => {
    const match = HUNK_HEADER.exec(line);

    if (match === null) return [];
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    const line1 = Math.max(start, 1);

    return [{ line: line1, endLine: Math.max(line1, start + count - 1) }];
  });
}

const HUNK_RANGE = /^@@ [^@]* @@/;

function clip(line: string): string {
  return line.length > PREVIEW_WIDTH
    ? `${line.slice(0, PREVIEW_WIDTH)}…`
    : line;
}

/** The first hunk of a `diff -U0`, cut to `PREVIEW_CHANGE_LIMIT` changed lines a side. */
export function parsePreview(diff: string): DiffPreview | undefined {
  const lines = diff.split('\n');
  const start = lines.findIndex((line) => HUNK_RANGE.test(line));
  const header = HUNK_RANGE.exec(lines[start] ?? '')?.[0];

  if (header === undefined) return undefined;
  const removed: string[] = [];
  const added: string[] = [];

  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('@@') || line.startsWith('diff ')) break;

    if (line.startsWith('-')) removed.push(clip(line));
    else if (line.startsWith('+')) added.push(clip(line));
  }

  const shown = {
    removed: removed.slice(0, PREVIEW_CHANGE_LIMIT),
    added: added.slice(0, PREVIEW_CHANGE_LIMIT),
  };

  return {
    header,
    ...shown,
    more:
      removed.length + added.length - shown.removed.length - shown.added.length,
  };
}

/** A `diff --no-index` against a temp copy, readdressed so `git apply` patches `file`. */
export function patchSection(diff: string, file: string): string | undefined {
  const lines = diff.split('\n');
  const start = lines.findIndex((line) => HUNK_RANGE.test(line));

  if (start === -1) return undefined;
  const body = lines.slice(start).join('\n');

  return [
    `diff --git a/${file} b/${file}`,
    `--- a/${file}`,
    `+++ b/${file}`,
    body.endsWith('\n') ? body : `${body}\n`,
  ].join('\n');
}

/** Every diffed file's section, in finding order; empty when none was diffed. */
export function formatPatch(findings: readonly FormatFinding[]): string {
  return findings.flatMap(({ patch }) => patch ?? []).join('');
}

/** On Actions the patch is a run artifact; locally it is already on disk. */
export function patchCommand(runId: string | undefined): string {
  return runId === undefined || runId === ''
    ? `git apply ${FORMAT_PATCH}`
    : `gh run download ${runId} -n ${FORMAT_PATCH_ARTIFACT} && git apply ${basename(FORMAT_PATCH)}`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** One per file, on its first hunk. */
export function formatAnnotation(finding: FormatFinding): ToolAnnotation {
  const [first] = finding.hunks ?? [];
  const count = finding.hunks?.length ?? 0;

  const message =
    count === 0
      ? `needs formatting; run ${FORMAT_FIX}`
      : `${plural(count, 'hunk needs', 'hunks need')} formatting; run ${FORMAT_FIX}`;

  const properties: ToolAnnotation['properties'] = { file: finding.file };

  if (first !== undefined) {
    properties.line = first.line;

    if (first.endLine > first.line) properties.endLine = first.endLine;
  }

  properties.title = finding.tool;

  return { level: 'error', message, properties };
}

/** The one line that stands in for every file. */
export function formattingSummary(findings: readonly FormatFinding[]): string {
  return `${plural(findings.length, 'file needs', 'files need')} \`${FORMAT_FIX}\``;
}

/** Formatting ranks below every located finding: it gets the slots they leave. */
export function formattingTier(
  findings: readonly FormatFinding[],
): AnnotationTier {
  return {
    annotations: findings.map(formatAnnotation),
    limit: FORMAT_FILE_LIMIT,
    collapsed: {
      level: 'error',
      message: formattingSummary(findings),
      title: 'formatting',
    },
  };
}

function range({ line, endLine }: Hunk): string {
  return endLine > line ? `${line}–${endLine}` : String(line);
}

function hunkList(finding: FormatFinding): string {
  const hunks = finding.hunks;

  if (hunks === undefined) return 'lines unknown';

  if (hunks.length === 0) return 'no changed lines';
  const shown = hunks.slice(0, HUNK_LIST_LIMIT).map(range).join(', ');
  const more = hunks.length - HUNK_LIST_LIMIT;

  const single = hunks.length === 1 && hunks[0]?.line === hunks[0]?.endLine;

  return `${single ? 'line' : 'lines'} ${shown}${more > 0 ? `, … ${more} more` : ''}`;
}

/** A fenced diff, indented under its list item. */
function previewBlock(preview: DiffPreview): string[] {
  const lines = [
    preview.header,
    ...preview.removed,
    ...preview.added,
    ...(preview.more > 0
      ? [`… ${plural(preview.more, 'more line', 'more lines')}`]
      : []),
  ];

  const fence = fenceFor(lines.join('\n'));

  return [
    '',
    ...[`${fence}diff`, ...lines, fence].map((line) => `  ${line}`),
    '',
  ];
}

/** The apply command, and what the patch leaves to `pnpm format`. */
function patchSentences(
  findings: readonly FormatFinding[],
  patch: PatchNote,
): string[] {
  const left = findings.length - patch.files;

  return [
    `Apply the fix: ${inlineCode(patch.command)}`,
    ...(left > 0
      ? [
          `The patch covers ${patch.files} of ${findings.length} files; run ${inlineCode(FORMAT_FIX)} for the rest.`,
        ]
      : []),
  ];
}

/** The step-summary section: every file and hunk, collapsed, the first few with a diff. */
export function formattingMarkdown(
  findings: readonly FormatFinding[],
  patch?: PatchNote,
): string {
  if (findings.length === 0) return '';

  const out = [
    `<details><summary>Formatting — ${plural(findings.length, 'file needs', 'files need')} <code>${FORMAT_FIX}</code></summary>`,
    '',
  ];

  let previews = 0;

  for (const finding of findings) {
    out.push(
      `- ${inlineCode(cell(finding.file))} (${finding.tool}) — ${hunkList(finding)}`,
    );

    if (finding.preview !== undefined && previews < PREVIEW_FILE_LIMIT) {
      previews += 1;
      out.push(...previewBlock(finding.preview));
    }
  }

  // A preview already ends on the blank line `</details>` needs.
  if (out.at(-1) !== '') out.push('');
  out.push('</details>', '');

  for (const sentence of patch === undefined
    ? []
    : patchSentences(findings, patch))
    out.push(sentence, '');

  return `${out.join('\n')}\n`;
}

/** The stdout twin of `formattingMarkdown`, without the diffs. */
export function formattingLines(
  findings: readonly FormatFinding[],
  patch?: PatchNote,
): string[] {
  if (findings.length === 0) return [];

  return [
    `── formatting: ${formattingSummary(findings)}`,
    ...findings.map(
      (finding) => `   ${finding.file} (${finding.tool}): ${hunkList(finding)}`,
    ),
    ...(patch === undefined
      ? []
      : patchSentences(findings, patch).map((line) => `   ${line}`)),
    '',
  ];
}
