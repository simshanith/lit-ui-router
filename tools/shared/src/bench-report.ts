// Bench result files in github-action-benchmark's customSmallerIsBetter shape.
// Typed structurally against tinybench so this package needs no tinybench dependency.

import { Console } from 'node:console';

import { defaultExec } from './exec.ts';
import type { Exec } from './exec.ts';
import { jsonOutput, writeJsonOutput } from '@tools/cli/json-output.ts';
import type { JsonOutput } from '@tools/cli/json-output.ts';

/** The latency slice of a tinybench result; tinybench reports milliseconds. */
export interface BenchLatency {
  mean: number;
  p75: number;
  p99: number;
  min: number;
  max: number;
  rme: number;
  samplesCount: number;
}

/** The slice of a tinybench `Task` the report reads. */
export interface BenchTask {
  name: string;
  result: { state: string; latency?: BenchLatency };
}

/** Per-run metadata repeated on every entry, so each entry stands alone. */
export interface BenchRun {
  timestamp: string;
  sha: string | null;
  node: string;
  platform: string;
  arch: string;
}

/** A customSmallerIsBetter entry; the action's schema strips the flat keys after `extra`. */
export interface BenchEntry extends BenchRun {
  name: string;
  unit: 'ns';
  value: number;
  range: string;
  extra: string;
  n: number;
  mean: number;
  p75: number;
  p99: number;
  min: number;
  max: number;
  rme: number;
  samples: number;
}

const ns = (ms: number) => ms * 1e6;

/** The route-table size from a task named `... n=<size>`; NaN when absent. */
export const sizeFromName = (name: string): number =>
  Number(/ n=(\d+)$/.exec(name)?.[1]);

/** Entries for every task; a task that did not complete fails the report. */
export function benchEntries(
  tasks: readonly BenchTask[],
  run: BenchRun,
  sizeOf: (name: string) => number = sizeFromName,
): BenchEntry[] {
  return tasks.map(({ name, result }) => {
    const { latency } = result;

    if (result.state !== 'completed' || !latency)
      throw new Error(`${name}: ${result.state}`);

    return {
      name,
      unit: 'ns',
      value: ns(latency.mean),
      range: `± ${latency.rme.toFixed(2)}%`,
      extra: `${latency.samplesCount} samples`,
      n: sizeOf(name),
      mean: ns(latency.mean),
      p75: ns(latency.p75),
      p99: ns(latency.p99),
      min: ns(latency.min),
      max: ns(latency.max),
      rme: latency.rme,
      samples: latency.samplesCount,
      ...run,
    };
  });
}

/** This run's metadata; `sha` is GITHUB_SHA, else the checkout's HEAD, else null. */
export async function benchRun(
  exec: Exec = defaultExec,
  env: NodeJS.ProcessEnv = process.env,
): Promise<BenchRun> {
  let sha = env.GITHUB_SHA ?? null;

  if (!sha) {
    try {
      sha = (await exec('git', ['rev-parse', 'HEAD'])).stdout.trim();
    } catch {
      sha = null;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    sha,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}

/** tinybench's time budget per task. */
export interface BenchBudget {
  time: number;
  warmupTime: number;
}

/**
 * `BENCH_TIME_MS` as tinybench options, warmup a quarter of it; empty keeps
 * tinybench's defaults.
 */
export function benchBudget(
  env: NodeJS.ProcessEnv = process.env,
): BenchBudget | Record<string, never> {
  const raw = env.BENCH_TIME_MS;

  if (raw === undefined || raw === '') return {};

  const time = Number(raw);

  if (!Number.isFinite(time) || time <= 0)
    throw new Error(
      `BENCH_TIME_MS must be a positive number of ms, got ${raw}`,
    );

  return { time, warmupTime: time / 4 };
}

/** Options for {@link benchReport}. */
export interface BenchReportOptions {
  /** Where the file lands without `--json` or `--json-out`: the package's gitignored `.cache/`. */
  defaultPath: string;
  /** Route-table size per task; defaults to {@link sizeFromName}. */
  sizeOf?: (name: string) => number;
  argv?: readonly string[];
  exec?: Exec;
  env?: NodeJS.ProcessEnv;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
}

/** A bench's report destination, read from its arguments before the bench runs. */
export interface BenchReport {
  output: Exclude<JsonOutput, { kind: 'none' }>;
  /** The human output: stdout, or stderr when the report takes stdout. */
  console: Console;
  /** Writes the entries as a JSON array, naming the file on {@link BenchReport.console}. */
  write(tasks: readonly BenchTask[]): Promise<void>;
}

/** Resolves `--json` / `--json-out` up front, so a bad flag fails before the bench runs. */
export function benchReport({
  defaultPath,
  sizeOf,
  argv = process.argv,
  exec = defaultExec,
  env = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
}: BenchReportOptions): BenchReport {
  const output = jsonOutput(argv, { defaultPath });
  const human = new Console(output.kind === 'stdout' ? stderr : stdout);

  return {
    output,
    console: human,
    async write(tasks) {
      const entries = benchEntries(tasks, await benchRun(exec, env), sizeOf);

      await writeJsonOutput(
        output,
        `${JSON.stringify(entries, null, 2)}\n`,
        stdout,
      );

      if (output.kind === 'file') human.log(`wrote ${output.path}`);
    },
  };
}
