#!/usr/bin/env node
// Adds the sections each published package's CHANGELOG.md lacks, from a ledger
// read saved as JSON (see README.md). Re-running adds only what is missing.
//
// Usage: backfill.ts --ledger <file> [--dry-run] [--json | --json-out <path>]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import {
  jsonOutput,
  withoutJsonFlags,
  writeJsonOutput,
} from '@tools/cli/json-output.ts';
import { isPublishable, loadWorkspace } from '@tools/shared/workspace.ts';

import {
  type BackfillPlan,
  parseLedger,
  planBackfill,
} from './backfill.core.ts';

const USAGE =
  'usage: backfill.ts --ledger <file> [--dry-run] [--json | --json-out <path>]';

function report(plan: BackfillPlan, dryRun: boolean): string {
  const lines = plan.packages.map(
    ({ name, sections, added, missing }) =>
      `${name}: ${sections} sections, ${added.length} added${missing.length ? `, no body: ${missing.join(', ')}` : ''}`,
  );

  const styles = Object.entries(plan.leadingHeadingStyles);

  lines.push(
    `leading-heading styles (${styles.length}): ${styles.map(([style, count]) => `${style} ×${count}`).join(', ')}`,
    `transformations: ${JSON.stringify(plan.transformations)}`,
  );

  if (dryRun) lines.push('dry run: no file written');

  return `${lines.join('\n')}\n`;
}

async function main(argv: readonly string[]): Promise<void> {
  const output = jsonOutput(argv);

  const { values } = parseArgs({
    args: withoutJsonFlags(argv),
    options: {
      ledger: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });

  if (values.ledger === undefined) {
    console.error(`backfill: --ledger is required\n${USAGE}`);
    process.exitCode = 2;

    return;
  }

  const rows = parseLedger(readFileSync(values.ledger, 'utf8'));
  const { members } = await loadWorkspace(workspaceRoot);

  const packages = members
    .filter(isPublishable)
    .filter(({ dir }) => dir.startsWith('packages/'))
    .map(({ name, dir }) => {
      const path = join(workspaceRoot, dir, 'CHANGELOG.md');

      return {
        name,
        path,
        text: existsSync(path) ? readFileSync(path, 'utf8') : undefined,
      };
    });

  const plan = planBackfill(packages, rows);
  const dryRun = values['dry-run'];

  if (!dryRun) {
    for (const { changed, path, text } of plan.packages)
      if (changed) writeFileSync(path, text);
  }

  const summary = report(plan, dryRun);

  if (output.kind === 'stdout') process.stderr.write(summary);
  else process.stdout.write(summary);

  await writeJsonOutput(
    output,
    `${JSON.stringify(
      {
        dryRun,
        packages: plan.packages.map(
          ({ text: _text, path: _path, ...rest }) => rest,
        ),
        transformations: plan.transformations,
        leadingHeadingStyles: plan.leadingHeadingStyles,
      },
      null,
      2,
    )}\n`,
  );
}

if (import.meta.main) await main(process.argv.slice(2));
