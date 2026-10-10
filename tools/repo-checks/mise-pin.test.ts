// Every jdx/mise-action step pins the same mise release. Unpinned, the
// action's cache key leaves the version out, so a restored cache carries an
// older binary that fails its integrity check against each new release. The
// pin has no other home (the action reads no version file), so the workflows
// themselves are the only copies to hold together.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { trackedFiles } from './cli-query.ts';

const load = (file: string): string =>
  readFileSync(join(workspaceRoot, file), 'utf8');

// A bare CalVer release, as the action's `version` input takes it.
const MISE_RELEASE = /^\d{4}\.\d{1,2}\.\d+$/;

/** As much of a workflow as this check reads. */
type Workflow = {
  jobs?: Record<
    string,
    {
      steps?: {
        uses?: string;
        with?: Record<string, string | number | boolean | null>;
      }[];
    }
  >;
};

// GitHub reads both extensions, so a .yaml workflow must not slip past.
const workflows = trackedFiles(
  '.github/workflows/*.yml',
  '.github/workflows/*.yaml',
);

const steps = workflows.flatMap((workflow) =>
  Object.entries((parse(load(workflow)) as Workflow).jobs ?? {}).flatMap(
    ([job, { steps = [] }]) =>
      steps
        .filter(({ uses }) => uses?.startsWith('jdx/mise-action@'))
        .map((step) => ({
          where: `${workflow}#${job}`,
          // A YAML number (`2026.10`) parses to its own shape; narrow below.
          version: step.with?.version,
        })),
  ),
);

describe('mise version pins', () => {
  it('finds mise-action steps', () => {
    assert.notEqual(workflows.length, 0, 'no workflows found');
    assert.notEqual(steps.length, 0, 'no jdx/mise-action steps found');
  });

  it('pins an explicit mise release on every mise-action step', () => {
    for (const { where, version } of steps) {
      assert.ok(
        typeof version === 'string',
        `${where} pins no mise version: ${JSON.stringify(version)}`,
      );
      assert.match(version, MISE_RELEASE, `${where}: ${version}`);
    }
  });

  it('pins one release across every workflow', () => {
    const versions = new Set(steps.map(({ version }) => version));
    assert.equal(
      versions.size,
      1,
      `mise pins diverge: ${JSON.stringify(steps)}`,
    );
  });
});
