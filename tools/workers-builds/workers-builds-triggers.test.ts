import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import type { Json } from '@tools/bootstrap/types.ts';
import * as v from 'valibot';

import {
  DEFAULT_SITE,
  type Site,
  buildSteps,
  resolveSite,
} from './cloudflare-build.ts';
import {
  CF_DEPLOY_MODES,
  DEPLOY_MODES,
  type DeployMode,
  deployCommands,
} from './cloudflare-deploy.ts';
import {
  CF_CONFIG,
  type Drift,
  PREVIEWS_BASE_CONFIG,
  type Trigger,
  classifyTrigger,
  desiredStateFromConfig,
  desiredWorkersFromConfig,
  diffTriggers,
  parseJsonc,
  previewsBaseTrigger,
  selectWorkers,
  workerNameFromCfConfig,
  workerNameFromConfig,
} from './workers-builds-triggers.core.ts';
import { workerName } from './workers-builds-triggers.ts';

const siteAt = (root: string, key: string): Site => {
  const resolved = resolveSite(root, key);

  if (!resolved.ok) assert.fail(resolved.error);

  return resolved.site;
};

// Expected values live in the fixture so it doubles as documentation of the
// API trigger shape. readFile keeps the root tsconfig free of JSON-import
// compiler options.
type Fixtures = {
  triggers: { production: Trigger; preview: Trigger };
  driftScenario: { driftedDeployCommand: string; expectedDrifts: Drift[] };
};

// SAFETY: the checked-in fixture file is authored in the Fixtures shape
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

// A dashboard command is `<script> [mode] [site]`; a bare one names the docs site.
const parseCommand = (command: string | undefined) => {
  const [path = '', ...args] = (command ?? '').split(' ');

  return { path, args };
};

const BUILD_SCRIPT = './tools/workers-builds/cloudflare-build.sh';

const DEPLOY_SCRIPT = './tools/workers-builds/cloudflare-deploy.ts';

const workerNameAt = async (config: string): Promise<string> =>
  workerName(join(workspaceRoot, config));

