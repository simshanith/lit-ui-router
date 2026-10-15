#!/usr/bin/env node
// Prints the ui-router-server Bench pulse and appends it to $GITHUB_STEP_SUMMARY when set.

import { appendFile, readFile } from 'node:fs/promises';

import * as v from 'valibot';

import {
  type BenchEntry,
  type BenchGroup,
  BENCH_SOURCES,
  BenchFileSchema,
  benchSummaryMarkdown,
} from './bench-summary.core.ts';

const readEntries = async (path: string): Promise<BenchEntry[] | undefined> => {
  let raw: string;

  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return undefined;
  }

  return v.parse(BenchFileSchema, JSON.parse(raw));
};

const main = async (): Promise<void> => {
  const groups: BenchGroup[] = [];

  for (const source of BENCH_SOURCES)
    groups.push({ source, entries: await readEntries(source.path) });

  if (groups.every(({ entries }) => entries === undefined)) {
    console.error(
      'bench-summary: no bench result file; run `mise run bench_pulse` first',
    );
    process.exitCode = 1;

    return;
  }

  const markdown = benchSummaryMarkdown(groups);

  console.log(markdown);

  const file = process.env.GITHUB_STEP_SUMMARY;

  if (file) await appendFile(file, markdown);
};

if (import.meta.main) await main();
