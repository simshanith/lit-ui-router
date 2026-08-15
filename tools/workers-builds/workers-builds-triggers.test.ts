import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  type Drift,
  type Trigger,
  classifyTrigger,
  desiredStateFromConfig,
  diffTriggers,
  parseJsonc,
  workerNameFromConfig,
} from './workers-builds-triggers.core.ts';

// Expected values live in the fixture so it doubles as documentation of the
// API trigger shape. readFile keeps the root tsconfig free of JSON-import
// compiler options.
type Fixtures = {
  triggers: { production: Trigger; preview: Trigger };
  driftScenario: { driftedDeployCommand: string; expectedDrifts: Drift[] };
};
const { triggers, driftScenario } = JSON.parse(
  await readFile(
    join(import.meta.dirname, 'workers-builds-triggers.fixtures.json'),
    'utf8',
  ),
) as Fixtures;

// The diff tests run against the real source-of-truth config, so they also
// prove it parses and validates.
const desired = desiredStateFromConfig(
  parseJsonc(
    await readFile(
      join(import.meta.dirname, 'workers-builds-triggers.config.jsonc'),
      'utf8',
    ),
  ),
);

const withEnvironment = (
  trigger: Trigger,
  environment_variables: NonNullable<Trigger['environment_variables']>,
): Trigger => ({ ...trigger, environment_variables });

describe('parseJsonc', () => {
  it('parses the repo wrangler.jsonc (comments + trailing commas)', async () => {
    const raw = await readFile(
      join(import.meta.dirname, '..', '..', 'wrangler.jsonc'),
      'utf8',
    );
    assert.equal(workerNameFromConfig(parseJsonc(raw)), 'lit-ui-router');
  });

  it('throws a clear error on malformed input', () => {
    assert.throws(() => parseJsonc('{"a": }'), /invalid JSONC at offset/);
  });
});

describe('desiredStateFromConfig', () => {
  it('accepts the real config (loaded above) with the dashboard values', () => {
    assert.equal(desired.productionBranch, 'main');
    assert.equal(desired.production.deploy_command, 'npx wrangler deploy');
    assert.equal(
      desired.preview.deploy_command,
      'npx wrangler versions upload',
    );
  });

  // SKIP_DEPENDENCY_INSTALL=1 is only safe while the build command installs.
  it('pairs the skipped install with an install in every build command', () => {
    for (const kind of ['production', 'preview'] as const) {
      assert.equal(
        desired[kind].environment_variables?.SKIP_DEPENDENCY_INSTALL,
        '1',
      );
      assert.match(
        desired[kind].build_command ?? '',
        /^npx pnpm@\d+\.\d+\.\d+ install --frozen-lockfile &&/,
      );
    }
  });

  it('rejects non-objects and unknown top-level keys', () => {
    assert.throws(() => desiredStateFromConfig(null), /Expected Object/);
    assert.throws(
      () => desiredStateFromConfig([]),
      /productionBranch: Invalid key/,
    );
    assert.throws(
      () => desiredStateFromConfig({ productionBranch: 'main', prod: {} }),
      /prod: Invalid key/,
    );
  });

  it('requires a non-empty productionBranch and both trigger specs', () => {
    assert.throws(
      () => desiredStateFromConfig({ production: {}, preview: {} }),
      /productionBranch: Invalid key: Expected "productionBranch"/,
    );
    assert.throws(
      () => desiredStateFromConfig({ productionBranch: 'main' }),
      /production: Invalid key: Expected "production"/,
    );
  });

  it('rejects typoed or mistyped pinnable fields', () => {
    const base = { productionBranch: 'main', preview: {} };
    assert.throws(
      () =>
        desiredStateFromConfig({
          ...base,
          production: { deploy_comand: 'pnpm wrangler deploy' },
        }),
      /production\.deploy_comand: Invalid key/,
    );
    assert.throws(
      () =>
        desiredStateFromConfig({ ...base, production: { build_command: '' } }),
      /production\.build_command: Invalid length/,
    );
  });

  it('rejects invalid environment variable keys and values', () => {
    const base = { productionBranch: 'main', preview: {} };
    assert.throws(
      () =>
        desiredStateFromConfig({
          ...base,
          production: { environment_variables: { 'not-a-var': '1' } },
        }),
      /production\.environment_variables\.not-a-var: Invalid format/,
    );
    assert.throws(
      () =>
        desiredStateFromConfig({
          ...base,
          production: { environment_variables: { OK: 1 } },
        }),
      /production\.environment_variables\.OK: Invalid type/,
    );
  });
});

describe('workerNameFromConfig', () => {
  it('throws when name is missing', () => {
    assert.throws(() => workerNameFromConfig({}), /no "name" field/);
    assert.throws(() => workerNameFromConfig(null), /no "name" field/);
  });
});

