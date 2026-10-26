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
// `typescript/unstable/sync` — a different, still-unstable surface that 7.1 is
// expected to replace.

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The classic (6.x-and-earlier) compiler API. Every API leg is a `typescript`
// aliased to a fixed version, all sharing this surface, so one namespace types
// them all. The native 7 leg (checkNative) uses plain objects instead.
import type * as TS from 'typescript-5.9';

type ClassicApi = typeof import('typescript-5.9');

// A native (TS 7) diagnostic, as `typescript/unstable/sync` hands them back:
// plain objects rather than ts.Diagnostic instances.
type NativeDiagnostic = {
  fileName?: string;
  code: number;
  category: number;
  text: string;
  pos?: number;
  end?: number;
};

// TypeScript 7 ships no types for its unstable `typescript/unstable/sync`
// surface, so describe exactly the slice checkNative drives and assert the
// dynamic import to it.
interface NativeProgram {
  getSourceFileNames(): string[];
  getConfigFileParsingDiagnostics(): NativeDiagnostic[];
  getGlobalDiagnostics(): NativeDiagnostic[];
  getSyntacticDiagnostics(): NativeDiagnostic[];
  getSemanticDiagnostics(): NativeDiagnostic[];
}

interface NativeSnapshot {
  getProject(configPath: string): { program: NativeProgram } | undefined;
  dispose(): void;
}

interface NativeApi {
  updateSnapshot(options: { openProjects: string[] }): NativeSnapshot;
  close(): void;
}

interface NativeSyncModule {
  API: new (options: { cwd: string }) => NativeApi;
  DiagnosticCategory: { Error: number };
}

// Every leg reports its own version from its root export, classic and native
// alike — the classic legs read it off the API object as `ts.version`.
interface NativeModule {
  version: string;
}

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

// Of those, programs whose owned diagnostics must carry the expected codes and no other.
const EXPECTED_ONLY = new Set<string>();

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

  if (EXPECTED_ONLY.has(configFile)) {
    return (
      diagnostics.every(({ code }) => expected.includes(code)) &&
      expected.every((code) => codes.has(code))
    );
  }

  return expected.every((code) => codes.has(code));
}

// ---- the optional registry peer, from the packed tarballs -------------------

// Inside the workspace pnpm's real paths keep ui-router-registry resolvable, so
// the consumers of lit-ui-router's optional peer run from a temp dir holding
// the `@tools/release#pack:all` tarballs, with or without the registry.
const PACK_DIR = resolve(here, '..', 'release', '.cache', 'pack');

// Third-party packages the staged declarations import, linked from this package.
const STAGED_LINKS = ['@uirouter/core', 'lit'];

// Fixture dir under optional-peer/, and whether its consumer installs the registry.
const OPTIONAL_PEER_SCENARIOS = [
  { fixture: 'absent', registry: false },
  { fixture: 'absent-augmented', registry: false },
  { fixture: 'installed', registry: true },
] as const;

// Staged roots own their diagnostics, as the packages' dist dirs do.
const stagedRoots: string[] = [];

// Each staged config, keyed to the staged dist dirs it must load.
const STAGED_CONFIGS = new Map<string, string[]>();

const STAGED_LABELS = new Map<string, string>();

const labelOf = (configFile: string) =>
  STAGED_LABELS.get(configFile) ?? configFile;

function unpack(name: string, nodeModules: string): string {
  const dir = join(nodeModules, name);
  mkdirSync(dir, { recursive: true });
  execFileSync('tar', [
    '-xzf',
    join(PACK_DIR, `${name}.tgz`),
    '-C',
    dir,
    '--strip-components=1',
  ]);

  return dir;
}

