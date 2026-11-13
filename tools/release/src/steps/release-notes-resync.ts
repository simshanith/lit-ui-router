#!/usr/bin/env node
// Publishes CHANGELOG.md sections to the GitHub releases whose bodies differ; a dry run by default.
//
// Usage: release-notes-resync.ts [--package <name>] [--version <version>] [--dry-run true|false] [--json | --json-out <path>]
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  jsonOutput,
  withoutJsonFlags,
  writeJsonOutput,
} from '@tools/cli/json-output.ts';
import { messageOf } from '@tools/shared/errors.ts';
import { defaultCapture } from '@tools/shared/exec.ts';
import { ensureGh } from '@tools/shared/gh.ts';
import { appendStepSummary, logError, onActions } from '@tools/shared/gha.ts';
import * as v from 'valibot';

import { changelogFiles } from '../lib/changelog-files.ts';
import {
  ReleaseSchema,
  applyResync,
  planResync,
  readLatest,
  releaseListArgs,
  resyncMarkdown,
} from './release-notes-resync.core.ts';

const USAGE =
  'usage: release-notes-resync.ts [--package <name>] [--version <version>] [--dry-run true|false] [--json | --json-out <path>]';

const ALL = (value: string | undefined): string =>
  value === undefined || value.trim() === 'all' ? '' : value.trim();

async function readReleases(repo: string) {
  const { stdout } = await defaultCapture('gh', releaseListArgs(repo));

  return stdout
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => v.parse(ReleaseSchema, JSON.parse(line)));
}

/** Writes each change's notes to its own file under one temporary directory. */
async function notesWriter() {
  const dir = await mkdtemp(join(tmpdir(), 'release-notes-'));

  return async (tag: string, notes: string): Promise<string> => {
    const file = join(dir, `${tag.replace(/[/@]/g, '_')}.md`);
    await writeFile(file, notes);

    return file;
  };
}

// JSON on stdout leaves stdout to the document.
async function writeSummary(summary: string, kind: string): Promise<void> {
  if (kind === 'stdout' && !onActions()) process.stderr.write(summary);
  else await appendStepSummary(summary);
}

async function main(argv: readonly string[]): Promise<void> {
  const output = jsonOutput(argv);

  const { values } = parseArgs({
    args: withoutJsonFlags(argv),
    options: {
      package: { type: 'string' },
      version: { type: 'string' },
      'dry-run': { type: 'string', default: 'true' },
    },
  });

  const dryRunFlag = values['dry-run'].trim();

  if (dryRunFlag !== 'true' && dryRunFlag !== 'false') {
    console.error(
      `release-notes-resync: --dry-run takes true or false\n${USAGE}`,
    );
    process.exitCode = 2;

    return;
  }

  const dryRun = dryRunFlag !== 'false';
  const repo = process.env.GITHUB_REPOSITORY ?? 'simshanith/lit-ui-router';

  await ensureGh();

  const [files, releases, latest] = await Promise.all([
    changelogFiles(),
    readReleases(repo),
    readLatest(defaultCapture, repo),
  ]);

  let plan;

  try {
    plan = planResync(files, releases, {
      package: ALL(values.package),
      version: ALL(values.version),
    });
  } catch (cause) {
    console.error(`release-notes-resync: ${messageOf(cause)}\n${USAGE}`);
    process.exitCode = 2;

    return;
  }

  // Off Actions the summary below already prints the diffs.
  if (onActions())
    for (const { diff } of plan.changes) process.stderr.write(diff);

  const applied = dryRun
    ? undefined
    : await applyResync(plan.changes, {
        exec: defaultCapture,
        repo,
        latest,
        writeNotes: await notesWriter(),
      });

  if (applied?.failure !== undefined) {
    logError(`release-notes-resync: ${applied.failure}`);
    process.exitCode = 1;
  }

  await writeSummary(resyncMarkdown(plan, latest, applied), output.kind);

  await writeJsonOutput(
    output,
    `${JSON.stringify(
      {
        dryRun,
        latest: latest ?? null,
        changes: plan.changes.map(({ tag, diff }) => ({ tag, diff })),
        edited: applied?.edited ?? [],
        failure: applied?.failure ?? null,
        skipped: plan.skipped,
        inSync: plan.inSync,
      },
      null,
      2,
    )}\n`,
  );
}

if (import.meta.main) await main(process.argv.slice(2));
