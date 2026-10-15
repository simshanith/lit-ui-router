import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as v from 'valibot';

import {
  type BenchEntry,
  BENCH_SOURCES,
  BenchFileSchema,
  benchSummaryMarkdown,
  formatNs,
} from './bench-summary.core.ts';

function entry(over: Partial<BenchEntry> = {}): BenchEntry {
  return {
    name: 'matcher hit n=500',
    unit: 'ns',
    n: 500,
    mean: 14196.5,
    rme: 0.308,
    samples: 70440,
    node: 'v24.21.0',
    platform: 'linux',
    arch: 'x64',
    ...over,
  };
}

const [ROUTES, RESOLVE] = BENCH_SOURCES;

if (ROUTES === undefined || RESOLVE === undefined)
  throw new Error('BENCH_SOURCES lost a source');

const routesFile = [
  entry({ name: 'construct', n: 12 }),
  entry({ name: '/app hit (12 routes)', n: 12, mean: 819.55, rme: 0.28 }),
  entry({ name: '/app root redirect', n: 12 }),
  entry({ name: '/app miss', n: 12, mean: 481.65 }),
];

const resolveFile = [
  entry({ name: 'matcher hit n=10', n: 10 }),
  entry({ name: 'matcher construct n=500', mean: 553209 }),
  entry(),
  entry({ name: 'simulate redirect n=500', mean: 1_651_860 }),
];

describe('BenchFileSchema', () => {
  it('keeps the read keys and drops the rest of an entry', () => {
    const [parsed] = v.parse(BenchFileSchema, [
      { ...entry(), value: 14196.5, range: '± 0.31%', p99: 17584, sha: 'abc' },
    ]);

    assert.deepEqual(parsed, entry());
  });

  it('rejects a file that is not an entry array', () => {
    assert.throws(() => v.parse(BenchFileSchema, { name: 'matcher hit' }));
    assert.throws(() => v.parse(BenchFileSchema, [{ ...entry(), unit: 'ms' }]));
    assert.throws(() =>
      v.parse(BenchFileSchema, [{ ...entry(), mean: '14 µs' }]),
    );
  });
});

describe('formatNs', () => {
  it('picks the unit and keeps three significant figures', () => {
    assert.equal(formatNs(481.65), '482 ns');
    assert.equal(formatNs(14196.5), '14.2 µs');
    assert.equal(formatNs(553209), '553 µs');
    assert.equal(formatNs(1_651_860), '1.65 ms');
  });
});

describe('benchSummaryMarkdown', () => {
  it('groups the production hit and miss rows before the n=500 rows', () => {
    assert.equal(
      benchSummaryMarkdown([
        { source: ROUTES, entries: routesFile },
        { source: RESOLVE, entries: resolveFile },
      ]),
      [
        '## ui-router-server bench pulse',
        '',
        'One noisy run on a short budget (node v24.21.0, linux-x64). It catches order-of-magnitude shifts only; the work-count tests are the gate.',
        '',
        '### Production docs table (`sample-app-routes`)',
        '',
        '| Task | Mean | ±RME | Samples |',
        '| --- | ---: | ---: | ---: |',
        '| `/app hit (12 routes)` | 820 ns | 0.28% | 70440 |',
        '| `/app miss` | 482 ns | 0.31% | 70440 |',
        '',
        '### Synthetic table, n=500 (`ui-router-server`)',
        '',
        '| Task | Mean | ±RME | Samples |',
        '| --- | ---: | ---: | ---: |',
        '| `matcher construct n=500` | 553 µs | 0.31% | 70440 |',
        '| `matcher hit n=500` | 14.2 µs | 0.31% | 70440 |',
        '| `simulate redirect n=500` | 1.65 ms | 0.31% | 70440 |',
        '',
        '',
      ].join('\n'),
    );
  });

  it('names the file a crashed bench never wrote', () => {
    const markdown = benchSummaryMarkdown([
      { source: ROUTES },
      { source: RESOLVE, entries: resolveFile },
    ]);

    assert.ok(
      markdown.includes(
        'No result file at `apps/sample-app-routes/.cache/routes-bench.json`.',
      ),
    );
    assert.ok(markdown.includes('| `matcher hit n=500` |'));
  });

  it('escapes a task name that would break the table', () => {
    const markdown = benchSummaryMarkdown([
      { source: RESOLVE, entries: [entry({ name: 'a|b' })] },
    ]);

    assert.ok(markdown.includes('| `a\\|b` | 14.2 µs | 0.31% | 70440 |'));
  });
});
