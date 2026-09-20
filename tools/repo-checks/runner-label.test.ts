// Every workflow runs on the same explicit runner image. `ubuntu-latest` is a
// moving alias -- it flips to a new Ubuntu release under us, and a flip that
// lands mid-graph would split one run across two images. Pinning is only half
// of it: the pin also has to be the *same* everywhere, and a label actionlint
// does not ship has to be declared in .github/actionlint.yaml or every
// workflow fails its lint.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

// The workflows are YAML, so query them instead of matching their text: yq is
// this repo's YAML query tool the way taplo is its TOML one (both mise-pinned),
// and `-o=json` hands back something node can parse. Same shape as
// pnpm-pin.test.ts's taploGet.
const yqGet = (file: string, expression: string): unknown =>
  JSON.parse(
    execFileSync('yq', ['-o=json', expression, join(workspaceRoot, file)], {
      encoding: 'utf8',
    }),
  );

// Jobs that only `uses:` a reusable workflow name no runner — the callee does.
// build-test.yml is entirely callers, so it contributes nothing here.
const JOB_RUNNERS =
  '.jobs | to_entries | map(select(.value.uses == null) | {"job": .key, "runsOn": .value["runs-on"]})';
const DECLARED_LABELS = '.self-hosted-runner.labels';

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

/** One job that runs steps of its own, and the runner it asked for. */
type JobRunner = {
  job: string;
  // `null` when the job names no runner at all; anything but a plain label
  // (a `${{ }}` expression, a matrix array) arrives as its parsed shape.
  runsOn: unknown;
};

const workflows = readdirSync(join(workspaceRoot, '.github', 'workflows'))
  .filter((name) => name.endsWith('.yml'))
  .sort();

const jobs = workflows.flatMap((name) =>
  (yqGet(join('.github', 'workflows', name), JOB_RUNNERS) as JobRunner[]).map(
    (entry) => ({ ...entry, workflow: name }),
  ),
);

const labels = jobs
  .map(({ runsOn }) => runsOn)
  .filter((runsOn): runsOn is string => typeof runsOn === 'string');
const used = [...new Set(labels)].sort();

const declared = [
  ...(yqGet(actionlintConfig, DECLARED_LABELS) as string[]),
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
