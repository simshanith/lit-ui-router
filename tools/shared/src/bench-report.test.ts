import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, it } from 'node:test';

import {
  benchBudget,
  benchEntries,
  benchReport,
  benchRun,
  sizeFromName,
} from './bench-report.ts';
import type { BenchEntry, BenchRun, BenchTask } from './bench-report.ts';
import type { Exec } from './exec.ts';

const completed = (name: string): BenchTask => ({
  name,
  result: {
    state: 'completed',
    latency: {
      mean: 0.002,
      p75: 0.0025,
      p99: 0.004,
      min: 0.001,
      max: 0.01,
      rme: 0.3456,
      samplesCount: 1000,
    },
  },
});

const run: BenchRun = {
  timestamp: '2026-10-15T00:00:00.000Z',
  sha: 'abc123',
  node: 'v24.0.0',
  platform: 'linux',
  arch: 'x64',
};

const headExec: Exec = () =>
  Promise.resolve({ stdout: 'deadbeef\n', stderr: '' });

const failingExec: Exec = () => Promise.reject(new Error('no repository'));

describe('sizeFromName', () => {
  it('reads the trailing n=<size>', () => {
    assert.equal(sizeFromName('matcher hit n=500'), 500);
  });

  it('is NaN without the suffix', () => {
    assert.ok(Number.isNaN(sizeFromName('construct')));
  });
});

describe('benchEntries', () => {
  it('emits customSmallerIsBetter keys in ns plus the flat stats and run', () => {
    assert.deepEqual(benchEntries([completed('matcher hit n=10')], run), [
      {
        name: 'matcher hit n=10',
        unit: 'ns',
        value: 2000,
        range: '± 0.35%',
        extra: '1000 samples',
        n: 10,
        mean: 2000,
        p75: 2500,
        p99: 4000,
        min: 1000,
        max: 10000,
        rme: 0.3456,
        samples: 1000,
        ...run,
      },
    ]);
  });

  it('takes the size from sizeOf when given', () => {
    const [entry] = benchEntries([completed('/app hit')], run, () => 12);
    assert.equal(entry?.n, 12);
  });

  it('fails on a task that did not complete', () => {
    assert.throws(
      () =>
        benchEntries([{ name: 'broken', result: { state: 'errored' } }], run),
      /broken: errored/,
    );
  });
});

describe('benchRun', () => {
  it('prefers GITHUB_SHA', async () => {
    const meta = await benchRun(failingExec, { GITHUB_SHA: 'cafe' });
    assert.equal(meta.sha, 'cafe');
    assert.equal(meta.node, process.version);
  });

  it('falls back to HEAD, then null', async () => {
    assert.equal((await benchRun(headExec, {})).sha, 'deadbeef');
    assert.equal((await benchRun(failingExec, {})).sha, null);
  });
});

const sink = () => {
  const stream = new PassThrough();
  const chunks: string[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));

  return { stream, text: () => chunks.join('') };
};

describe('benchReport', () => {
  const report = (argv: string[], dir = '/unused') => {
    const stdout = sink();
    const stderr = sink();

    return {
      stdout,
      stderr,
      report: benchReport({
        defaultPath: join(dir, '.cache', 'bench.json'),
        argv: ['node', 'x.bench.ts', ...argv],
        exec: headExec,
        env: {},
        stdout: stdout.stream,
        stderr: stderr.stream,
      }),
    };
  };

  it('defaults to the .cache path without a flag', () => {
    assert.deepEqual(report([]).report.output, {
      kind: 'file',
      path: '/unused/.cache/bench.json',
    });
  });

  it('takes the --json-out path', () => {
    assert.deepEqual(report(['--json-out', '/o.json']).report.output, {
      kind: 'file',
      path: '/o.json',
    });
  });

  it('rejects bad flags before the bench runs', () => {
    assert.throws(() => report(['--json-out']), /--json-out requires/);
    assert.throws(() => report(['--json', '/o.json']), /--json-out \/o\.json/);
  });

  it('writes the entries to the file and names it on stdout', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bench-report-'));

    try {
      const { report: bench, stdout, stderr } = report([], dir);
      await bench.write([completed('miss n=100')]);

      const path = join(dir, '.cache', 'bench.json');
      // SAFETY: write just wrote this file from BenchEntry[].
      const [entry] = JSON.parse(await readFile(path, 'utf8')) as BenchEntry[];
      assert.equal(entry?.n, 100);
      assert.equal(entry?.sha, 'deadbeef');
      assert.equal(stdout.text(), `wrote ${path}\n`);
      assert.equal(stderr.text(), '');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('puts only the JSON on stdout for --json, and the human output on stderr', async () => {
    for (const argv of [['--json'], ['--json-out', '-']]) {
      const { report: bench, stdout, stderr } = report(argv);
      bench.console.log('table');
      await bench.write([completed('miss n=100')]);

      // SAFETY: write just printed BenchEntry[].
      const [entry] = JSON.parse(stdout.text()) as BenchEntry[];
      assert.equal(entry?.n, 100);
      assert.equal(stderr.text(), 'table\n');
    }
  });
});

describe('benchBudget', () => {
  it('keeps tinybench defaults when BENCH_TIME_MS is unset or empty', () => {
    assert.deepEqual(benchBudget({}), {});
    assert.deepEqual(benchBudget({ BENCH_TIME_MS: '' }), {});
  });

  it('sets the per-task budget with a quarter of it as warmup', () => {
    assert.deepEqual(benchBudget({ BENCH_TIME_MS: '200' }), {
      time: 200,
      warmupTime: 50,
    });
  });

  it('rejects a budget that is not a positive number', () => {
    for (const value of ['0', '-5', 'fast'])
      assert.throws(
        () => benchBudget({ BENCH_TIME_MS: value }),
        /BENCH_TIME_MS/,
      );
  });
});
