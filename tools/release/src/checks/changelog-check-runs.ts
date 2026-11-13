#!/usr/bin/env node
// Posts the changelog drift verdict on HEAD; a failure is a warning, never an exit; only a usage error exits 2.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { changelogDrift } from '@tools/changelog/drift.ts';
import { messageOf } from '@tools/shared/errors.ts';
import { defaultExec } from '@tools/shared/exec.ts';
import { ensureGh } from '@tools/shared/gh.ts';
import { appendStepSummary, logWarning } from '@tools/shared/gha.ts';
import { isPublishable, loadWorkspace } from '@tools/shared/workspace.ts';

import { readLedger } from '../lib/ledger.ts';
import { withRetry } from '../lib/retry.ts';
import { toChangelogCheckRun } from './changelog-check-runs.core.ts';
import {
  checkRunApiArgs,
  checkRunsMarkdown,
} from './publish-check-runs.core.ts';

/** Each published package's CHANGELOG.md, `undefined` where there is none. */
async function changelogFiles() {
  const { members } = await loadWorkspace(workspaceRoot);

  return members
    .filter(isPublishable)
    .filter(({ dir }) => dir.startsWith('packages/'))
    .map(({ name, dir }) => {
      const path = join(workspaceRoot, dir, 'CHANGELOG.md');

      return {
        name,
        text: existsSync(path) ? readFileSync(path, 'utf8') : undefined,
      };
    });
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const repo = process.env.GITHUB_REPOSITORY;

  if (!repo && !dryRun) {
    console.error(
      'changelog-check-runs: GITHUB_REPOSITORY must be set (or pass --dry-run)',
    );
    process.exitCode = 2;

    return;
  }

  const files = await changelogFiles();
  let payload;

  try {
    const ledger = await withRetry(() => readLedger(), { baseDelayMs: 1000 });
    payload = toChangelogCheckRun(
      changelogDrift(files, ledger.versions),
      undefined,
    );
  } catch (cause) {
    payload = toChangelogCheckRun([], `ledger: ${messageOf(cause)}`);
  }

  await appendStepSummary(checkRunsMarkdown('changelog', [payload]));

  if (dryRun || !repo) {
    console.log(JSON.stringify(payload, null, 2));

    return;
  }

  await ensureGh();

  const { stdout } = await defaultExec('git', ['rev-parse', 'HEAD']);
  const headSha = stdout.trim();
  await defaultExec('gh', checkRunApiArgs(repo, headSha, payload));
  console.log(
    `created check run "${payload.name}" (${payload.conclusion}) on ${headSha}`,
  );
}

const warn = (cause: unknown): void =>
  logWarning(`changelog check run not reported: ${messageOf(cause)}`);

if (import.meta.main) await main().catch(warn);
