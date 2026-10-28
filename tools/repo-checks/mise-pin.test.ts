// The release workflows pin one mise release; daily CI takes each new release
// through `auto_update` and canaries it on main before the release pin moves.
// The pin has no other home (the action reads no version file), so the
// workflows themselves are the only copies to hold together.
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

// They run with `cache: false` on the publish path, so they install fresh.
const RELEASE_WORKFLOWS = new Set(
  ['bump-version', 'dependency-audit', 'publish-gh', 'publish-npm'].map(
    (name) => `.github/workflows/${name}.yml`,
  ),
);

/** A step's `with:` value as YAML parses it. */
type StepInput = string | number | boolean | null;

/** As much of a workflow as this check reads. */
type Workflow = {
  jobs?: Record<
    string,
    {
      steps?: {
        uses?: string;
        with?: Record<string, StepInput>;
      }[];
    }
  >;
};

/** A YAML number (`2026.10`) parses to its own shape; only a string is a release. */
const isReleaseText = (version: StepInput | undefined): version is string =>
  typeof version === 'string';

// GitHub reads both extensions, so a .yaml workflow must not slip past.
const workflows = trackedFiles(
  '.github/workflows/*.yml',
  '.github/workflows/*.yaml',
);

// SAFETY: actionlint holds workflows to the Actions schema, which Workflow subsets
const steps = workflows.flatMap((workflow) =>
  Object.entries((parse(load(workflow)) as Workflow).jobs ?? {}).flatMap(
    ([job, { steps = [] }]) =>
      steps
        .filter(({ uses }) => uses?.startsWith('jdx/mise-action@'))
        .map((step) => ({
          where: `${workflow}#${job}`,
          release: RELEASE_WORKFLOWS.has(workflow),
          version: step.with?.version,
          autoUpdate: step.with?.auto_update,
        })),
  ),
);

const releaseSteps = steps.filter(({ release }) => release);

const dailySteps = steps.filter(({ release }) => !release);

describe('mise version pins', () => {
  it('finds mise-action steps', () => {
    assert.notEqual(workflows.length, 0, 'no workflows found');
    assert.notEqual(releaseSteps.length, 0, 'no release mise-action steps');
    assert.notEqual(dailySteps.length, 0, 'no daily mise-action steps');
  });

  it('pins an explicit mise release on every release step', () => {
    for (const { where, version } of releaseSteps) {
      assert.ok(
        isReleaseText(version),
        `${where} pins no mise version: ${JSON.stringify(version)}`,
      );
      assert.match(version, MISE_RELEASE, `${where}: ${version}`);
    }
  });

  it('pins one release across the release workflows', () => {
    const versions = new Set(releaseSteps.map(({ version }) => version));
    assert.equal(
      versions.size,
      1,
      `mise pins diverge: ${JSON.stringify(releaseSteps)}`,
    );
  });

  it('auto-updates mise on every daily step', () => {
    for (const { where, version, autoUpdate } of dailySteps) {
      assert.equal(version, undefined, `${where} pins mise ${version}`);
      assert.equal(autoUpdate, true, `${where} sets no auto_update: true`);
    }
  });
});
