#!/usr/bin/env node
// Write one GitHub Actions run's turbo task logs to a single readable file.
// Usage: ci-logs <run-id> [--baseline <run-id>] --out <file>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { defaultCapture, type Exec } from '@tools/shared/exec.ts';
import { ensureGh } from '@tools/shared/gh.ts';
import * as v from 'valibot';

import { downloadArtifact, listArtifacts, viewRun } from './gh.ts';
import { countLines, render, type RunSource } from './render.ts';
import {
  artifactName,
  mergeTasks,
  parseArtifactName,
  planArtifacts,
  RUN_SUMMARIES,
  SummarySchema,
  TASK_LOGS,
  type Summary,
} from './summary.ts';

const usage = 'usage: ci-logs <run-id> [--baseline <run-id>] --out <file>';

const RUN_ID = /^\d+$/;

const readSummary = (file: string): Summary =>
  v.parse(SummarySchema, JSON.parse(fs.readFileSync(file, 'utf8')));

function readSummaries(runDir: string, names: readonly string[]) {
  return names.flatMap((name) => {
    const parsed = parseArtifactName(name);

    if (parsed?.kind !== RUN_SUMMARIES) return [];

    const dir = path.join(runDir, name);
    const files = fs.readdirSync(dir).filter((file) => file.endsWith('.json'));

    return files.map((file) => ({
      group: parsed.group,
      summary: readSummary(path.join(dir, file)),
    }));
  });
}

async function fetchRun(
  runId: string,
  scratch: string,
  exec: Exec,
): Promise<RunSource> {
  const [info, artifacts] = await Promise.all([
    viewRun(runId, exec),
    listArtifacts(runId, exec),
  ]);

  const plan = planArtifacts(artifacts);
  const runDir = path.join(scratch, runId);

  await Promise.all(
    plan.download.map((name) =>
      downloadArtifact(runId, name, path.join(runDir, name), exec),
    ),
  );

  return {
    info,
    tasks: mergeTasks(readSummaries(runDir, plan.download)),
    downloaded: plan.download,
    expired: plan.expired,
    readLog: (group, logFile) => {
      const file = path.join(runDir, artifactName(TASK_LOGS, group), logFile);

      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined;
    },
  };
}

const main = async (): Promise<void> => {
  const started = performance.now();

  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      baseline: { type: 'string' },
      out: { type: 'string' },
    },
  });

  const [runId] = positionals;
  const { baseline: baselineId, out } = values;

  if (
    runId === undefined ||
    positionals.length !== 1 ||
    !RUN_ID.test(runId) ||
    (baselineId !== undefined && !RUN_ID.test(baselineId)) ||
    out === undefined
  ) {
    console.error(usage);
    process.exitCode = 1;

    return;
  }

  const exec = defaultCapture;

  await ensureGh(exec);

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-logs-'));

  const [target, baseline] = await Promise.all([
    fetchRun(runId, scratch, exec),
    baselineId === undefined ? undefined : fetchRun(baselineId, scratch, exec),
  ]);

  const report = render(target, baseline);
  fs.writeFileSync(out, report);

  const executed = [...target.tasks.values()].filter((t) => t.executed).length;
  const seconds = ((performance.now() - started) / 1000).toFixed(1);

  console.log(
    `ci-logs: ${out}: ${target.downloaded.length} artifacts, ${executed} executed, ` +
      `${target.tasks.size - executed} replayed, ${countLines(report)} lines, ` +
      `${seconds}s; artifacts in ${scratch}`,
  );

  if (target.tasks.size === 0) {
    console.error(`ci-logs: run ${runId} has no run summaries left`);
    process.exitCode = 1;
  }
};

if (import.meta.main) await main();
