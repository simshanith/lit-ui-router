// Medians and the Markdown tables the harness writes to the job summary (printed locally).
import { appendStepSummary } from '@tools/shared/gha.ts';

/** The `q` quantile, interpolated between the two nearest ranks. */
export const quantile = (values: number[], q: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * q;
  const below = sorted[Math.floor(rank)];

  return below + (sorted[Math.ceil(rank)] - below) * (rank - Math.floor(rank));
};

export const median = (values: number[]): number => quantile(values, 0.5);

/** `median (p25–p75, min–max)`, each value through `format`. */
export const spread = (
  values: number[],
  format: (value: number) => string,
): string => {
  if (values.length === 0) return 'n/a';

  const [p25, p50, p75] = [0.25, 0.5, 0.75].map((q) =>
    format(quantile(values, q)),
  );

  return `${p50} (${p25}–${p75}, ${format(Math.min(...values))}–${format(Math.max(...values))})`;
};

/** `run, run, …` in run order, each value through `format`. */
export const runs = (
  values: number[],
  format: (value: number) => string,
): string => (values.length === 0 ? 'n/a' : values.map(format).join(', '));

export const ms = (value: number): string => String(Math.round(value));

export interface Section {
  title: string;
  /** What ran, and under which conditions. */
  lead: string[];
  header: string[];
  rows: string[][];
  /** The same table with every run, collapsed under it. */
  runs?: string[][];
}

const tableRow = (cells: string[]): string => `| ${cells.join(' | ')} |`;

export const sectionMarkdown = ({
  title,
  lead,
  header,
  rows,
  runs: perRun,
}: Section): string => {
  const table = (body: string[][]): string[] => [
    tableRow(header),
    tableRow(header.map(() => '---')),
    ...body.map(tableRow),
  ];

  return [
    `### ${title}`,
    '',
    ...lead,
    '',
    ...table(rows),
    '',
    ...(perRun
      ? [
          '<details><summary>Runs</summary>',
          '',
          ...table(perRun),
          '',
          '</details>',
          '',
        ]
      : []),
    '',
  ].join('\n');
};

export const writeSection = (section: Section): Promise<void> =>
  appendStepSummary(sectionMarkdown(section));
