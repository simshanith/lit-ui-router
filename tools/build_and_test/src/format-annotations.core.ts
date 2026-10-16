// oxfmt and taplo name files, not lines; run-summary.ts diffs each against the formatter's stdout.

import {
  type AnnotationTier,
  type RunSummary,
  type ToolAnnotation,
  cell,
  failedTasks,
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

/** The step-summary section: every file and hunk, collapsed. */
export function formattingMarkdown(findings: readonly FormatFinding[]): string {
  if (findings.length === 0) return '';

  const out = [
    `<details><summary>Formatting — ${plural(findings.length, 'file needs', 'files need')} <code>${FORMAT_FIX}</code></summary>`,
    '',
  ];

  for (const finding of findings) {
    out.push(
      `- ${inlineCode(cell(finding.file))} (${finding.tool}) — ${hunkList(finding)}`,
    );
  }

  out.push('', '</details>', '');

  return `${out.join('\n')}\n`;
}

/** The stdout twin of `formattingMarkdown`. */
export function formattingLines(findings: readonly FormatFinding[]): string[] {
  if (findings.length === 0) return [];

  return [
    `── formatting: ${formattingSummary(findings)}`,
    ...findings.map(
      (finding) => `   ${finding.file} (${finding.tool}): ${hunkList(finding)}`,
    ),
    '',
  ];
}
