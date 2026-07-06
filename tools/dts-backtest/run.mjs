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

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// devDependency aliases; "typescript" is the repo's current catalog version.
const VERSIONS = ['typescript-5.0', 'typescript'];

const CONFIGS = ['tsconfig.fixture.json', 'tsconfig.fixture.nodenext.json'];

// dist dirs whose .d.ts must check clean (pnpm symlinks resolve to these)
const PACKAGE_DIRS = [
  'lit-ui-router',
  'lit-ui-router-mobx',
  'navigation-location-plugin',
].map((dir) => resolve(here, '..', '..', 'packages', dir, 'dist') + sep);

function loadConfig(ts, configFile) {
  let fatal;
  const host = {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
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

function ownedBy(ts, fileName) {
  const real = ts.sys.realpath ? ts.sys.realpath(fileName) : fileName;
  const normalized = resolve(real);
  if (normalized.startsWith(here + sep)) return true;
  return PACKAGE_DIRS.some((dir) => normalized.startsWith(dir));
}

function check(specifier, configFile) {
  const ts = require(specifier);
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
  const owned = [];
  let foreign = 0;
  for (const diagnostic of diagnostics) {
    if (!diagnostic.file || ownedBy(ts, diagnostic.file.fileName)) {
      owned.push(diagnostic);
    } else {
      foreign += 1;
    }
  }

  return { ts, owned, foreign, fileCount: files.length };
}

function run(specifier, configFile) {
  const { ts, owned, foreign, fileCount } = check(specifier, configFile);

  const label = `TS ${ts.version} · ${configFile}`;
  if (owned.length > 0) {
    const formatHost = {
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

function selftest() {
  const [floor, current] = VERSIONS;
  const target = join(PACKAGE_DIRS[0], 'index.d.ts');
  const original = readFileSync(target, 'utf8');
  writeFileSync(target, original + PROBE);
  try {
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
  } finally {
    writeFileSync(target, original);
  }
}

let ok = selftest();
for (const specifier of VERSIONS) {
  for (const configFile of CONFIGS) {
    ok = run(specifier, configFile) && ok;
  }
}
process.exit(ok ? 0 : 1);
