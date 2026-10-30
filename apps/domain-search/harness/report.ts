// Medians and the Markdown tables the harness writes to the job summary (printed locally).
import { appendStepSummary } from '@tools/shared/gha.ts';

export const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.floor(sorted.length / 2)];
};

/** `median [run, run, …]`, each value through `format`. */
export const withRuns = (
  values: number[],
  format: (value: number) => string,
): string =>
  values.length === 0
    ? 'n/a'
    : `${format(median(values))} [${values.map(format).join(', ')}]`;

export const ms = (value: number): string => `${Math.round(value)} ms`;

export interface Section {
  title: string;
  /** What ran, and under which conditions. */
  lead: string[];
  header: string[];
  rows: string[][];
}

const tableRow = (cells: string[]): string => `| ${cells.join(' | ')} |`;

export const sectionMarkdown = ({
  title,
  lead,
  header,
  rows,
}: Section): string =>
  [
    `### ${title}`,
    '',
    ...lead,
    '',
    tableRow(header),
    tableRow(header.map(() => '---')),
    ...rows.map(tableRow),
    '',
    '',
  ].join('\n');

export const writeSection = (section: Section): Promise<void> =>
  appendStepSummary(sectionMarkdown(section));
