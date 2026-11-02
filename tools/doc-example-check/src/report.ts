import type { ExampleBlock, SkipReason } from './blocks.ts';

/** A diagnostic at its doc-comment position: 1-based line and column. */
export interface Diagnostic {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

export type BlockStatus = 'skipped' | 'syntax' | 'semantic' | 'clean';

export interface BlockResult {
  file: string;
  block: ExampleBlock;
  status: BlockStatus;
  diagnostics: Diagnostic[];
}

export interface Census {
  files: number;
  tags: number;
  /** `file:line` of each `@example` tag with no fence. */
  unfenced: string[];
}

/** `tsc --pretty false` shape, so editors and CI annotations can link it. */
export const formatDiagnostic = (d: Diagnostic): string =>
  `${d.file}(${d.line},${d.column}): error ${d.code}: ${d.message}`;

const tally = (values: string[]): string =>
  Object.entries(
    values.reduce<Record<string, number>>((counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1;

      return counts;
    }, {}),
  )
    .sort(([, a], [, b]) => b - a)
    .map(([value, count]) => `${value} ${count}`)
    .join(', ');

export const summarize = (results: BlockResult[], census: Census): string => {
  const count = (status: BlockStatus): number =>
    results.filter((result) => result.status === status).length;

  const skipped = results.filter((result) => result.block.skip);

  const failing = results.filter(
    (result) => result.status === 'syntax' || result.status === 'semantic',
  );

  const reasons = (reason: SkipReason): number =>
    skipped.filter((result) => result.block.skip === reason).length;

  return [
    `files with @example tags: ${census.files}`,
    `@example tags: ${census.tags} (${census.unfenced.length} without a fence)`,
    `ts blocks found: ${results.length}`,
    `blocks skipped: ${skipped.length} (unflagged ${reasons('unflagged')}, nocheck ${reasons('nocheck')}, empty ${reasons('empty')})`,
    `blocks checked: ${results.length - skipped.length}`,
    `  clean: ${count('clean')}`,
    `  syntax errors: ${count('syntax')}`,
    `  type errors: ${count('semantic')}`,
    `diagnostics: ${failing.reduce((sum, r) => sum + r.diagnostics.length, 0)}`,
    `error codes: ${tally(failing.flatMap((r) => r.diagnostics.map((d) => d.code)))}`,
    '',
    ...failing.map(
      (r) =>
        `${r.file}:${r.block.line} ${r.status} ${r.diagnostics.map((d) => d.code).join(' ')}`,
    ),
  ].join('\n');
};
