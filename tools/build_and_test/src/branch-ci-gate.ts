#!/usr/bin/env node
// Decides whether a branch-head push needs its own CI run, exporting
// `run=true|false` to GITHUB_OUTPUT for build-test.yml's build_and_test `if`.
//
// A mergeable branch with an open PR gets a merge-head pull_request run on the
// same content, so the push run is a duplicate racing it for the same turbo
// cache entries. It stops being a duplicate exactly when pull_request cannot
// fire — see branch-ci-gate.core.ts for the predicate.
//
// Mergeability is probed locally with `git merge-tree` against freshly fetched
// bases, never from the PR API's `mergeable` field (computed async, returns
// null until ready) or the existence of `refs/pull/N/merge` (stale, and it
// races the push being gated — reading a leftover merge ref as "mergeable" is
// precisely the signal loss this gate exists to prevent).
//
// Imports stay limited to node builtins and this tool's own core so the gate
// job runs on `mise-action` alone: a gate that first paid for `mise run setup`
// would cost more than it saves on the runs it cannot skip.
//
// env: GITHUB_REF_NAME (pushed branch), GH_TOKEN (gh pr list),
//      GITHUB_OUTPUT / GITHUB_STEP_SUMMARY (runner files; printed when unset).

import { execFile } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import {
  type BaseVerdict,
  type OpenPr,
  decide,
  distinctBases,
  mergeStateFromExit,
  parseOpenPrs,
  summaryMarkdown,
} from './branch-ci-gate.core.ts';

const run = promisify(execFile);

// argv arrays only — ref names reach git and gh without a shell re-parsing them.
async function capture(command: string, args: string[]): Promise<string> {
  const { stdout } = await run(command, args, { maxBuffer: 16 * 1024 * 1024 });
  return stdout.trim();
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Probe one base. Fetched explicitly rather than trusting the checkout's
 * remote refs, so the answer is about the base as it stands now; anything that
 * throws before an exit status becomes `unknown`, which runs the workflow.
 */
async function probeBase(baseRef: string, head: string): Promise<BaseVerdict> {
  const base: Pick<BaseVerdict, 'baseRef'> & { prs: number[] } = {
    baseRef,
    prs: [],
  };
  try {
    await capture('git', [
      'fetch',
      '--no-tags',
      '--quiet',
      'origin',
      `refs/heads/${baseRef}`,
    ]);
  } catch (error) {
    return {
      ...base,
      state: 'unknown',
      detail: `fetch failed: ${messageOf(error)}`,
    };
  }
  try {
    await capture('git', ['merge-tree', '--write-tree', 'FETCH_HEAD', head]);
    return { ...base, state: 'clean' };
  } catch (error) {
    // execFile rejects on any non-zero exit; exit 1 is the conflict answer,
    // not a failure, so the status and stdout decide rather than the rejection.
    const failure = error as { code?: number | null; stdout?: string };
    const code = failure.code ?? null;
    const state = mergeStateFromExit(
      typeof code === 'number' ? code : null,
      failure.stdout ?? '',
    );
    return {
      ...base,
      state,
      detail: state === 'unknown' ? messageOf(error) : undefined,
    };
  }
}

async function main(): Promise<void> {
  const branch = process.env.GITHUB_REF_NAME?.trim() ?? '';
  if (branch === '') {
    throw new Error('missing required environment variable GITHUB_REF_NAME');
  }
  const head = await capture('git', ['rev-parse', 'HEAD']);

  const prs: OpenPr[] = parseOpenPrs(
    JSON.parse(
      await capture('gh', [
        'pr',
        'list',
        '--head',
        branch,
        '--state',
        'open',
        '--json',
        'number,baseRefName',
      ]),
    ),
  );

  const verdicts: BaseVerdict[] = [];
  for (const { baseRef, prs: numbers } of distinctBases(prs)) {
    const verdict = await probeBase(baseRef, head);
    verdicts.push({ ...verdict, prs: numbers });
  }

  await report(branch, head, prs, verdicts, decide(prs, verdicts));
}

async function report(
  branch: string,
  head: string,
  prs: readonly OpenPr[],
  verdicts: readonly BaseVerdict[],
  decision: ReturnType<typeof decide>,
): Promise<void> {
  console.log(`${decision.run ? 'RUN' : 'SKIP'}: ${decision.reason}`);

  // Both runner files are absent on a local `mise run`; print instead so a dry
  // local invocation still shows exactly what CI would export.
  const output = process.env.GITHUB_OUTPUT;
  const line = `run=${decision.run}`;
  if (output) await appendFile(output, `${line}\n`);
  else console.log(line);

  const summary = process.env.GITHUB_STEP_SUMMARY;
  const markdown = summaryMarkdown(branch, head, prs, verdicts, decision);
  if (summary) await appendFile(summary, markdown);
  else console.log(`\n${markdown}`);
}

main().catch(async (error: unknown) => {
  // Fail open: the gate never becomes a way to lose CI. Any breakage here
  // (gh down, unexpected JSON, no git) reports as "run" and stays green.
  const message = messageOf(error);
  console.log(
    `::warning::branch CI gate failed, running CI anyway: ${message}`,
  );
  const output = process.env.GITHUB_OUTPUT;
  if (output) await appendFile(output, 'run=true\n');
  else console.log('run=true');
});
