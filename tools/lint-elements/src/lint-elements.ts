#!/usr/bin/env node
// The `//#lint:elements` lane: eslint-plugin-lit / -wc / -lit-a11y over src,
// plus the warning ratchet that keeps the lane's noise floor from rising.
//
// eslint exits 0 with warnings, so the lane's lit-a11y warnings land green and
// nothing downstream can see them (turbo's run summary carries only an exit
// code per task). This shell lints with `--format json`, diffs the warnings it
// finds against the committed snapshot, and fails when an entry appears that
// the snapshot does not already carry.
//
// The snapshot is empty, so the floor is zero and any warning is a regression.
// It stays a snapshot rather than becoming `error` because these surfaces are
// warn-only on purpose: a11y findings in demo markup are worth seeing without
// gating the library's lint (see eslint.config.ts).
//
// Regenerate after fixing warnings: `pnpm lint:elements:snapshot`.
//
// Comparison and marker logic: @tools/warn-lanes/warn-lanes.core.ts.
// Usage (from anywhere in the workspace): lint-elements [--update]

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type WarnFiles,
  type WarnMessage,
  type WarnSnapshot,
  buildSnapshot,
  checkSnapshotIntegrity,
  diffWarnings,
  formatWarnLaneMarker,
  statusOf,
  tallyFiles,
  totalWarnings,
} from '@tools/warn-lanes/warn-lanes.core.ts';
import { WORKSPACE_SRC_GLOB } from '@tools/shared/globs.ts';

/** The turbo task id this lane reports as; must match a WARN_WATCHED_LANES entry. */
const TASK = '//#lint:elements';
const REGENERATE = 'pnpm lint:elements:snapshot';

// Everything below is anchored to the repo root rather than to cwd: the lane
// runs as a root turbo task, but the bin is on PATH workspace-wide and lints
// the same tree wherever it is called from.
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const SNAPSHOT_FILE = new URL('../warnings.json', import.meta.url);
/** How the snapshot is named in output — a path a reader can paste into an editor. */
const SNAPSHOT_PATH = relative(ROOT, fileURLToPath(SNAPSHOT_FILE)).replaceAll(
  '\\',
  '/',
);

// The lint invocation. `--cache-strategy content` because a checkout's mtimes
// say nothing; the cache still replays warnings on a hit, so the ratchet cannot
// go stale-blind.
const ESLINT_ARGS = [
  '--cache',
  '--cache-location',
  '.cache/eslint-elements',
  '--cache-strategy',
  'content',
  WORKSPACE_SRC_GLOB,
];

/** eslint's `--format json` shape, narrowed to what this lane reads. */
interface EslintResult {
  filePath: string;
  messages: {
    ruleId: string | null;
    severity: 0 | 1 | 2;
    message: string;
    line?: number;
    column?: number;
  }[];
}

/**
 * eslint's CLI by module resolution rather than off PATH, so the lane does not
 * depend on which package's `node_modules/.bin` the caller happened to have.
 * Joined onto the manifest's own directory because eslint's `exports` block
 * refuses `eslint/bin/eslint.js`, while `eslint/package.json` is exported.
 */
function eslintCli(): string {
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve('eslint/package.json');
  const manifest = require('eslint/package.json') as {
    bin: Record<string, string>;
  };
  return join(dirname(manifestPath), manifest.bin.eslint);
}

