// The ui-router-server Bench pulse section, from the files `mise run bench_pulse` writes.

import * as v from 'valibot';

import { cell, inlineCode } from './run-summary.core.ts';

// A github-action-benchmark customSmallerIsBetter entry; only the keys read here.
const BenchEntrySchema = v.object({
  name: v.string(),
  unit: v.literal('ns'),
  n: v.number(),
  mean: v.number(),
  rme: v.number(),
  samples: v.number(),
  node: v.string(),
  platform: v.string(),
  arch: v.string(),
});

export const BenchFileSchema = v.array(BenchEntrySchema);

export type BenchEntry = v.InferOutput<typeof BenchEntrySchema>;

export interface BenchSource {
  heading: string;
  /** Repo-root-relative: the bench's default `.cache/` destination. */
  path: string;
  select: (entry: BenchEntry) => boolean;
}

/** In render order: the production table first, then the n=500 synthetic rows. */
export const BENCH_SOURCES: readonly BenchSource[] = [
  {
    heading: 'Production docs table (`sample-app-routes`)',
    path: 'apps/sample-app-routes/.cache/routes-bench.json',
    select: ({ name }) => / (?:hit|miss)\b/.test(name),
  },
  {
    heading: 'Synthetic table, n=500 (`ui-router-server`)',
    path: 'packages/ui-router-server/.cache/resolve-bench.json',
    select: ({ n }) => n === 500,
  },
];

/** A source and its parsed entries; undefined when the bench wrote no file. */
export interface BenchGroup {
  source: BenchSource;
  entries?: readonly BenchEntry[];
}

/** A latency in ns at three significant figures, in the unit that reads best. */
export function formatNs(ns: number): string {
  const [value, unit] =
    ns >= 1e6 ? [ns / 1e6, 'ms'] : ns >= 1e3 ? [ns / 1e3, 'µs'] : [ns, 'ns'];

  return `${Number(value.toPrecision(3))} ${unit}`;
}

function hosts(groups: readonly BenchGroup[]): string {
  const seen = new Set(
    groups.flatMap(({ entries = [] }) =>
      entries.map(
        ({ node, platform, arch }) => `node ${node}, ${platform}-${arch}`,
      ),
    ),
  );

  return [...seen].join('; ');
}

function groupMarkdown({ source, entries }: BenchGroup): string[] {
  const out = [`### ${source.heading}`, ''];

  if (entries === undefined)
    return [...out, `No result file at ${inlineCode(source.path)}.`, ''];

  return [
    ...out,
    '| Task | Mean | ±RME | Samples |',
    '| --- | ---: | ---: | ---: |',
    ...entries
      .filter(source.select)
      .map(
        ({ name, mean, rme, samples }) =>
          `| ${inlineCode(cell(name))} | ${formatNs(mean)} | ${rme.toFixed(2)}% | ${samples} |`,
      ),
    '',
  ];
}

export function benchSummaryMarkdown(groups: readonly BenchGroup[]): string {
  return `${[
    '## ui-router-server bench pulse',
    '',
    `One noisy run on a short budget (${hosts(groups)}). It catches order-of-magnitude shifts only; the work-count tests are the gate.`,
    '',
    ...groups.flatMap(groupMarkdown),
  ].join('\n')}\n`;
}
