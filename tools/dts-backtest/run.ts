#!/usr/bin/env node
// Backtests the published packages' declaration output: typechecks the
// consumer fixtures (and, via skipLibCheck:false, the packages' dist/*.d.ts)
// under each TypeScript version a consumer might use — most importantly the
// oldest supported one — so the repo's own TypeScript can move ahead without
// raising the floor for consumers.
//
// A diagnostic fails the run only if it originates in a fixture file or in a
// dist/*.d.ts of one of the packages under test; diagnostics from third-party
// declarations (lit, mobx, @uirouter/core, lib.dom, …) are counted and
// reported but tolerated, matching what a consumer with skipLibCheck:true
// would experience while still fully checking OUR declarations.
//
// Legs through 6.x drive the classic `ts.createProgram` API. TypeScript 7
// dropped that API, so its leg drives the native compiler through
// `typescript/sync`.

import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFileSystemLayer } from 'typescript-7/fs';

// The classic (6.x-and-earlier) compiler API. Every API leg is a `typescript`
// aliased to a fixed version, all sharing this surface, so one namespace types
// them all. The native 7 leg (checkNative) uses `typescript/sync` instead.
import type * as TS from 'typescript-5.9';
import type { RequestFileSystem } from 'typescript-7/proto';
import type { Diagnostic as NativeDiagnostic } from 'typescript-7/sync';

type ClassicApi = typeof import('typescript-5.9');

type NativeSyncModule = typeof import('typescript-7/sync');

type NativeModule = typeof import('typescript-7');

const here = dirname(fileURLToPath(import.meta.url));

const require = createRequire(import.meta.url);

// devDependency aliases, oldest first; every leg is pinned so none tracks the
// repo's own catalog. 6.x is the newest TypeScript with the classic API.
const API_VERSIONS = ['typescript-5.0', 'typescript-5.9', 'typescript-6'];

const NATIVE_VERSION = 'typescript-7';

const distDir = (dir: string) =>
  resolve(here, '..', '..', 'packages', dir, 'dist') + sep;

// dist dirs whose .d.ts must check clean (pnpm symlinks resolve to these)
const PACKAGE_DIRS = [
  'lit-ui-router',
  'lit-ui-router-effect',
  'lit-ui-router-mobx',
  'lit-ui-router-signals',
  'lit-ui-router-ssr',
  'navigation-location-plugin',
  'ui-router-effect',
  'ui-router-mobx',
  'ui-router-registry',
  'ui-router-server',
  'ui-router-signals',
].map(distDir);

const BASE_CONFIG = 'tsconfig.fixture.json';

// An augmentation is program-wide, so the registered consumer, whose registry
// entry points fill the adapters' RouteTypes, is a program of its own.
const REGISTERED_DIRS = [
  'ui-router-effect',
  'ui-router-mobx',
  'ui-router-registry',
  'ui-router-signals',
].map(distDir);

// The routed consumers register states whose components read the registry.
const ROUTED_DIRS = ['lit-ui-router', 'ui-router-registry'].map(distDir);

const ROUTED_PROGRAMS = ['classes', 'templates', 'legacy'].flatMap((dir) => [
  `routed/${dir}/tsconfig.fixture.json`,
  `routed/${dir}/tsconfig.fixture.nodenext.json`,
]);

// Programs a leg older than their floor skips: void-typed templates stop the
// circularity only from TypeScript 5.5.
const MIN_VERSION = new Map([
  ['routed/templates/tsconfig.fixture.json', [5, 5]],
  ['routed/templates/tsconfig.fixture.nodenext.json', [5, 5]],
]);

// Each config is one consumer program, keyed to the dist dirs it must load.
const CONFIGS = new Map([
  [BASE_CONFIG, PACKAGE_DIRS],
  ['tsconfig.fixture.nodenext.json', PACKAGE_DIRS],
  ['registered/tsconfig.fixture.json', REGISTERED_DIRS],
  ['registered/tsconfig.fixture.nodenext.json', REGISTERED_DIRS],
  ...ROUTED_PROGRAMS.map((config): [string, string[]] => [config, ROUTED_DIRS]),
]);