// A dir per install shape; each scenario gets a bundler and a NodeNext config.
function stageOptionalPeer(): string[] {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'dts-backtest-peer-')));
  stagedRoots.push(root + sep);
  const configs: string[] = [];

  for (const withRegistry of [false, true]) {
    const consumer = join(root, withRegistry ? 'with' : 'without');
    const nodeModules = join(consumer, 'node_modules');

    const packages = [
      'lit-ui-router',
      ...(withRegistry ? ['ui-router-registry'] : []),
    ];

    const dists = packages.map(
      (name) => join(unpack(name, nodeModules), 'dist') + sep,
    );

    for (const link of STAGED_LINKS) {
      mkdirSync(dirname(join(nodeModules, link)), { recursive: true });
      symlinkSync(
        realpathSync(join(here, 'node_modules', link)),
        join(nodeModules, link),
      );
    }

    writeFileSync(
      join(consumer, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );

    for (const { fixture, registry } of OPTIONAL_PEER_SCENARIOS) {
      if (registry !== withRegistry) continue;
      const dir = join(consumer, fixture);
      mkdirSync(dir);
      copyFileSync(
        join(here, 'optional-peer', fixture, `${fixture}.ts`),
        join(dir, `${fixture}.ts`),
      );

      for (const nodenext of [false, true]) {
        const config = join(
          dir,
          nodenext ? 'tsconfig.nodenext.json' : 'tsconfig.json',
        );

        writeFileSync(
          config,
          JSON.stringify({
            compilerOptions: {
              target: 'ES2022',
              module: nodenext ? 'NodeNext' : 'ESNext',
              moduleResolution: nodenext ? 'NodeNext' : 'bundler',
              lib: ['ES2022', 'DOM', 'DOM.Iterable'],
              types: [],
              strict: true,
              skipLibCheck: false,
              noEmit: true,
            },
            include: ['*.ts'],
          }),
        );
        STAGED_CONFIGS.set(config, dists);
        STAGED_LABELS.set(
          config,
          `optional-peer (${withRegistry ? 'registry installed' : 'no registry'}) · ${fixture}/${config.slice(dir.length + 1)}`,
        );
        configs.push(config);

        if (fixture === 'absent-augmented') {
          EXPECTED_CODES.set(config, [2664]);
          EXPECTED_ONLY.add(config);
        }
      }
    }
  }

  return configs;
}

