// Every workflow runs on the same explicit runner image. `ubuntu-latest` is a
// moving alias -- it flips to a new Ubuntu release under us, and a flip that
// lands mid-graph would split one run across two images. Pinning is only half
// of it: the pin also has to be the *same* everywhere, and a label actionlint
// does not ship has to be declared in .github/actionlint.yaml or every
// workflow fails its lint.
//
// The workflows are YAML and node has no parser for it that does not cost an
// install, so scan by line: `runs-on:` is always a plain scalar here, and the
// actionlint config's label list is a flat sequence.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

const workflowsDir = join(workspaceRoot, '.github', 'workflows');
const actionlintConfig = join(workspaceRoot, '.github', 'actionlint.yaml');

// The GitHub-hosted labels actionlint 1.7.12 knows. Anything else it reads as
// self-hosted and rejects unless the config declares it.
const KNOWN_LABELS = new Set([
  'ubuntu-22.04',
  'ubuntu-24.04',
  'ubuntu-22.04-arm',
  'ubuntu-24.04-arm',
]);

const EXPLICIT_LABEL = /^ubuntu-\d{2}\.04$/;

const workflows = readdirSync(workflowsDir)
  .filter((name) => name.endsWith('.yml'))
  .sort();

const sources = new Map(
  workflows.map((name) => [
    name,
    readFileSync(join(workflowsDir, name), 'utf8'),
  ]),
);

/** Every `runs-on:` scalar in a workflow, tagged with the file it came from. */
const runsOn = [...sources].flatMap(([name, source]) =>
  [...source.matchAll(/^\s*runs-on:\s*(\S+)\s*$/gm)].map(
    ([, label]) => [name, label] as const,
  ),
);

const used = [...new Set(runsOn.map(([, label]) => label))].sort();

// `self-hosted-runner: labels:` holds one `- <label>` per line and nothing else
// in this file is a sequence, so its items are the declared list.
const declared = [
  ...readFileSync(actionlintConfig, 'utf8').matchAll(/^\s+-\s*(\S+)\s*$/gm),
]
  .map(([, label]) => label)
  .sort();

describe('runner labels', () => {
  // A workflow whose jobs only `uses:` another one names no runner
  // (build-test.yml is the caller). Steps are what need one.
  it('finds a runs-on in every workflow that runs steps', () => {
    assert.notEqual(workflows.length, 0, 'no workflows found');
    const missing = [...sources]
      .filter(([, source]) => /^\s*steps:\s*$/m.test(source))
      .map(([name]) => name)
      .filter((name) => !runsOn.some(([file]) => file === name));
    assert.deepEqual(missing, [], 'workflows with steps but no runs-on');
  });

  it('pins an explicit ubuntu-NN.04 image, never a moving alias', () => {
    for (const [file, label] of runsOn) {
      assert.match(label, EXPLICIT_LABEL, `${file} runs-on: ${label}`);
    }
  });

  it('uses one label across every workflow', () => {
    assert.deepEqual(
      used.length,
      1,
      `runner labels diverge: ${JSON.stringify(runsOn)}`,
    );
  });

  it('declares exactly the labels actionlint does not know', () => {
    assert.deepEqual(
      declared,
      used.filter((label) => !KNOWN_LABELS.has(label)),
    );
  });
});