// Programs that must fail, by the codes their own fixture must report: the
// legacy routed consumer proves LitStateDeclaration still infers render().
const EXPECTED_CODES = new Map([
  ['routed/legacy/tsconfig.fixture.json', [2502, 7022, 7023]],
  ['routed/legacy/tsconfig.fixture.nodenext.json', [2502, 7022, 7023]],
]);

// undefined for a program that must check clean
function reportsExpected(
  configFile: string,
  diagnostics: { code: number; fileName: string | undefined }[],
): boolean | undefined {
  const expected = EXPECTED_CODES.get(configFile);

  if (!expected) return undefined;
  const fixtureDir = resolve(here, dirname(configFile)) + sep;

  const codes = new Set<number>();

  for (const { code, fileName } of diagnostics) {
    if (fileName?.startsWith(fixtureDir)) codes.add(code);
  }

  return expected.every((code) => codes.has(code));
}

function belowFloor(version: string, configFile: string): boolean {
  const floor = MIN_VERSION.get(configFile);

  if (!floor) return false;
  const [major = 0, minor = 0] = version.split('.').map(Number);

  return major < floor[0] || (major === floor[0] && minor < floor[1]);
}

const programDirs = (configFile: string) =>
  CONFIGS.get(configFile) ?? PACKAGE_DIRS;

// A file we cannot resolve is treated as ours: it means the compiler reported
// against something we planted or mangled, which must never be tolerated.
function ownsPath(fileName: string): boolean {
  let normalized;

  try {
    normalized = resolve(realpathSync(fileName));
  } catch {
    return true;
  }

  if (normalized.startsWith(here + sep)) return true;

  return PACKAGE_DIRS.some((dir) => normalized.startsWith(dir));
}

function loadConfig(ts: ClassicApi, configFile: string): TS.ParsedCommandLine {
  let fatal: string | undefined;

  const host = {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic: TS.Diagnostic) => {
      fatal = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    },
  };

  const parsed = ts.getParsedCommandLineOfConfigFile(
    join(here, configFile),
    undefined,
    host,
  );

  if (!parsed || fatal) {
    throw new Error(`failed to parse ${configFile}: ${fatal ?? 'unknown'}`);
  }

  return parsed;
}

function check(
  specifier: string,
  configFile: string,
  extraRootNames: string[] = [],
) {
  // SAFETY: every API_VERSIONS alias exports the classic compiler API
  const ts = require(specifier) as ClassicApi;
  const parsed = loadConfig(ts, configFile);

  const program = ts.createProgram({
    rootNames: [...parsed.fileNames, ...extraRootNames],
    options: parsed.options,
  });

  // guard: the packages under test must actually be in the program (built)
  const files = program.getSourceFiles().map((file) => file.fileName);

  const missing = programDirs(configFile).filter(
    (dir) =>
      !files.some((file) =>
        resolve(ts.sys.realpath ? ts.sys.realpath(file) : file).startsWith(dir),
      ),
  );

  if (missing.length > 0) {
    throw new Error(
      `dist .d.ts missing from program (run \`turbo run build\` first):\n  ${missing.join('\n  ')}`,
    );
  }

  const diagnostics = ts.getPreEmitDiagnostics(program);
  const owned: TS.Diagnostic[] = [];
  let foreign = 0;

  for (const diagnostic of diagnostics) {
    if (!diagnostic.file || ownsPath(diagnostic.file.fileName)) {
      owned.push(diagnostic);
    } else {
      foreign += 1;
    }
  }

  return { ts, owned, foreign, fileCount: files.length };
}

