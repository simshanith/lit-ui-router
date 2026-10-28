// Every turbo-task-logs upload lists one path per pnpm workspace glob. A `**`
// walk would traverse node_modules, so the list is hand-kept, and a workspace
// glob added without it leaves that package's task logs out of every run.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { trackedFiles } from './cli-query.ts';

const load = (file: string): string =>
  readFileSync(join(workspaceRoot, file), 'utf8');

/** As much of pnpm-workspace.yaml as this check reads. */
type WorkspaceManifest = { packages?: string[] };

/** As much of a workflow as this check reads. */
type Workflow = {
  jobs?: Record<
    string,
    { steps?: { uses?: string; with?: { name?: string; path?: string } }[] }
  >;
};

// SAFETY: pnpm rejects a workspace manifest whose packages is not a string list
const workspaceGlobs =
  (parse(load('pnpm-workspace.yaml')) as WorkspaceManifest).packages ?? [];

// Root `//#` tasks log to the root .turbo, beside turbo's own logs.
const expected = [
  '.turbo/turbo-*.log',
  '.turbo/logs/*.json',
  ...workspaceGlobs.map((glob) => `${glob}/.turbo/turbo-*.log`),
].sort();

const workflows = trackedFiles(
  '.github/workflows/*.yml',
  '.github/workflows/*.yaml',
);

// SAFETY: actionlint holds workflows to the Actions schema, which Workflow subsets
const uploads = workflows.flatMap((workflow) =>
  Object.entries((parse(load(workflow)) as Workflow).jobs ?? {}).flatMap(
    ([job, { steps = [] }]) =>
      steps
        .filter(
          (step) =>
            step.uses?.startsWith('actions/upload-artifact@') === true &&
            step.with?.name?.startsWith('turbo-task-logs') === true,
        )
        .map((step) => ({
          where: `${workflow}#${job} ${step.with?.name}`,
          path: step.with?.path,
        })),
  ),
);

describe('turbo task log uploads', () => {
  it('finds the workspace globs and the uploads', () => {
    assert.notEqual(workspaceGlobs.length, 0, 'no workspace globs found');
    assert.notEqual(uploads.length, 0, 'no turbo-task-logs uploads found');
  });

  it('uploads one path per workspace glob, plus the root logs', () => {
    for (const { where, path } of uploads) {
      const paths = (path ?? '').split('\n').filter(Boolean).sort();
      assert.deepEqual(paths, expected, where);
    }
  });
});