// The packed lit-ui-router names the registry as an optional peer, and from types alone.
function checkPackedPeer(): boolean {
  const root = stagedRoots.at(-1);

  if (!root) throw new Error('stageOptionalPeer() first');
  const pkg = join(root, 'without', 'node_modules', 'lit-ui-router');

  // SAFETY: the packed manifest is the one pack:all wrote, validated by check:pack
  const manifest = JSON.parse(
    readFileSync(join(pkg, 'package.json'), 'utf8'),
  ) as {
    peerDependencies?: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  };

  const failures: string[] = [];

  if (manifest.peerDependencies?.['ui-router-registry'] === undefined) {
    failures.push('ui-router-registry is not a peer');
  }

  if (
    manifest.peerDependenciesMeta?.['ui-router-registry']?.optional !== true
  ) {
    failures.push('ui-router-registry is not an optional peer');
  }

  const scripts = readdirSync(join(pkg, 'dist'), { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.js'));

  for (const file of scripts) {
    if (
      readFileSync(join(pkg, 'dist', file), 'utf8').includes(
        'ui-router-registry',
      )
    ) {
      failures.push(`dist/${file} names ui-router-registry at runtime`);
    }
  }

  if (failures.length > 0) {
    console.error(`✖ packed lit-ui-router — ${failures.join('; ')}`);

    return false;
  }

  console.log(
    `✔ packed lit-ui-router — optional ui-router-registry peer, no runtime import in ${scripts.length} .js files`,
  );

  return true;
}

function belowVersion(version: string, floor: number[]): boolean {
  const [major = 0, minor = 0] = version.split('.').map(Number);
  const [floorMajor = 0, floorMinor = 0] = floor;

  return major < floorMajor || (major === floorMajor && minor < floorMinor);
}

function belowFloor(version: string, configFile: string): boolean {
  const floor = MIN_VERSION.get(configFile);

  return floor !== undefined && belowVersion(version, floor);
}

const programDirs = (configFile: string) =>
  STAGED_CONFIGS.get(configFile) ?? CONFIGS.get(configFile) ?? PACKAGE_DIRS;

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

  if (stagedRoots.some((root) => normalized.startsWith(root))) return true;

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
    resolve(here, configFile),
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
async function checkNative(specifier: string, configFile: string) {
  // SAFETY: NATIVE_VERSION ships both modules in these shapes
  const [{ API, DiagnosticCategory }, { version }] = (await Promise.all([
    import(`${specifier}/unstable/sync`),
    import(specifier),
  ])) as [NativeSyncModule, NativeModule];

  const api = new API({ cwd: here });
  const configPath = resolve(here, configFile);
  const snapshot = api.updateSnapshot({ openProjects: [configPath] });

  try {
    const project = snapshot.getProject(configPath);

    if (!project) throw new Error(`no project for ${configFile}`);
    const { program } = project;

    const files: string[] = program.getSourceFileNames();

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

    for (const diagnostic of diagnostics) {
      if (diagnostic.category !== DiagnosticCategory.Error) continue;

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

  const label = `TS ${version} · ${labelOf(configFile)}`;

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
    console.log(
      `- TS ${version} · ${labelOf(configFile)} — skipped below its floor`,
    );

    return true;
  }

  const { ts, owned, foreign, fileCount } = check(specifier, configFile);

  const label = `TS ${ts.version} · ${labelOf(configFile)}`;

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

// Under `here` (not os.tmpdir()) so ownsPath() owns the probe diagnostics and
// relative tsconfig paths resolve; outside this task's turbo `inputs` so the
// scratch lifecycle never dirties the cache hash.
async function withProbeFile<T>(
  probe: string,
  body: (probePath: string, scratchDir: string) => T | Promise<T>,
): Promise<T> {
  mkdirSync(join(here, '.probe-scratch'), { recursive: true });
  const scratchDir = mkdtempSync(join(here, '.probe-scratch', 'run-'));
  const probePath = join(scratchDir, 'probe.d.ts');
  writeFileSync(probePath, probe);

  try {
    return await body(probePath, scratchDir);
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
  // The native API takes only a tsconfig; relative `include` paths resolve
  // against the declaring config, so the scratch dir gets its own.
  const { version, owned } = await withProbeFile(
    NATIVE_PROBE,
    (_probePath, scratchDir) => {
      const scratchConfig = join(scratchDir, 'tsconfig.json');
      writeFileSync(
        scratchConfig,
        JSON.stringify({
          extends: `../../${BASE_CONFIG}`,
          include: ['../../fixtures/**/*.ts', './probe.d.ts'],
        }),
      );

      return checkNative(NATIVE_VERSION, scratchConfig);
    },
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

// Self-test for the optional peer's guard: swapped to an `IsAny` guard, an
// absent registry types every sref as `any` from TypeScript 5.5, which the
// `absent` fixture's equality checks must reject. Older legs still see `string`.
const IS_ANY_GUARD = '0 extends 1 & R.Register';

const ABSENT_GUARD = 'unknown extends R.Register';

async function selftestGuard(currentOnly: boolean): Promise<boolean> {
  const [config] = stageOptionalPeer();

  if (!config?.includes(`${sep}absent${sep}`)) {
    throw new Error(`expected the absent fixture first, got ${config}`);
  }

  const declaration = join(
    dirname(dirname(config)),
    'node_modules',
    'lit-ui-router',
    'dist',
    'registry.d.ts',
  );

  const source = readFileSync(declaration, 'utf8');

  if (!source.includes(ABSENT_GUARD)) {
    console.error(
      `✖ selftest guard — no \`${ABSENT_GUARD}\` in the packed registry.d.ts`,
    );

    return false;
  }

  writeFileSync(declaration, source.replace(ABSENT_GUARD, IS_ANY_GUARD));

  const results: { version: string; failed: boolean }[] = [];

  if (!currentOnly) {
    for (const specifier of API_VERSIONS) {
      const { ts, owned } = check(specifier, config);
      results.push({ version: ts.version, failed: owned.length > 0 });
    }
  }

  const native = await checkNative(NATIVE_VERSION, config);
  results.push({ version: native.version, failed: native.owned.length > 0 });

  const wrong = results.filter(
    ({ version, failed }) => failed !== !belowVersion(version, [5, 5]),
  );

  if (wrong.length > 0) {
    console.error(
      `✖ selftest guard — with an IsAny guard, expected TS 5.5+ to fail the absent fixture and older TS to pass: ${wrong
        .map(
          ({ version, failed }) =>
            `TS ${version} ${failed ? 'failed' : 'passed'}`,
        )
        .join(', ')}`,
    );

    return false;
  }

  console.log(
    `✔ selftest guard — an IsAny guard fails the absent fixture on ${results
      .flatMap(({ version, failed }) => (failed ? [`TS ${version}`] : []))
      .join(', ')}`,
  );

  return true;
}

async function runAll(currentOnly: boolean): Promise<boolean> {
  let ok = currentOnly ? true : await selftest();

  ok = (await selftestNative()) && ok;

  ok = (await selftestGuard(currentOnly)) && ok;

  const configFiles = [...CONFIGS.keys(), ...stageOptionalPeer()];

  ok = checkPackedPeer() && ok;

  if (!currentOnly) {
    for (const specifier of API_VERSIONS) {
      for (const configFile of configFiles) {
        ok = run(specifier, configFile) && ok;
      }
    }
  }

  for (const configFile of configFiles) {
    ok = (await runNative(NATIVE_VERSION, configFile)) && ok;
  }

  return ok;
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

  try {
    if (!(await runAll(versionsArg === 'current'))) process.exitCode = 1;
  } finally {
    for (const root of stagedRoots) {
      rmSync(root, { recursive: true, force: true });
    }
  }
};

if (import.meta.main) await main();