// TypeScript 7 equivalent of check(). Diagnostics come back as plain objects
// ({ fileName, pos, end, code, category, text }) rather than ts.Diagnostic.
async function checkNative(
  specifier: string,
  configFile: string,
  fileSystem?: RequestFileSystem,
) {
  // SAFETY: NATIVE_VERSION ships both modules in these shapes
  const [{ API, DiagnosticCategory }, { version }] = (await Promise.all([
    import(`${specifier}/sync`),
    import(specifier),
  ])) as [NativeSyncModule, NativeModule];

  const api = new API({ cwd: here });
  const configPath = resolve(here, configFile);

  const snapshot = api.createSnapshot({
    openProjects: [configPath],
    fileSystem,
  });

  try {
    const project = snapshot.getConfiguredProject(configPath);

    if (!project) throw new Error(`no project for ${configFile}`);
    const { program } = project;

    const files = program.getSourceFileNames();

    const missing = programDirs(configFile).filter(
      (dir) => !files.some((file) => resolve(file).startsWith(dir)),
    );

    if (missing.length > 0) {
      throw new Error(
        `dist .d.ts missing from program (run \`turbo run build\` first):\n  ${missing.join('\n  ')}`,
      );
    }

    const owned: NativeDiagnostic[] = [];
    let foreign = 0;

    const diagnostics = [
      ...program.getConfigFileParsingDiagnostics(),
      ...program.getGlobalDiagnostics(),
      ...program.getSyntacticDiagnostics(),
      ...program.getSemanticDiagnostics(),
    ];

    // the protocol types `category` as a bare number, not the enum
    const errorCategory: number = DiagnosticCategory.Error;

    for (const diagnostic of diagnostics) {
      if (diagnostic.category !== errorCategory) continue;

      if (!diagnostic.fileName || ownsPath(diagnostic.fileName)) {
        owned.push(diagnostic);
      } else {
        foreign += 1;
      }
    }

    return { version, owned, foreign, fileCount: files.length };
  } finally {
    snapshot.dispose();
    api.close();
  }
}

function formatNative(diagnostics: NativeDiagnostic[]): string {
  return diagnostics
    .map((d) => `  ${d.fileName ?? '<unknown>'}: TS${d.code}: ${d.text}`)
    .join('\n');
}

async function runNative(specifier: string, configFile: string) {
  const { version, owned, foreign, fileCount } = await checkNative(
    specifier,
    configFile,
  );

  const label = `TS ${version} · ${configFile}`;

  const expected = reportsExpected(
    configFile,
    owned.map(({ code, fileName }) => ({ code, fileName })),
  );

  if (expected) {
    console.log(`✔ ${label} — reports the expected errors`);

    return true;
  }

  if (expected === false || owned.length > 0) {
    console.error(`✖ ${label}`);
    console.error(formatNative(owned));

    return false;
  }

  const foreignNote =
    foreign > 0 ? ` (${foreign} third-party diagnostics ignored)` : '';

  console.log(`✔ ${label} — ${fileCount} files checked${foreignNote}`);

  return true;
}

function run(specifier: string, configFile: string) {
  // SAFETY: every API_VERSIONS alias exports the classic compiler API
  const { version } = require(specifier) as ClassicApi;

  if (belowFloor(version, configFile)) {
    console.log(`- TS ${version} · ${configFile} — skipped below its floor`);

    return true;
  }

  const { ts, owned, foreign, fileCount } = check(specifier, configFile);

  const label = `TS ${ts.version} · ${configFile}`;

  const expected = reportsExpected(
    configFile,
    owned.map(({ code, file }) => ({ code, fileName: file?.fileName })),
  );

  if (expected) {
    console.log(`✔ ${label} — reports the expected errors`);

    return true;
  }

  if (expected === false || owned.length > 0) {
    const formatHost: TS.FormatDiagnosticsHost = {
      getCurrentDirectory: () => here,
      getCanonicalFileName: (fileName) => fileName,
      getNewLine: () => '\n',
    };

    console.error(`✖ ${label}`);
    console.error(ts.formatDiagnosticsWithColorAndContext(owned, formatHost));

    return false;
  }

  const foreignNote =
    foreign > 0 ? ` (${foreign} third-party diagnostics ignored)` : '';

  console.log(`✔ ${label} — ${fileCount} files checked${foreignNote}`);

  return true;
}

// Self-test: prove the harness can fail. Compiles a probe .d.ts alongside the
// fixtures, then asserts the floor leg rejects it and the current leg accepts
// it. Guards against a filter/ownership bug that would classify everything as
// third-party and stay green forever. If the floor is ever raised past 5.4,
// this fails loudly — pick a newer-syntax probe.
//
// Probes live in a scratch dir, never in packages/*/dist — concurrent tasks
// in the same graph (test × test:matrix, pack:all packing dist) race any mutation
// of shared build outputs.
const PROBE = 'export type __dtsBacktestProbe = NoInfer<string>;\n';

