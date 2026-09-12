import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { buildSteps } from './cloudflare-build.ts';
import { DEPLOY_MODES } from './cloudflare-deploy.ts';
import {
  type Drift,
  type Trigger,
  classifyTrigger,
  desiredStateFromConfig,
  desiredWorkersFromConfig,
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
// prove it parses and validates. The flagship is the entry they diff against.
const workers = desiredWorkersFromConfig(
  parseJsonc(
    await readFile(
      join(import.meta.dirname, 'workers-builds-triggers.config.jsonc'),
      'utf8',
    ),
  ),
);
const flagship = workers.find((worker) => worker.site === 'lit-ui-router.dev');
assert.ok(flagship, 'no lit-ui-router.dev entry in the trigger config');
const desired = flagship;

const withEnvironment = (
  trigger: Trigger,
  environment_variables: NonNullable<Trigger['environment_variables']>,
): Trigger => ({ ...trigger, environment_variables });

// Every declared preview key as the API would return it in sync. Derived from
// the config rather than spelled out, so declaring another variable doesn't
// turn each single-key scenario below into unrelated drift.
const declaredPreviewLive: NonNullable<Trigger['environment_variables']> =
  Object.fromEntries(
    Object.entries(desired.preview.environment_variables ?? {}).map(
      ([key, value]) => [key, { value, is_secret: false }],
    ),
  );

describe('parseJsonc', () => {
  // Every entry's wranglerConfig has to name a real file with a real name: the
  // shell reads the worker name out of it rather than restating it in config.
  it('resolves every configured wranglerConfig to a worker name', async () => {
    for (const worker of workers) {
      const raw = await readFile(
        join(import.meta.dirname, '..', '..', worker.wranglerConfig),
        'utf8',
      );
      assert.ok(workerNameFromConfig(parseJsonc(raw)));
    }
    assert.equal(
      desired.wranglerConfig,
      'www/lit-ui-router.dev/wrangler.jsonc',
    );
    assert.equal(
      workerNameFromConfig(
        parseJsonc(
          await readFile(
            join(import.meta.dirname, '..', '..', desired.wranglerConfig),
            'utf8',
          ),
        ),
      ),
      'lit-ui-router',
    );
  });

  it('throws a clear error on malformed input', () => {
    assert.throws(() => parseJsonc('{"a": }'), /invalid JSONC at offset/);
  });
});

describe('desiredStateFromConfig', () => {
  it('accepts the real config (loaded above) with the dashboard values', () => {
    assert.equal(desired.productionBranch, 'main');
    assert.equal(
      desired.production.deploy_command,
      './tools/workers-builds/cloudflare-deploy.ts main',
    );
    assert.equal(
      desired.preview.deploy_command,
      './tools/workers-builds/cloudflare-deploy.ts branch',
    );
  });

  // SKIP_DEPENDENCY_INSTALL=1 is only safe while the build command installs.
  // The command is a repo script, so follow the path — otherwise the
  // indirection would hide a build command that stopped installing, which is
  // the one failure this pairing exists to catch. The script exports its steps
  // (like the deploy script exports its mode map), so the install is read
  // rather than grepped out of the source.
  it('pairs the skipped install with an install in every build command', () => {
    // the repo root, not cwd: turbo runs this from the package directory
    const steps = buildSteps(
      join(import.meta.dirname, '..', '..'),
      '/nonexistent/bin',
    );
    assert.ok(
      steps.some(
        ([command, args]) =>
          command === 'pnpm' &&
          args[0] === 'install' &&
          args.includes('--frozen-lockfile'),
      ),
      `no frozen pnpm install among the build steps: ${JSON.stringify(steps)}`,
    );

    for (const kind of ['production', 'preview'] as const) {
      assert.equal(
        desired[kind].environment_variables?.SKIP_DEPENDENCY_INSTALL,
        '1',
      );
      assert.equal(
        desired[kind].build_command,
        './tools/workers-builds/cloudflare-build.sh',
      );
    }
  });

  // The .sh is a shim over the .ts, kept only because `build_command` is one
  // dashboard value for every branch at once (see www/DEPLOY.md). Nothing else
  // ties the pinned path to the steps above, so assert the hop exists: a shim
  // that stopped exec-ing the script would leave the test above passing while
  // every build ran nothing.
  it('execs the TypeScript build script from the pinned shell path', async () => {
    const shim = await readFile(
      join(import.meta.dirname, 'cloudflare-build.sh'),
      'utf8',
    );
    assert.match(
      shim,
      /^exec \.\/tools\/workers-builds\/cloudflare-build\.ts\b/m,
    );
  });

  // The deploy command is a repo script too, for the same reason: a branch that
  // moves wrangler.jsonc changes the script, not the dashboard. So follow the
  // path here as well — a pinned path that names no file would break every
  // deploy, and the indirection is what makes that invisible from the config.
  // The script exports its mode map, so the wrangler invocation is imported
  // rather than re-read out of the script's source. This branch is that case:
  // the site config moved into www/lit-ui-router.dev/, so both modes name it
  // with --config and the dashboard value is unchanged.
  it('points both deploy commands at the deploy script and the right mode', async () => {
    const config = [
      '--config',
      'www/lit-ui-router.dev/wrangler.jsonc',
    ] as const;
    for (const [kind, mode, wrangler] of [
      ['production', 'main', ['wrangler', 'deploy', ...config]],
      ['preview', 'branch', ['wrangler', 'versions', 'upload', ...config]],
    ] as const) {
      const command = desired[kind].deploy_command ?? '';
      const [path = '', arg] = command.split(' ');
      assert.equal(path, './tools/workers-builds/cloudflare-deploy.ts');
      assert.equal(arg, mode, `${kind} deploy command names the wrong mode`);
      // The pinned path must name a real file: readFile rejects if it does not.
      await readFile(join(import.meta.dirname, '..', '..', path), 'utf8');
      assert.deepEqual(DEPLOY_MODES[mode], wrangler);
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
    assert.throws(
      () => desiredWorkersFromConfig({ sites: {} }),
      /sites: Invalid key/,
    );
  });

  it('requires the wrangler config path that names the worker', () => {
    assert.throws(
      () =>
        desiredStateFromConfig({
          productionBranch: 'main',
          production: {},
          preview: {},
        }),
      /wranglerConfig: Invalid key: Expected "wranglerConfig"/,
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
    const base = {
      wranglerConfig: 'www/lit-ui-router.dev/wrangler.jsonc',
      productionBranch: 'main',
      preview: {},
    };
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
    const base = {
      wranglerConfig: 'www/lit-ui-router.dev/wrangler.jsonc',
      productionBranch: 'main',
      preview: {},
    };
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
      ...declaredPreviewLive,
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
    // Every declared key is absent, so every one is patched.
    assert.deepEqual(drifts[0]?.environmentPatch, declaredPreviewLive);
    assert.match(report.text, /SKIP_DEPENDENCY_INSTALL {12}\(absent\)/);
  });

  it('reports undeclared environment variables as unmanaged, never drift', () => {
    const extra = withEnvironment(triggers.preview, {
      ...declaredPreviewLive,
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
    assert.deepEqual(
      Object.keys(drifts[0]?.environmentPatch ?? {}),
      Object.keys(declaredPreviewLive),
    );
  });

  it('refuses to overwrite a declared key that is live-secret', () => {
    const conflicted = withEnvironment(triggers.preview, {
      ...declaredPreviewLive,
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

  // Watch paths are what let a second site share the repo: each worker builds
  // only on pushes that touch it. The flagship pins neither, so these drive the
  // diff with a pinned copy of it.
  it('never drifts on unpinned watch paths, and stays silent when unset', () => {
    const { report, drifts } = diffTriggers(
      [triggers.production, triggers.preview],
      desired,
    );
    assert.equal(report.ok, true);
    assert.deepEqual(drifts, []);
    assert.doesNotMatch(report.text, /path_includes/);
  });

  it('shows a live watch path the config does not pin', () => {
    const watched = {
      ...triggers.production,
      path_includes: ['www/lit-ui-router.dev/*'],
    };
    const { report, drifts } = diffTriggers(
      [watched, triggers.preview],
      desired,
    );
    assert.equal(report.ok, true);
    assert.deepEqual(drifts, []);
    assert.match(
      report.text,
      /path_includes {6}\["www\/lit-ui-router.dev\/\*"\] \(not pinned\)/,
    );
  });

  it('patches a pinned watch path whole-list', () => {
    const pinned = {
      ...desired,
      preview: {
        ...desired.preview,
        path_includes: ['www/atlas.lit-ui-router.dev/*'],
      },
    };
    const { report, drifts } = diffTriggers(
      [triggers.production, triggers.preview],
      pinned,
    );
    assert.equal(report.ok, false);
    assert.deepEqual(drifts, [
      {
        trigger_uuid: 'preview-uuid',
        kind: 'preview',
        patch: { path_includes: ['www/atlas.lit-ui-router.dev/*'] },
        environmentPatch: {},
      },
    ]);
    assert.match(report.text, /wanted: \["www\/atlas.lit-ui-router.dev\/\*"\]/);
  });

  it('reports a missing trigger kind as unfixable drift', () => {
    const { report, drifts } = diffTriggers([triggers.production], desired);
    assert.equal(report.ok, false);
    assert.deepEqual(drifts, []);
    assert.match(report.text, /no preview trigger found/);
  });
});

describe('cloudflare-deploy', () => {
  const script = join(import.meta.dirname, 'cloudflare-deploy.ts');

  // Runs the script with a stub `npx` first on PATH, so the wrangler command
  // is recorded rather than performed.
  const runDeploy = (...args: string[]) => {
    const dir = mkdtempSync(join(tmpdir(), 'cloudflare-deploy-'));
    const record = join(dir, 'invoked');
    try {
      writeFileSync(
        join(dir, 'npx'),
        `#!/bin/sh\nprintf '%s' "$*" > '${record}'\n`,
        { mode: 0o755 },
      );
      const result = spawnSync(process.execPath, [script, ...args], {
        encoding: 'utf8',
        // Only the stub on PATH: everything else the script runs is absolute.
        env: { ...process.env, PATH: dir },
      });
      return {
        status: result.status,
        stderr: result.stderr,
        invoked: existsSync(record) ? readFileSync(record, 'utf8') : undefined,
      };
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  };

  it("runs the mode's wrangler command", () => {
    for (const [mode, wrangler] of Object.entries(DEPLOY_MODES)) {
      const { status, invoked } = runDeploy(mode);
      assert.equal(status, 0, `${mode} exited non-zero`);
      assert.equal(invoked, wrangler.join(' '));
    }
  });

  it('prints usage and exits 2 with no mode, without invoking wrangler', () => {
    const { status, stderr, invoked } = runDeploy();
    assert.equal(status, 2);
    assert.match(stderr, /usage: cloudflare-deploy\.ts <main\|branch>/);
    assert.equal(invoked, undefined);
  });

  // A stray extra argument must not silently deploy the mode in front of it.
  it('prints usage and exits 2 on an extra argument', () => {
    const { status, stderr, invoked } = runDeploy('main', 'unexpected');
    assert.equal(status, 2);
    assert.match(stderr, /usage: cloudflare-deploy\.ts <main\|branch>/);
    assert.equal(invoked, undefined);
  });
});
