// Diffs each formatting finding against its formatters' output and writes the
// fixes to `.turbo/format.patch`, for run-summary.ts and format-patch.ts. The
// checkout is never written; the decisions live in format-annotations.core.ts.
//
// env: GITHUB_RUN_ID (names the run in the format.patch download command),
//      FORMAT_PATCH_ARTIFACT_URL (the uploaded format.patch, linked beside it).

import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import {
  type FormatFinding,
  type FormatSource,
  type PatchNote,
  FORMAT_DIFF_LIMIT,
  FORMAT_PATCH,
  extractFormatFindings,
  formatInSequence,
  formatPatch,
  parseHunks,
  parsePreview,
  patchCommand,
  patchSection,
} from './format-annotations.core.ts';
import { type Session, warn } from './session.ts';
import { onActions } from '@tools/shared/gha.ts';

/** The formatter's verdict on `input` from stdin; the checkout is never written. */
function formatted(source: FormatSource, input: string): string | undefined {
  const cwd = resolve(source.directory || '.');

  const [command, args] =
    source.tool === 'oxfmt'
      ? [
          join(cwd, 'node_modules/.bin/oxfmt'),
          [`--stdin-filepath=${source.path}`],
        ]
      : ['taplo', ['fmt', '-']];

  const result = spawnSync(command, args, {
    cwd,
    input,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30_000,
  });

  return result.status === 0 ? result.stdout : undefined;
}

/** `git diff` of `file` against `target`, with `context` lines around each hunk. */
function diffAgainst(
  file: string,
  target: string,
  context: number,
): string | undefined {
  const diff = spawnSync(
    'git',
    [
      'diff',
      '--no-index',
      '--no-color',
      '--no-ext-diff',
      `-U${context}`,
      '--',
      file,
      target,
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );

  // 1 means the files differ, the expected case.
  return diff.status === 0 || diff.status === 1 ? diff.stdout : undefined;
}

/** Each file's hunks, preview and patch from one diff of every claiming formatter; one that cannot be diffed stays file-level. */
function diffFormatting(findings: readonly FormatFinding[]): void {
  if (findings.length === 0) return;
  let dir: string;

  try {
    dir = mkdtempSync(join(tmpdir(), 'format-diff-'));
  } catch (error: unknown) {
    warn(
      `no formatting diffs: ${error instanceof Error ? error.message : String(error)}`,
    );

    return;
  }

  try {
    for (const [at, finding] of findings
      .slice(0, FORMAT_DIFF_LIMIT)
      .entries()) {
      try {
        const output = formatInSequence(
          readFileSync(finding.file, 'utf8'),
          finding.sources,
          formatted,
        );

        if (output === undefined) continue;
        const target = join(dir, String(at));
        writeFileSync(target, output);
        const ranges = diffAgainst(finding.file, target, 0);

        if (ranges === undefined) continue;
        finding.hunks = parseHunks(ranges);
        finding.preview = parsePreview(ranges);
        const full = diffAgainst(finding.file, target, 3);

        finding.patch =
          full === undefined ? undefined : patchSection(full, finding.file);
      } catch (error: unknown) {
        warn(
          `no lines for ${finding.file}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Writes every diffed file's fix to `path`, replacing a stale patch; undefined when none was diffed. */
export function writePatch(
  findings: readonly FormatFinding[],
  path: string = FORMAT_PATCH,
): PatchNote | undefined {
  const text = formatPatch(findings);

  try {
    rmSync(path, { force: true });

    if (text === '') return undefined;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  } catch (error: unknown) {
    warn(
      `no ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );

    return undefined;
  }

  return {
    command: patchCommand(onActions() ? process.env.GITHUB_RUN_ID : undefined),
    files: findings.filter(({ patch }) => patch !== undefined).length,
    url: process.env.FORMAT_PATCH_ARTIFACT_URL,
  };
}

export interface FormattingFixes {
  findings: FormatFinding[];
  patch: PatchNote | undefined;
}

/** The session's formatting findings, one per file, diffed, with their fixes written to `FORMAT_PATCH`. */
export function formattingFixes(session: Session): FormattingFixes {
  const findings = extractFormatFindings(
    session.runs.map(({ summary }) => summary),
    session.logs,
    process.cwd(),
  );

  diffFormatting(findings);

  return { findings, patch: writePatch(findings) };
}
