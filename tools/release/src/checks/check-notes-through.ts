#!/usr/bin/env node
// Fails a release PR whose notes miss a commit that landed on its base after
// they were generated (see notes-through.ts). Each publishable member whose
// version the head changes is checked; a prerelease has no CHANGELOG.md
// section and is skipped.
//
// Usage: check-notes-through.ts --base <rev> --head <rev> [--json | --json-out <path>]
//   --base  the PR base tip, the range end the notes must cover
//   --head  the release PR head; base..head holds the release commit
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import semver from 'semver';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import {
  jsonOutput,
  withoutJsonFlags,
  writeJsonOutput,
} from '@tools/cli/json-output.ts';
import { isPublishable, loadWorkspace } from '@tools/shared/workspace.ts';

import {
  formatNotesThroughReport,
  type NotesThroughResult,
  passes,
} from './notes-through.core.ts';
import { bumpedDirs, checkNotesThrough } from './notes-through.ts';

const USAGE =
  'usage: check-notes-through.ts --base <rev> --head <rev> [--json | --json-out <path>]';

async function main(argv: readonly string[]): Promise<void> {
  const output = jsonOutput(argv);

  const { values } = parseArgs({
    args: withoutJsonFlags(argv),
    options: { base: { type: 'string' }, head: { type: 'string' } },
  });

  const { base, head } = values;

  if (!base || !head) {
    console.error(
      `check-notes-through: --base and --head are required\n${USAGE}`,
    );
    process.exitCode = 2;

    return;
  }

  const { members } = await loadWorkspace(workspaceRoot);
  const publishable = members.filter(isPublishable);

  const bumped = bumpedDirs(
    workspaceRoot,
    base,
    head,
    publishable.map(({ dir }) => dir),
  );

  const prereleases = bumped.filter(({ version }) =>
    semver.prerelease(version),
  );

  const stable = bumped.filter(({ version }) => !semver.prerelease(version));

  for (const { dir, version } of prereleases) {
    console.log(
      `- ${dir}: ${version} is a prerelease, which has no CHANGELOG.md section`,
    );
  }

  if (bumped.length === 0) {
    console.error(
      `✗ check-notes-through: ${base}..${head} bumps no publishable member's version`,
    );
    process.exitCode = 1;

    return;
  }

  const results: NotesThroughResult[] = stable.map(({ dir }) =>
    checkNotesThrough({
      packageName: publishable.find((m) => m.dir === dir)?.name ?? dir,
      cwd: join(workspaceRoot, dir),
      trailerRange: `${base}..${head}`,
      tip: base,
    }),
  );

  const ok = results.every(passes);
  const report = formatNotesThroughReport(results);

  if (report !== '')
    (output.kind === 'stdout' || !ok ? console.error : console.log)(report);

  await writeJsonOutput(
    output,
    `${JSON.stringify({ ok, base, head, prereleases, results }, null, 2)}\n`,
  );

  if (!ok) process.exitCode = 1;
}

if (import.meta.main) await main(process.argv.slice(2));