function runEslint(): EslintResult[] {
  // From the repo root, which is where the globs, the flat config and the
  // cache location are all relative to. `--format json` puts the report on
  // stdout alone, so stderr stays a genuine failure channel.
  const eslint = spawnSync(
    process.execPath,
    [eslintCli(), ...ESLINT_ARGS, '--format', 'json'],
    {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (eslint.error !== undefined) {
    throw new Error(`could not run eslint: ${eslint.error.message}`);
  }
  // 0 = clean or warnings-only, 1 = errors present (still a full report),
  // anything else = eslint itself failed and there is no report to read.
  if (eslint.status !== 0 && eslint.status !== 1) {
    process.stderr.write(eslint.stderr);
    process.exit(eslint.status ?? 1);
  }
  if (eslint.stderr.trim() !== '') process.stderr.write(eslint.stderr);
  return JSON.parse(eslint.stdout) as EslintResult[];
}

function collect(results: readonly EslintResult[]): WarnMessage[] {
  const messages: WarnMessage[] = [];
  for (const result of results) {
    // Repo-root-relative, because that is the key the snapshot is written with
    // and it has to survive being compared from a different cwd.
    const file = relative(ROOT, result.filePath).replaceAll('\\', '/');
    for (const message of result.messages) {
      if (message.severity === 0) continue;
      messages.push({
        file,
        line: message.line ?? 0,
        column: message.column ?? 0,
        ruleId: message.ruleId,
        message: message.message,
        severity: message.severity,
      });
    }
  }
  return messages;
}

function readSnapshot(): WarnSnapshot {
  try {
    return JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8')) as WarnSnapshot;
  } catch (error: unknown) {
    throw new Error(
      `could not read ${SNAPSHOT_PATH} — generate it with \`${REGENERATE}\``,
      { cause: error },
    );
  }
}

function writeSnapshot(snapshot: WarnSnapshot): void {
  writeFileSync(SNAPSHOT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`);
}

/** Every message, grouped by file — the lane's findings-only report. */
function printMessages(messages: readonly WarnMessage[]): void {
  let current = '';
  for (const message of messages) {
    if (message.file !== current) {
      current = message.file;
      console.log(`\n${current}`);
    }
    const severity = message.severity === 2 ? 'error  ' : 'warning';
    console.log(
      `  ${message.line}:${message.column}  ${severity}  ${message.message}  ${message.ruleId ?? ''}`,
    );
  }
  if (messages.length > 0) console.log('');
}

function main(): void {
  const update = process.argv.includes('--update');
  const messages = collect(runEslint());
  const errors = messages.filter((message) => message.severity === 2);
  const observed: WarnFiles = tallyFiles(messages);
  const total = totalWarnings(observed);

  printMessages(messages);

  if (update) {
    const snapshot = buildSnapshot(TASK, observed);
    writeSnapshot(snapshot);
    console.log(
      `${SNAPSHOT_PATH} updated: ${snapshot.total} warnings over ${Object.keys(snapshot.files).length} files.`,
    );
    // Errors are not snapshottable — they fail the lane even under --update.
    if (errors.length > 0) process.exit(1);
    return;
  }

  const snapshot = readSnapshot();
  const problems = checkSnapshotIntegrity(snapshot);
  if (problems.length > 0) {
    console.error(
      `${SNAPSHOT_PATH} is internally inconsistent — regenerate it with \`${REGENERATE}\`:`,
    );
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }

  const { regressions, improvements } = diffWarnings(snapshot.files, observed);
  const status = statusOf(total, snapshot.total);

  console.log(
    `lint:elements — ${total} warnings, ${errors.length} errors; snapshot floor ${snapshot.total}.`,
  );

  if (improvements.length > 0) {
    // Auto-pass: a contributor who fixed a warning should not be blocked on
    // bookkeeping. Loud, because a stale floor is a floor that stopped ratcheting.
    const fixed = improvements.reduce(
      (sum, delta) => sum + (delta.was - delta.now),
      0,
    );
    console.log(
      `\n${fixed} fewer warning${fixed === 1 ? '' : 's'} than the snapshot — update it with \`${REGENERATE}\`:`,
    );
    for (const { file, rule, was, now } of improvements) {
      console.log(`  ${file}  ${rule}  ${was} -> ${now}`);
    }
  }

  if (regressions.length > 0) {
    console.error(
      `\n${regressions.length} new warning entr${regressions.length === 1 ? 'y' : 'ies'} not in ${SNAPSHOT_PATH}:`,
    );
    for (const { file, rule, was, now } of regressions) {
      console.error(`  ${file}  ${rule}  ${was} -> ${now}`);
    }
    console.error(
      `\nFix them, suppress them at the call site, or — if the rule is wrong here —` +
        `\nre-evaluate the rule. The snapshot is a floor being drained (#606), not a budget` +
        `\nto spend: \`${REGENERATE}\` is for a snapshot that went DOWN.`,
    );
  }

  // The line the CI run-summary overview reads back out of this task's log.
  console.log(
    formatWarnLaneMarker({
      task: TASK,
      total,
      floor: snapshot.total,
      status,
      regressions: regressions.length,
      rules: buildSnapshot(TASK, observed).rules,
    }),
  );

  if (errors.length > 0 || regressions.length > 0) process.exit(1);
}

main();