describe('classifyTrigger', () => {
  it('marks the main-building trigger production', () => {
    assert.equal(classifyTrigger(triggers.production, 'main'), 'production');
  });

  it('marks wildcard-with-main-excluded triggers preview', () => {
    assert.equal(classifyTrigger(triggers.preview, 'main'), 'preview');
  });

  it('treats a trigger with no branch config as preview', () => {
    assert.equal(classifyTrigger({ trigger_uuid: 'x' }, 'main'), 'preview');
  });
});

describe('diffTriggers', () => {
  it('passes when both triggers match', () => {
    const { report, drifts } = diffTriggers(
      [triggers.production, triggers.preview],
      desired,
    );
    assert.equal(report.ok, true);
    assert.deepEqual(drifts, []);
    assert.match(report.text, /✓ Workers Builds triggers match/);
  });

  it('emits a PATCH body containing only the drifted pinned fields', () => {
    const drifted = {
      ...triggers.preview,
      deploy_command: driftScenario.driftedDeployCommand,
    };
    const { report, drifts } = diffTriggers(
      [triggers.production, drifted],
      desired,
    );
    assert.equal(report.ok, false);
    assert.deepEqual(drifts, driftScenario.expectedDrifts);
    assert.ok(
      report.text.includes(`wanted: ${desired.preview.deploy_command}`),
    );
  });

  it('never drifts on unpinned fields like root_directory', () => {
    const withRoot = { ...triggers.production, root_directory: '/docs' };
    const { report, drifts } = diffTriggers(
      [withRoot, triggers.preview],
      desired,
    );
    assert.equal(report.ok, true);
    assert.deepEqual(drifts, []);
    assert.match(report.text, /root_directory {5}\/docs \(not pinned\)/);
  });

  it('drifts on a declared environment variable with the wrong value', () => {
    const drifted = withEnvironment(triggers.preview, {
      SKIP_DEPENDENCY_INSTALL: { value: '0', is_secret: false },
    });
    const { report, drifts } = diffTriggers(
      [triggers.production, drifted],
      desired,
    );
    assert.equal(report.ok, false);
    assert.deepEqual(drifts, [
      {
        trigger_uuid: 'preview-uuid',
        kind: 'preview',
        patch: {},
        environmentPatch: {
          SKIP_DEPENDENCY_INSTALL: { value: '1', is_secret: false },
        },
      },
    ]);
    assert.match(report.text, /wanted: 1/);
  });

  it('drifts on a declared environment variable missing from the trigger', () => {
    const drifted = withEnvironment(triggers.preview, {});
    const { report, drifts } = diffTriggers(
      [triggers.production, drifted],
      desired,
    );
    assert.equal(report.ok, false);
    assert.deepEqual(drifts[0]?.environmentPatch, {
      SKIP_DEPENDENCY_INSTALL: { value: '1', is_secret: false },
    });
    assert.match(report.text, /SKIP_DEPENDENCY_INSTALL {12}\(absent\)/);
  });

  it('reports undeclared environment variables as unmanaged, never drift', () => {
    const extra = withEnvironment(triggers.preview, {
      SKIP_DEPENDENCY_INSTALL: { value: '1', is_secret: false },
      SOMETHING_ELSE: { value: 'dashboard-only', is_secret: false },
      TURBO_TOKEN: { is_secret: true },
    });
    const { report, drifts } = diffTriggers(
      [triggers.production, extra],
      desired,
    );
    assert.equal(report.ok, true);
    assert.deepEqual(drifts, []);
    assert.match(report.text, /SOMETHING_ELSE +\(unmanaged\)/);
    assert.match(report.text, /TURBO_TOKEN +\(secret\) \(unmanaged\)/);
    // Values of unmanaged variables are never echoed.
    assert.doesNotMatch(report.text, /dashboard-only/);
  });

  it('never patches unmanaged keys alongside a drifted declared key', () => {
    const drifted = withEnvironment(triggers.preview, {
      SOMETHING_ELSE: { value: 'dashboard-only', is_secret: false },
      TURBO_TOKEN: { is_secret: true },
    });
    const { drifts } = diffTriggers([triggers.production, drifted], desired);
    assert.deepEqual(Object.keys(drifts[0]?.environmentPatch ?? {}), [
      'SKIP_DEPENDENCY_INSTALL',
    ]);
  });

  it('refuses to overwrite a declared key that is live-secret', () => {
    const conflicted = withEnvironment(triggers.preview, {
      SKIP_DEPENDENCY_INSTALL: { is_secret: true },
    });
    const { report, drifts } = diffTriggers(
      [triggers.production, conflicted],
      desired,
    );
    assert.equal(report.ok, false);
    assert.deepEqual(drifts, []);
    assert.match(report.text, /refusing to overwrite/);
    assert.match(report.text, /✗ 1 trigger\(s\) drifted/);
  });

  it('reports a missing trigger kind as unfixable drift', () => {
    const { report, drifts } = diffTriggers([triggers.production], desired);
    assert.equal(report.ok, false);
    assert.deepEqual(drifts, []);
    assert.match(report.text, /no preview trigger found/);
  });
});