// The native leg has its own ownership filter, so it needs its own proof. An
// unresolvable name must surface as an owned diagnostic, not a tolerated one.
const NATIVE_PROBE =
  'export type __dtsBacktestNativeProbe = __NoSuchTypeExists__;\n';

// Under `here` (not os.tmpdir()) so ownsPath() owns the probe diagnostics;
// outside this task's turbo `inputs` so the scratch lifecycle never dirties
// the cache hash.
function withProbeFile<T>(probe: string, body: (probePath: string) => T): T {
  mkdirSync(join(here, '.probe-scratch'), { recursive: true });
  const scratchDir = mkdtempSync(join(here, '.probe-scratch', 'run-'));
  const probePath = join(scratchDir, 'probe.d.ts');
  writeFileSync(probePath, probe);

  try {
    return body(probePath);
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
}

const probeDiagnostic = (fileName: string | undefined) =>
  fileName?.endsWith('probe.d.ts') ?? false;

function selftest() {
  const floor = API_VERSIONS[0];
  const current = API_VERSIONS[API_VERSIONS.length - 1];

  return withProbeFile(PROBE, (probePath) => {
    const floorRun = check(floor, BASE_CONFIG, [probePath]);

    const probeCaught = floorRun.owned.some((diagnostic) =>
      probeDiagnostic(diagnostic.file?.fileName),
    );

    if (!probeCaught) {
      console.error(
        `✖ selftest — TS ${floorRun.ts.version} did not reject the NoInfer probe in ${probePath}`,
      );

      return false;
    }

    const currentRun = check(current, BASE_CONFIG, [probePath]);

    if (currentRun.owned.length > 0) {
      console.error(
        `✖ selftest — TS ${currentRun.ts.version} unexpectedly rejected the NoInfer probe`,
      );

      return false;
    }

    console.log(
      `✔ selftest — floor TS ${floorRun.ts.version} rejects the probe, current TS ${currentRun.ts.version} accepts it`,
    );

    return true;
  });
}

async function selftestNative() {
  // in-memory overlay under `here`: relative paths resolve as on disk
  const probeDir = join(here, '.probe-native');
  const probeConfig = join(probeDir, 'tsconfig.json');

  const fileSystem = createFileSystemLayer([
    [
      probeConfig,
      JSON.stringify({
        extends: `../${BASE_CONFIG}`,
        include: ['../fixtures/**/*.ts', './probe.d.ts'],
      }),
    ],
    [join(probeDir, 'probe.d.ts'), NATIVE_PROBE],
  ]);

  const { version, owned } = await checkNative(
    NATIVE_VERSION,
    probeConfig,
    fileSystem,
  );

  const caught = owned.some((diagnostic) =>
    probeDiagnostic(diagnostic.fileName),
  );

  if (!caught) {
    console.error(`✖ selftest native — TS ${version} did not reject the probe`);

    return false;
  }

  console.log(`✔ selftest native — TS ${version} rejects the probe`);

  return true;
}

const main = async (): Promise<void> => {
  // --versions=current runs only the repo-current (native TS 7) leg; the
  // default full matrix adds the pinned classic legs and their self-test.
  const versionsArg = process.argv
    .find((arg) => arg.startsWith('--versions='))
    ?.slice('--versions='.length);

  if (versionsArg !== undefined && !['current', 'full'].includes(versionsArg)) {
    console.error(`unknown --versions=${versionsArg} (expected current|full)`);
    process.exitCode = 2;

    return;
  }

  const currentOnly = versionsArg === 'current';

  let ok = currentOnly ? true : selftest();

  ok = (await selftestNative()) && ok;

  if (!currentOnly) {
    for (const specifier of API_VERSIONS) {
      for (const configFile of CONFIGS.keys()) {
        ok = run(specifier, configFile) && ok;
      }
    }
  }

  for (const configFile of CONFIGS.keys()) {
    ok = (await runNative(NATIVE_VERSION, configFile)) && ok;
  }

  if (!ok) process.exitCode = 1;
};

if (import.meta.main) await main();
