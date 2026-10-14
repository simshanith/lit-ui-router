// build-test-run.yml runs one e2e job per suite; its matrix must name exactly
// the suites a bare run-e2e.ts selects, or a new suite never runs in CI.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

import { defaultSuites } from './run-e2e.ts';

const WORKFLOW = join('.github', 'workflows', 'build-test-run.yml');

/** As much of the workflow as this check reads. */
type Workflow = {
  jobs?: { e2e?: { strategy?: { matrix?: { suite?: string[] } } } };
};

// SAFETY: actionlint holds workflows to the Actions schema, which Workflow subsets
const workflow = parse(
  readFileSync(join(workspaceRoot, WORKFLOW), 'utf8'),
) as Workflow;

describe('e2e matrix', () => {
  it(`${WORKFLOW} lists the default suites`, () => {
    const matrix = workflow.jobs?.e2e?.strategy?.matrix?.suite;

    assert.ok(matrix, 'jobs.e2e.strategy.matrix.suite is missing');
    assert.deepEqual([...matrix].sort(), defaultSuites);
  });
});
