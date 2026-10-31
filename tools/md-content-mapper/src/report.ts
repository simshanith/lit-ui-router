import type { CodeBlock } from './blocks.ts';

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
  block: CodeBlock;
  status: BlockStatus;
  diagnostics: Diagnostic[];
}

const DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

export const parseDiagnostics = (output: string): Diagnostic[] =>
  output.split('\n').flatMap((line) => {
    const match = DIAGNOSTIC.exec(line.trim());

    return match
      ? [
          {
            file: match[1],
            line: Number(match[2]),
            column: Number(match[3]),
            code: match[4],
            message: match[5],
          },
        ]
      : [];
  });

/** TS1xxx codes are the parser's. */
export const isSyntactic = (diagnostic: Diagnostic): boolean =>
  /^TS1\d{3}$/.test(diagnostic.code);

/** `<file>:<fence line>`, the key `broken` holds. */
export const resultKey = (file: string, block: CodeBlock): string =>
  `${file}:${block.line}`;

const statusOf = (
  block: CodeBlock,
  diagnostics: Diagnostic[],
  broken: boolean,
): BlockStatus => {
  if (block.skip) return 'skipped';

  if (broken) return 'syntax';

  return diagnostics.length > 0 ? 'semantic' : 'clean';
};

/** Assigns diagnostics to fences; `broken` names the fences a syntax error kept out of the checked pass. */
export const attribute = (
  blocksByFile: Map<string, CodeBlock[]>,
  diagnostics: Diagnostic[],
  broken: ReadonlySet<string> = new Set(),
): BlockResult[] =>
  [...blocksByFile].flatMap(([file, blocks]) =>
    blocks.map((block) => {
      const own = diagnostics.filter(
        (d) => d.file === file && d.line > block.line && d.line < block.endLine,
      );

      const status = statusOf(block, own, broken.has(resultKey(file, block)));

      return { file, block, status, diagnostics: own };
    }),
  );

/** While any syntax error remains tsc reports no semantic one, so every fence with a diagnostic is broken. */
export const brokenBlocks = (
  blocksByFile: Map<string, CodeBlock[]>,
  diagnostics: Diagnostic[],
): Set<string> =>
  new Set(
    diagnostics.some(isSyntactic)
      ? attribute(blocksByFile, diagnostics).flatMap((result) =>
          result.diagnostics.length > 0
            ? [resultKey(result.file, result.block)]
            : [],
        )
      : [],
  );

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

export const summarize = (results: BlockResult[]): string => {
  const count = (status: BlockStatus): number =>
    results.filter((result) => result.status === status).length;

  const skipped = results.filter((result) => result.block.skip);

  const failing = results.filter(
    (result) => result.status === 'syntax' || result.status === 'semantic',
  );

  return [
    `files with ts fences: ${new Set(results.map((r) => r.file)).size}`,
    `blocks found: ${results.length}`,
    `blocks skipped: ${skipped.length} (${tally(skipped.map((r) => r.block.skip ?? ''))})`,
    `blocks checked: ${results.length - skipped.length} of ${results.length}`,
    `  clean: ${count('clean')}`,
    `  syntax errors (not checked further): ${count('syntax')}`,
    `  type errors: ${count('semantic')}`,
    `error codes: ${tally(failing.flatMap((r) => r.diagnostics.map((d) => d.code)))}`,
    '',
    ...failing.map(
      (r) =>
        `${r.file}:${r.block.line} ${r.status} ${r.diagnostics.map((d) => d.code).join(' ')}`,
    ),
  ].join('\n');
};
