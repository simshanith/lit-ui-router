// Every workflow runs on the same explicit runner image. `ubuntu-latest` is a
// moving alias -- it flips to a new Ubuntu release under us, and a flip that
// lands mid-graph would split one run across two images. Pinning is only half
// of it: the pin also has to be the *same* everywhere, and a label actionlint
// does not ship has to be declared in .github/actionlint.yaml or every
// workflow fails its lint.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { trackedFiles } from './cli-query.ts';

const load = (file: string): unknown =>
  parse(readFileSync(join(workspaceRoot, file), 'utf8'));

const actionlintConfig = join('.github', 'actionlint.yaml');

// The GitHub-hosted labels actionlint 1.7.12 knows. Anything else it reads as
// self-hosted and rejects unless the config declares it.
const KNOWN_LABELS = new Set([
  'ubuntu-22.04',
  'ubuntu-24.04',
  'ubuntu-22.04-arm',
  'ubuntu-24.04-arm',
]);

const EXPLICIT_LABEL = /^ubuntu-\d{2}\.04$/;

/** As much of a workflow as this check reads. */
type Workflow = {
  jobs?: Record<
    string,
    {
      // A job that only `uses:` a reusable workflow names no runner — the
      // callee does. build-test.yml is entirely callers.
      uses?: string;
      // Anything but a plain label (a `${{ }}` expression, a matrix array)
      // parses to its own shape, so widen and narrow at the assertion.
      'runs-on'?: unknown;
    }
  >;
};

/** As much of .github/actionlint.yaml as this check reads. */
type ActionlintConfig = { 'self-hosted-runner'?: { labels?: string[] } };

const workflows = trackedFiles('.github/workflows/*.yml');

const jobs = workflows.flatMap((workflow) =>
  Object.entries((load(workflow) as Workflow).jobs ?? {})
    .filter(([, job]) => job.uses === undefined)
    .map(([job, { 'runs-on': runsOn }]) => ({ workflow, job, runsOn })),
);

const used = [
  ...new Set(
    jobs
      .map(({ runsOn }) => runsOn)
      .filter((runsOn): runsOn is string => typeof runsOn === 'string'),
  ),
].sort();

const declared = [
  ...((load(actionlintConfig) as ActionlintConfig)['self-hosted-runner']
    ?.labels ?? []),
].sort();

describe('runner labels', () => {
  it('finds a runs-on on every job that runs steps', () => {
    assert.notEqual(workflows.length, 0, 'no workflows found');
    assert.notEqual(jobs.length, 0, 'no step-running jobs found');
    const missing = jobs
      .filter(({ runsOn }) => runsOn === null || runsOn === undefined)
      .map(({ workflow, job }) => `${workflow}#${job}`);
    assert.deepEqual(missing, [], 'jobs with steps but no runs-on');
  });

  it('pins an explicit ubuntu-NN.04 image, never a moving alias', () => {
    for (const { workflow, job, runsOn } of jobs) {
      const where = `${workflow}#${job} runs-on`;
      // An expression or a matrix array is not a pin — narrow before matching,
      // so the failure names the shape rather than a stringified object.
      assert.ok(
        typeof runsOn === 'string',
        `${where} is not a plain label: ${JSON.stringify(runsOn)}`,
      );
      assert.match(runsOn, EXPLICIT_LABEL, `${where}: ${runsOn}`);
    }
  });

  it('uses one label across every workflow', () => {
    assert.deepEqual(
      used.length,
      1,
      `runner labels diverge: ${JSON.stringify(jobs)}`,
    );
  });

  it('declares exactly the labels actionlint does not know', () => {
    assert.deepEqual(
      declared,
      used.filter((label) => !KNOWN_LABELS.has(label)),
    );
  });
});
