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

import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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
// dynamic import to it. Narrow, honest, and version-local.
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

// A parsed JSON/CJS export is untyped; narrow it before reading a field.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// devDependency aliases, oldest first; every leg is pinned so none tracks the
// repo's own catalog. 6.x is the newest TypeScript with the classic API.
const API_VERSIONS = ['typescript-5.0', 'typescript-5.9', 'typescript-6'];

const NATIVE_VERSION = 'typescript-7';

const CONFIGS = ['tsconfig.fixture.json', 'tsconfig.fixture.nodenext.json'];

// dist dirs whose .d.ts must check clean (pnpm symlinks resolve to these)
const PACKAGE_DIRS = [
  'lit-ui-router',
  'lit-ui-router-mobx',
  'navigation-location-plugin',
].map((dir) => resolve(here, '..', '..', 'packages', dir, 'dist') + sep);

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

function check(specifier: string, configFile: string) {
  // `require` is untyped; every leg reaching here is the classic API.
  const ts = require(specifier) as ClassicApi;
  const parsed = loadConfig(ts, configFile);
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
  });

  // guard: the packages under test must actually be in the program (built)
  const files = program.getSourceFiles().map((file) => file.fileName);
  const missing = PACKAGE_DIRS.filter(
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
  // TS 7 exposes no types for the unstable sync API; assert the slice we use.
  const { API, DiagnosticCategory } = (await import(
    `${specifier}/unstable/sync`
  )) as NativeSyncModule;
  const versionModule: unknown = require(
    join(
      dirname(require.resolve(`${specifier}/package.json`)),
      'lib',
      'version.cjs',
    ),
  );
  const version =
    isRecord(versionModule) && typeof versionModule.version === 'string'
      ? versionModule.version
      : 'unknown';

  const api = new API({ cwd: here });
  const configPath = join(here, configFile);
  const snapshot = api.updateSnapshot({ openProjects: [configPath] });
  try {
    const project = snapshot.getProject(configPath);
    if (!project) throw new Error(`no project for ${configFile}`);
    const { program } = project;

    const files: string[] = program.getSourceFileNames();
    const missing = PACKAGE_DIRS.filter(
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
  const label = `TS ${version} · ${configFile}`;
  if (owned.length > 0) {
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
  const { ts, owned, foreign, fileCount } = check(specifier, configFile);

  const label = `TS ${ts.version} · ${configFile}`;
  if (owned.length > 0) {
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

// Self-test: prove the harness can fail. Injects a NoInfer<> probe (TS 5.4+
// syntax) into a dist .d.ts, then asserts the floor leg rejects it and the
// current leg accepts it. Guards against a filter/ownership bug that would
// classify everything as third-party and stay green forever. If the floor is
// ever raised past 5.4, this fails loudly — pick a newer-syntax probe.
const PROBE = '\nexport type __dtsBacktestProbe = NoInfer<string>;\n';

// The native leg has its own ownership filter, so it needs its own proof. An
// unresolvable name must surface as an owned diagnostic, not a tolerated one.
const NATIVE_PROBE =
  '\nexport type __dtsBacktestNativeProbe = __NoSuchTypeExists__;\n';

// async: the native leg reads the probe after an await, so the restore must not
// run until the body has fully resolved.
async function withProbe<T>(
  probe: string,
  body: (target: string) => T | Promise<T>,
): Promise<T> {
  const target = join(PACKAGE_DIRS[0], 'index.d.ts');
  const original = readFileSync(target, 'utf8');
  writeFileSync(target, original + probe);
  try {
    return await body(target);
  } finally {
    writeFileSync(target, original);
  }
}

function selftest() {
  const floor = API_VERSIONS[0];
  const current = API_VERSIONS[API_VERSIONS.length - 1];
  return withProbe(PROBE, (target) => {
    const floorRun = check(floor, CONFIGS[0]);
    const probeCaught = floorRun.owned.some((diagnostic) =>
      diagnostic.file?.fileName.endsWith('index.d.ts'),
    );
    if (!probeCaught) {
      console.error(
        `✖ selftest — TS ${floorRun.ts.version} did not reject the NoInfer probe in ${target}`,
      );
      return false;
    }
    const currentRun = check(current, CONFIGS[0]);
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
  const { version, owned } = await withProbe(NATIVE_PROBE, () =>
    checkNative(NATIVE_VERSION, CONFIGS[0]),
  );
  const caught = owned.some((diagnostic) =>
    diagnostic.fileName?.endsWith('index.d.ts'),
  );
  if (!caught) {
    console.error(`✖ selftest native — TS ${version} did not reject the probe`);
    return false;
  }
  console.log(`✔ selftest native — TS ${version} rejects the probe`);
  return true;
}

let ok = await selftest();
ok = (await selftestNative()) && ok;
for (const specifier of API_VERSIONS) {
  for (const configFile of CONFIGS) {
    ok = run(specifier, configFile) && ok;
  }
}
for (const configFile of CONFIGS) {
  ok = (await runNative(NATIVE_VERSION, configFile)) && ok;
}
process.exit(ok ? 0 : 1);
