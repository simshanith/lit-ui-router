import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as v from 'valibot';

import {
  type BenchEntry,
  BENCH_SOURCES,
  BenchFileSchema,
  benchPulse,
  benchPulseRows,
  formatNs,
} from './bench-pulse.core.ts';
import { sessionLines, sessionMarkdown } from './run-summary.core.ts';
import type { RunSummary } from './run-summary.core.ts';

const WRITTEN = '2026-10-15T03:07:52.775Z';

function entry(over: Partial<BenchEntry> = {}): BenchEntry {
  return {
    name: 'matcher hit n=500',
    unit: 'ns',
    n: 500,
    mean: 14196.5,
    rme: 0.308,
    samples: 70440,
    timestamp: WRITTEN,
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
  entry({ name: '/app hit (12 routes)', n: 12, mean: 819.55 }),
  entry({ name: '/app root redirect', n: 12 }),
  entry({ name: '/app miss', n: 12, mean: 481.65 }),
  entry({ name: '/simulated-routing hit (12 routes)', n: 12, mean: 63196 }),
  entry({ name: '/simulated-routing miss', n: 12, mean: 50987 }),
];

const resolveFile = [
  entry({ name: 'matcher hit n=10', n: 10 }),
  entry({ name: 'matcher construct n=500', mean: 553209 }),
  entry({ name: 'matcher hit n=500' }),
  entry({ name: 'simulate hit n=100', n: 100 }),
  entry({ name: 'simulate redirect n=500', mean: 1_651_860 }),
];

const SINCE = Date.parse(WRITTEN) - 60_000;

describe('BenchFileSchema', () => {
  it('keeps the read keys and drops the rest of an entry', () => {
    const [parsed] = v.parse(BenchFileSchema, [
      { ...entry(), value: 14196.5, range: '± 0.31%', p99: 17584, sha: 'abc' },
    ]);

    assert.deepEqual(parsed, entry());
  });

  it('rejects a file that is not an entry array', () => {
    assert.throws(() =>
      v.parse(BenchFileSchema, { name: 'matcher hit n=500' }),
    );
    assert.throws(() => v.parse(BenchFileSchema, [{ ...entry(), unit: 'ms' }]));
    assert.throws(() =>
      v.parse(BenchFileSchema, [{ ...entry(), mean: '14 µs' }]),
    );
    assert.throws(() =>
      v.parse(BenchFileSchema, [entry({ timestamp: 'yesterday' })]),
    );
  });
});

describe('benchPulseRows', () => {
  const files = [
    { source: ROUTES, entries: routesFile },
    { source: RESOLVE, entries: resolveFile },
  ];

  it('puts the production hit and miss rows before the n=500 rows', () => {
    assert.deepEqual(
      benchPulseRows(files, SINCE).map(({ name }) => name),
      [
        '/app hit (12 routes)',
        '/app miss',
        '/simulated-routing hit (12 routes)',
        '/simulated-routing miss',
        'matcher construct n=500',
        'matcher hit n=500',
        'simulate redirect n=500',
      ],
    );
  });

  it('drops rows written before the session started', () => {
    assert.deepEqual(benchPulseRows(files, Date.parse(WRITTEN) + 1), []);
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

describe('benchPulse', () => {
  it('is absent when no bench file was read', () => {
    assert.equal(benchPulse([]), undefined);
  });

  it('renders a task, mean, rme and samples table under a noise caveat', () => {
    const pulse = benchPulse([
      entry({ name: '/app hit (12 routes)', mean: 819.55, rme: 0.28 }),
      entry(),
    ]);

    assert.deepEqual(pulse?.markdown, [
      '**Bench pulse** — one noisy run on a short budget (node v24.21.0, linux-x64); it catches order-of-magnitude shifts only, and the work-count tests are the gate.',
      '',
      '| Task | Mean | ±RME | Samples |',
      '| --- | ---: | ---: | ---: |',
      '| `/app hit (12 routes)` | 820 ns | 0.28% | 70440 |',
      '| `matcher hit n=500` | 14.2 µs | 0.31% | 70440 |',
      '',
    ]);

    assert.deepEqual(pulse?.lines, [
      '   bench pulse (node v24.21.0, linux-x64): /app hit (12 routes) 820 ns, matcher hit n=500 14.2 µs',
    ]);
  });

  it('escapes a task name that would break the table', () => {
    const pulse = benchPulse([entry({ name: 'a|b' })]);

    assert.ok(
      pulse?.markdown.includes('| `a\\|b` | 14.2 µs | 0.31% | 70440 |'),
    );
  });
});

describe('the overview with a bench pulse', () => {
  const summary: RunSummary = {
    id: 'run',
    turboVersion: '2.11.8',
    execution: {
      command: 'turbo run ci',
      success: 0,
      failed: 0,
      cached: 0,
      attempted: 0,
      startTime: 0,
      endTime: 1000,
      exitCode: 0,
    },
    tasks: [],
  };

  const pulse = benchPulse([entry()]);

  it('lands after the run blocks and before the footer links', () => {
    const markdown = sessionMarkdown([{ summary }], {
      benchPulse: pulse,
      logsUrl: 'https://example.test/logs',
    });

    const at = markdown.indexOf('**Bench pulse**');

    assert.ok(at > markdown.indexOf('**Cache**'));
    assert.ok(at < markdown.indexOf('[Full task logs]'));
  });

  it('prints its stdout twin', () => {
    assert.ok(
      sessionLines([{ summary }], { benchPulse: pulse }).some((line) =>
        line.startsWith('   bench pulse'),
      ),
    );
  });

  it('leaves the overview untouched without one', () => {
    assert.ok(!sessionMarkdown([{ summary }]).includes('Bench pulse'));
  });
});
