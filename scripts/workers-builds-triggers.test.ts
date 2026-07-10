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

describe('parseJsonc', () => {
  it('parses the repo wrangler.jsonc (comments + trailing commas)', async () => {
    const raw = await readFile(
      join(import.meta.dirname, '..', 'wrangler.jsonc'),
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
    assert.equal(desired.production.deploy_command, 'pnpm wrangler deploy');
    assert.equal(
      desired.preview.deploy_command,
      'pnpm wrangler versions upload',
    );
  });

  it('rejects non-objects and unknown top-level keys', () => {
    assert.throws(() => desiredStateFromConfig([]), /must be an object/);
    assert.throws(
      () => desiredStateFromConfig({ productionBranch: 'main', prod: {} }),
      /unknown key "prod"/,
    );
  });

  it('requires a non-empty productionBranch and both trigger specs', () => {
    assert.throws(
      () => desiredStateFromConfig({ production: {}, preview: {} }),
      /"productionBranch" must be a non-empty string/,
    );
    assert.throws(
      () => desiredStateFromConfig({ productionBranch: 'main' }),
      /config "production" must be an object/,
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
      /production\.deploy_comand is not a pinnable field/,
    );
    assert.throws(
      () =>
        desiredStateFromConfig({ ...base, production: { build_command: '' } }),
      /production\.build_command must be a non-empty string/,
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
    assert.match(report.text, /wanted: pnpm wrangler versions upload/);
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

  it('reports a missing trigger kind as unfixable drift', () => {
    const { report, drifts } = diffTriggers([triggers.production], desired);
    assert.equal(report.ok, false);
    assert.deepEqual(drifts, []);
    assert.match(report.text, /no preview trigger found/);
  });
});
