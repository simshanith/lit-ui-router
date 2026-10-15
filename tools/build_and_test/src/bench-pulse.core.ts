// The run summary's Bench pulse, from the files `mise run bench_pulse` writes.

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
  timestamp: v.pipe(v.string(), v.isoTimestamp()),
  node: v.string(),
  platform: v.string(),
  arch: v.string(),
});

export const BenchFileSchema = v.array(BenchEntrySchema);

export type BenchEntry = v.InferOutput<typeof BenchEntrySchema>;

export interface BenchSource {
  /** Repo-root-relative: each bench's default `.cache/` destination. */
  path: string;
  select: (entry: BenchEntry) => boolean;
}

/** In render order: the production table first, then the n=500 scaling rows. */
export const BENCH_SOURCES: readonly BenchSource[] = [
  {
    path: 'apps/sample-app-routes/.cache/routes-bench.json',
    select: ({ name }) => / (?:hit|miss)\b/.test(name),
  },
  {
    path: 'packages/ui-router-server/.cache/resolve-bench.json',
    select: ({ n }) => n === 500,
  },
];

/** Selected rows written since `since`; an older `.cache/` file is not this job's. */
export function benchPulseRows(
  files: readonly { source: BenchSource; entries: readonly BenchEntry[] }[],
  since: number,
): BenchEntry[] {
  return files.flatMap(({ source, entries }) =>
    entries.filter(
      (entry) => source.select(entry) && Date.parse(entry.timestamp) >= since,
    ),
  );
}

/** A latency in ns at three significant figures, in the unit that reads best. */
export function formatNs(ns: number): string {
  const [value, unit] =
    ns >= 1e6 ? [ns / 1e6, 'ms'] : ns >= 1e3 ? [ns / 1e3, 'µs'] : [ns, 'ns'];

  return `${Number(value.toPrecision(3))} ${unit}`;
}

function hostOf(rows: readonly BenchEntry[]): string {
  const hosts = new Set(
    rows.map(({ node, platform, arch }) => `node ${node}, ${platform}-${arch}`),
  );

  return [...hosts].join('; ');
}

/** The overview section and its stdout twin; undefined when nothing was read. */
export function benchPulse(
  rows: readonly BenchEntry[],
): { markdown: string[]; lines: string[] } | undefined {
  if (rows.length === 0) return undefined;

  const markdown = [
    `**Bench pulse** — one noisy run on a short budget (${hostOf(rows)}); it catches order-of-magnitude shifts only, and the work-count tests are the gate.`,
    '',
    '| Task | Mean | ±RME | Samples |',
    '| --- | ---: | ---: | ---: |',
    ...rows.map(
      ({ name, mean, rme, samples }) =>
        `| ${inlineCode(cell(name))} | ${formatNs(mean)} | ${rme.toFixed(2)}% | ${samples} |`,
    ),
    '',
  ];

  const lines = [
    `   bench pulse (${hostOf(rows)}): ${rows.map(({ name, mean }) => `${name} ${formatNs(mean)}`).join(', ')}`,
  ];

  return { markdown, lines };
}