describe('parseJsonc', () => {
  // Every entry's workerConfig has to name a real file with a real name: the
  // shell reads the worker name out of it rather than restating it in config.
  it('resolves every configured workerConfig to a worker name', async () => {
    for (const worker of workers) {
      assert.ok(await workerNameAt(worker.workerConfig));
    }

    assert.equal(desired.workerConfig, 'www/lit-ui-router.dev/wrangler.jsonc');
    assert.equal(await workerNameAt(desired.workerConfig), 'lit-ui-router');
    assert.equal(
      await workerNameAt(
        'www/release-diffs.lit-ui-router.dev/cloudflare.config.ts',
      ),
      'release-diffs',
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
    for (const worker of workers) {
      for (const kind of ['production', 'preview'] as const) {
        const { path, args } = parseCommand(worker[kind].build_command);
        assert.equal(path, BUILD_SCRIPT);
        assert.equal(
          worker[kind].environment_variables?.SKIP_DEPENDENCY_INSTALL,
          '1',
        );

        // the repo root, not cwd: turbo runs this from the package directory
        const [key = DEFAULT_SITE, ...extra] = args;
        assert.deepEqual(extra, [], `${worker.site} ${kind} build: extra args`);
        assert.equal(key, worker.site, `${worker.site} ${kind} builds ${key}`);

        const site = siteAt(workspaceRoot, key);
        const steps = buildSteps(workspaceRoot, '/nonexistent/bin', site);

        assert.ok(
          steps.some(
            ([command, stepArgs]) =>
              command === 'pnpm' &&
              stepArgs[0] === 'install' &&
              stepArgs.includes('--frozen-lockfile'),
          ),
          `no frozen pnpm install among the build steps: ${JSON.stringify(steps)}`,
        );
        assert.deepEqual(steps.at(-1), [
          'npx',
          ['turbo', `@www/${worker.site}#build`],
        ]);
      }
    }
  });

  // The docs site's dashboard commands predate the site argument and hold
  // still for every open branch, so they must keep naming it by default.
  it('keeps the docs site on the bare dashboard commands', () => {
    assert.equal(flagship.production.build_command, BUILD_SCRIPT);
    assert.equal(flagship.preview.build_command, BUILD_SCRIPT);
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
  // The script exports its commands, so the wrangler invocation is imported
  // rather than re-read out of the script's source.
  it('points every deploy command at the deploy script, mode and site', async () => {
    // The pinned path must name a real file: readFile rejects if it does not.
    await readFile(join(workspaceRoot, DEPLOY_SCRIPT), 'utf8');

    // A legacy preview trigger uploads versions; a Previews base config previews.
    const modesFor: Record<'production' | 'preview', readonly DeployMode[]> = {
      production: ['main'],
      preview: ['branch', 'preview'],
    };

    for (const worker of workers) {
      // the deploy derives the config from the site; the check reads it here
      const isCf = worker.workerConfig === `www/${worker.site}/${CF_CONFIG}`;

      if (!isCf) {
        assert.equal(worker.workerConfig, `www/${worker.site}/wrangler.jsonc`);
      }

      const config = ['--config', worker.workerConfig];

      for (const kind of ['production', 'preview'] as const) {
        const { path, args } = parseCommand(worker[kind].deploy_command);
        const [argMode, key = DEFAULT_SITE, ...extra] = args;
        const mode = modesFor[kind].find((allowed) => allowed === argMode);
        assert.equal(path, DEPLOY_SCRIPT);
        assert.ok(mode, `${worker.site} ${kind} names the wrong mode`);
        assert.deepEqual(extra, []);
        assert.equal(key, worker.site);

        const { cwd, migrations, deploy } = deployCommands(
          workspaceRoot,
          mode,
          siteAt(workspaceRoot, key),
        );

        // cf runs in the package, and evaluates the config with isPreview for a Preview
        if (isCf) {
          assert.equal(cwd, `www/${worker.site}`);
          assert.deepEqual(deploy, CF_DEPLOY_MODES[mode]);
          assert.deepEqual(migrations, []);
          continue;
        }

        // wrangler preview refuses a config without a previews block
        if (mode === 'preview') {
          const wrangler = parseJsonc(
            await readFile(join(workspaceRoot, worker.workerConfig), 'utf8'),
          );

          assert.ok(
            v.is(v.looseObject({ previews: v.looseObject({}) }), wrangler),
            `${worker.workerConfig} has no previews block`,
          );
        }

        assert.equal(cwd, '.');
        assert.deepEqual(deploy, [...DEPLOY_MODES[mode], ...config]);

        for (const migration of migrations) {
          assert.deepEqual(migration.slice(0, 4), [
            'wrangler',
            'd1',
            'migrations',
            'apply',
          ]);
          assert.deepEqual(migration.slice(-3), ['--remote', ...config]);
        }
      }
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

  it('requires the worker config path that names the worker', () => {
    assert.throws(
      () =>
        desiredStateFromConfig({
          productionBranch: 'main',
          production: {},
          preview: {},
        }),
      /workerConfig: Invalid key: Expected "workerConfig"/,
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
      workerConfig: 'www/lit-ui-router.dev/wrangler.jsonc',
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
      workerConfig: 'www/lit-ui-router.dev/wrangler.jsonc',
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

describe('selectWorkers', () => {
  const two = [
    { ...desired, site: 'lit-ui-router.dev' },
    { ...desired, site: 'atlas.lit-ui-router.dev' },
  ];

  it('returns every worker when nothing is selected', () => {
    assert.deepEqual(selectWorkers(two, []), { ok: true, workers: two });
  });

  it('keeps config order regardless of selection order', () => {
    assert.deepEqual(
      selectWorkers(two, ['atlas.lit-ui-router.dev', 'lit-ui-router.dev']),
      { ok: true, workers: two },
    );
    assert.deepEqual(selectWorkers(two, ['atlas.lit-ui-router.dev']), {
      ok: true,
      workers: [two[1]],
    });
  });

  // A typo must never select nothing: under --apply that reads as in sync.
  it('fails on an unknown site, naming the configured ones', () => {
    assert.deepEqual(selectWorkers(two, ['lit-ui-router.dev', 'atlas']), {
      ok: false,
      error:
        'unknown site(s): atlas — configured: lit-ui-router.dev, atlas.lit-ui-router.dev',
    });
  });
});

describe('workerNameFromConfig', () => {
  it('throws when name is missing', () => {
    assert.throws(() => workerNameFromConfig({}), /no "name" field/);
    assert.throws(() => workerNameFromConfig(null), /no "name" field/);
  });
});

describe('workerNameFromCfConfig', () => {
  it('unwraps objects, promises and functions at both levels', async () => {
    const worker = { name: 'w', compatibilityDate: '2026-07-01' };

    assert.equal(await workerNameFromCfConfig({ worker }), 'w');
    assert.equal(
      await workerNameFromCfConfig(Promise.resolve({ worker })),
      'w',
    );
    assert.equal(
      await workerNameFromCfConfig(({ isPreview }: { isPreview: boolean }) => ({
        worker: () => ({ ...worker, name: isPreview ? 'preview' : 'w' }),
      })),
      'w',
    );
  });

  it('throws when the worker or its name is missing', async () => {
    await assert.rejects(workerNameFromCfConfig({}), /has no worker "name"/);
    await assert.rejects(
      workerNameFromCfConfig({ worker: {} }),
      /has no worker "name"/,
    );
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

  // A Worker switched to Workers Previews has no preview trigger: its Previews
  // base config takes the preview spec, and its drift PATCHes the Worker.
  it('diffs a Previews base config as the preview trigger', () => {
    // the base config carries a trigger's settings but no uuid or branches
    const base = {
      build_command: triggers.preview.build_command,
      deploy_command: triggers.preview.deploy_command,
      environment_variables: triggers.preview.environment_variables,
    };

    const previews = previewsBaseTrigger(base);

    assert.equal(classifyTrigger(previews, 'main'), 'preview');
    assert.equal(
      diffTriggers([triggers.production, previews], desired).report.ok,
      true,
    );

    const { report, drifts } = diffTriggers(
      [
        triggers.production,
        previewsBaseTrigger({
          ...base,
          deploy_command: driftScenario.driftedDeployCommand,
        }),
      ],
      desired,
    );

    assert.equal(report.ok, false);
    assert.deepEqual(drifts, [
      {
        trigger_uuid: PREVIEWS_BASE_CONFIG,
        kind: 'preview',
        patch: { deploy_command: desired.preview.deploy_command },
        environmentPatch: {},
      },
    ]);
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

  // Runs the script with a stub `npx` first on PATH, so each wrangler or cf
  // command and the dir it ran in are recorded, one per line, rather than
  // performed. With FAIL_D1 set the stub fails every `wrangler d1` call.
  const runDeploy = (args: string[], env: NodeJS.ProcessEnv = {}) => {
    const dir = mkdtempSync(join(tmpdir(), 'cloudflare-deploy-'));
    const record = join(dir, 'invoked');
    const cwds = join(dir, 'cwds');

    try {
      writeFileSync(
        join(dir, 'npx'),
        `#!/bin/sh\nprintf '%s\\n' "$*" >> '${record}'\n` +
          `pwd -P >> '${cwds}'\n` +
          `[ -n "$FAIL_D1" ] && [ "$1 $2" = 'wrangler d1' ] && exit 1\nexit 0\n`,
        { mode: 0o755 },
      );

      const result = spawnSync(process.execPath, [script, ...args], {
        encoding: 'utf8',
        // Only the stub on PATH: everything else the script runs is absolute.
        env: { ...process.env, ...env, PATH: dir },
      });

      return {
        status: result.status,
        stderr: result.stderr,
        invoked: existsSync(record)
          ? readFileSync(record, 'utf8').trimEnd().split('\n')
          : undefined,
        cwds: existsSync(cwds)
          ? readFileSync(cwds, 'utf8').trimEnd().split('\n')
          : undefined,
      };
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  };

  it("runs each configured site's commands for each mode, deploy last", () => {
    for (const worker of workers) {
      const site = siteAt(workspaceRoot, worker.site);

      for (const mode of ['main', 'branch', 'preview'] as const) {
        const { cwd, migrations, deploy } = deployCommands(
          workspaceRoot,
          mode,
          site,
        );

        const { status, invoked, cwds } = runDeploy([mode, worker.site]);
        assert.equal(status, 0, `${mode} ${worker.site} exited non-zero`);
        const commands = [...migrations, deploy];
        assert.deepEqual(
          invoked,
          commands.map((command) => command.join(' ')),
        );
        assert.deepEqual(
          cwds,
          commands.map(() => realpathSync(join(workspaceRoot, cwd))),
        );
      }
    }
  });

  // The deploy must never run ahead of a schema it expects.
  it('stops before the deploy when a migration fails', () => {
    const migrated = workers.filter(
      (worker) =>
        deployCommands(
          workspaceRoot,
          'main',
          siteAt(workspaceRoot, worker.site),
        ).migrations.length > 0,
    );

    assert.ok(migrated.length > 0, 'no configured site migrates a database');

    for (const worker of migrated) {
      const { status, invoked } = runDeploy(['main', worker.site], {
        FAIL_D1: '1',
      });

      assert.notEqual(status, 0);
      assert.equal(
        invoked?.length,
        1,
        `${worker.site}: ${invoked?.join('; ')}`,
      );
      assert.match(invoked?.[0] ?? '', /^wrangler d1 migrations apply /);
    }
  });

  it('deploys the docs site when no site is named', () => {
    const { status, invoked } = runDeploy(['main']);
    assert.equal(status, 0);
    assert.equal(
      invoked?.at(-1),
      'wrangler deploy --config www/lit-ui-router.dev/wrangler.jsonc',
    );
  });

  it('prints usage and exits 2 with no mode, without invoking wrangler', () => {
    const { status, stderr, invoked } = runDeploy([]);
    assert.equal(status, 2);
    assert.match(
      stderr,
      /usage: cloudflare-deploy\.ts <main\|branch\|preview> \[site\]/,
    );
    assert.equal(invoked, undefined);
  });

  // A stray argument must not silently deploy some other site.
  it('prints usage and exits 2 on an unknown site or an extra argument', () => {
    for (const args of [
      ['main', 'unexpected'],
      ['main', 'nowhere.lit-ui-router.dev'],
      ['main', '../lit-ui-router.dev'],
      ['branch', DEFAULT_SITE, 'unexpected'],
    ]) {
      const { status, stderr, invoked } = runDeploy(args);
      assert.equal(status, 2, args.join(' '));
      assert.match(
        stderr,
        /usage: cloudflare-deploy\.ts <main\|branch\|preview>/,
      );
      assert.equal(invoked, undefined);
    }
  });

  describe('deployCommands', () => {
    const fixtureRoot = (wrangler: Json): string => {
      const root = mkdtempSync(join(tmpdir(), 'cloudflare-deploy-site-'));
      const dir = join(root, 'www', 'example.test');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ name: '@www/example.test' }),
      );
      writeFileSync(join(dir, 'wrangler.jsonc'), JSON.stringify(wrangler));

      return root;
    };

    const config = ['--config', 'www/example.test/wrangler.jsonc'];

    it('migrates each D1 database with a migrations_dir before deploying', () => {
      const root = fixtureRoot({
        name: 'example',
        d1_databases: [
          { binding: 'A', database_name: 'a', migrations_dir: 'migrations' },
          { binding: 'B', database_name: 'b' },
          { binding: 'C', database_name: 'c', migrations_dir: 'c-migrations' },
        ],
      });

      try {
        const site = siteAt(root, 'example.test');
        assert.deepEqual(deployCommands(root, 'main', site), {
          cwd: '.',
          migrations: [
            [
              'wrangler',
              'd1',
              'migrations',
              'apply',
              'a',
              '--remote',
              ...config,
            ],
            [
              'wrangler',
              'd1',
              'migrations',
              'apply',
              'c',
              '--remote',
              ...config,
            ],
          ],
          deploy: ['wrangler', 'deploy', ...config],
        });
        // a branch upload or a Preview must never touch a remote database
        assert.deepEqual(deployCommands(root, 'branch', site), {
          cwd: '.',
          migrations: [],
          deploy: ['wrangler', 'versions', 'upload', ...config],
        });
        assert.deepEqual(deployCommands(root, 'preview', site), {
          cwd: '.',
          migrations: [],
          deploy: ['wrangler', 'preview', ...config],
        });
      } finally {
        rmSync(root, { force: true, recursive: true });
      }
    });

    // cf reads only the cloudflare.config.ts in its cwd, and has no wrangler.jsonc migrations_dir to honour.
    it('runs cf in the package when it has a cloudflare.config.ts', () => {
      const root = fixtureRoot({
        name: 'example',
        d1_databases: [
          { binding: 'A', database_name: 'a', migrations_dir: 'migrations' },
        ],
      });

      writeFileSync(join(root, 'www', 'example.test', CF_CONFIG), '');

      try {
        const site = siteAt(root, 'example.test');

        for (const mode of ['main', 'branch', 'preview'] as const) {
          assert.deepEqual(deployCommands(root, mode, site), {
            cwd: 'www/example.test',
            migrations: [],
            deploy: CF_DEPLOY_MODES[mode],
          });
        }

        assert.deepEqual(deployCommands(root, 'preview', site).deploy, [
          'cf',
          'previews',
          'deploy',
        ]);
      } finally {
        rmSync(root, { force: true, recursive: true });
      }
    });

    it('rejects a migrated database with no database_name', () => {
      const root = fixtureRoot({
        name: 'example',
        d1_databases: [{ binding: 'A', migrations_dir: 'migrations' }],
      });

      try {
        assert.throws(
          () => deployCommands(root, 'main', siteAt(root, 'example.test')),
          /d1_databases\.0\.database_name/,
        );
      } finally {
        rmSync(root, { force: true, recursive: true });
      }
    });
  });
});
