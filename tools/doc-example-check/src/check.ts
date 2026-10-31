#!/usr/bin/env node
// Type-check the ts blocks in the published sources' `@example` tags, one
// in-memory module per block, against the packages' built types; build first.
// Usage: check [--mode=opt-in|opt-out] [--prelude=globals.d.ts] [file ...]
// (default files: packages/*/src)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { createFileSystemLayer } from 'typescript/fs';
import {
  API,
  DiagnosticCategory,
  type Diagnostic as TsDiagnostic,
} from 'typescript/sync';

import type { ExampleBlock, Mode } from './blocks.ts';
import { collectExamples } from './collect.ts';
import {
  formatDiagnostic,
  summarize,
  type BlockResult,
  type Census,
  type Diagnostic,
} from './report.ts';
import { workspacePaths, type CompilerPaths } from './resolution.ts';

const packageDir = fileURLToPath(new URL('..', import.meta.url));

/** Overlay-only directory: under this package so `@types/node` resolves, never on disk. */
const virtualDir = path.join(packageDir, '.examples');

/** A consumer's view of the published types. */
const COMPILER_OPTIONS = {
  noEmit: true,
  strict: true,
  target: 'ES2022',
  module: 'preserve',
  moduleResolution: 'bundler',
  moduleDetection: 'force',
  experimentalDecorators: true,
  useDefineForClassFields: false,
  lib: ['ES2022', 'DOM', 'DOM.Iterable'],
  types: ['node'],
  skipLibCheck: true,
};

const SOURCES = 'packages/*/src/**/*.ts';

const NOT_PUBLISHED = [
  '**/specs/**',
  '**/__tests__/**',
  '**/*.spec.ts',
  '**/*.test.ts',
  '**/*.test-d.ts',
];

interface Target {
  file: string;
  block: ExampleBlock;
  virtual: string;
}

export interface CheckOptions {
  /** Directory the reported file names are relative to. */
  root: string;
  /** Files relative to `root`. */
  files: string[];
  mode: Mode;
  paths?: CompilerPaths;
  /** A global `.d.ts` checked with every block. */
  prelude?: string;
}

const virtualName = (file: string, block: ExampleBlock): string =>
  path.join(virtualDir, `${file.replace(/\.ts$/, '')}.L${block.line}.ts`);

const toSource = (target: Target, d: TsDiagnostic): Diagnostic => {
  const at = d.startPosition ?? { line: 0, character: 0 };
  const origin = target.block.lines[at.line] ?? target.block.lines.at(-1);

  return {
    file: target.file,
    line: origin?.line ?? target.block.line,
    column: (origin?.column ?? 0) + at.character + 1,
    code: `TS${d.code}`,
    message: d.text,
  };
};

const overlay = (
  targets: Target[],
  paths: CompilerPaths,
  prelude: string | undefined,
) => {
  const config = path.join(virtualDir, 'tsconfig.json');
  const roots = targets.map((target) => target.virtual);

  const fileSystem = createFileSystemLayer([
    [
      config,
      JSON.stringify({
        compilerOptions: {
          ...COMPILER_OPTIONS,
          paths: Object.fromEntries(paths),
        },
        files: prelude ? [...roots, path.resolve(prelude)] : roots,
      }),
    ],
    ...targets.map((t): [string, string] => [t.virtual, t.block.text]),
  ]);

  return { config, fileSystem };
};

const statusOf = (syntactic: TsDiagnostic[], all: TsDiagnostic[]) => {
  if (syntactic.length > 0) return 'syntax';

  return all.length > 0 ? 'semantic' : 'clean';
};

export interface CheckResult {
  results: BlockResult[];
  census: Census;
  /** Diagnostics outside any block: config, globals, the prelude. */
  foreign: string[];
}

interface Collected {
  census: Census;
  targets: Target[];
  skipped: BlockResult[];
}

const collect = (api: API, options: CheckOptions): Collected => {
  const collected: Collected = {
    census: { files: 0, tags: 0, unfenced: [] },
    targets: [],
    skipped: [],
  };

  const { census, targets, skipped } = collected;

  for (const file of options.files) {
    const source = fs.readFileSync(path.join(options.root, file), 'utf8');
    const found = collectExamples(api, file, source, options.mode);

    if (found.tags > 0) census.files += 1;

    census.tags += found.tags;
    census.unfenced.push(...found.unfenced.map((line) => `${file}:${line}`));

    for (const block of found.blocks) {
      if (block.skip) {
        skipped.push({ file, block, status: 'skipped', diagnostics: [] });
      } else {
        targets.push({ file, block, virtual: virtualName(file, block) });
      }
    }
  }

  return collected;
};

const errorCategory: number = DiagnosticCategory.Error;

const errors = (diagnostics: readonly TsDiagnostic[]): TsDiagnostic[] =>
  diagnostics.filter((d) => d.category === errorCategory);

const diagnose = (
  api: API,
  targets: Target[],
  options: CheckOptions,
): Pick<CheckResult, 'results' | 'foreign'> => {
  const { config, fileSystem } = overlay(
    targets,
    options.paths ?? workspacePaths(workspaceRoot),
    options.prelude,
  );

  using snapshot = api.createSnapshot({ openProjects: [config], fileSystem });
  const project = snapshot.getConfiguredProject(config);

  if (!project) throw new Error(`no project for ${config}`);

  const { program } = project;
  const files = targets.map((target) => target.virtual);
  const syntactic = errors(program.getSyntacticDiagnostics(files));
  const semantic = errors(program.getSemanticDiagnostics(files));

  const results = targets.map((target): BlockResult => {
    const ownOf = (diagnostics: TsDiagnostic[]) =>
      diagnostics.filter((d) => d.fileName === target.virtual);

    const own = ownOf([...syntactic, ...semantic]);

    return {
      file: target.file,
      block: target.block,
      status: statusOf(ownOf(syntactic), own),
      diagnostics: own.map((d) => toSource(target, d)),
    };
  });

  const known = new Set<string>(files);

  const foreign = errors([
    ...program.getProgramDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...syntactic,
    ...semantic,
  ])
    .filter((d) => !d.fileName || !known.has(d.fileName))
    .map((d) => `${d.fileName ?? '<program>'}: TS${d.code}: ${d.text}`);

  return { results, foreign };
};

const order = (r: BlockResult): string =>
  `${r.file}\0${String(r.block.line).padStart(6)}`;

/** Checks every collected block in one snapshot. */
export const checkExamples = (options: CheckOptions): CheckResult => {
  const api = new API({ cwd: packageDir });

  try {
    const { census, targets, skipped } = collect(api, options);

    const { results, foreign } =
      targets.length > 0
        ? diagnose(api, targets, options)
        : { results: [], foreign: [] };

    return {
      results: [...results, ...skipped].sort((a, b) =>
        order(a).localeCompare(order(b)),
      ),
      census,
      foreign,
    };
  } finally {
    api.close();
  }
};

const MODES: readonly string[] = ['opt-in', 'opt-out'];

const isMode = (value: string): value is Mode => MODES.includes(value);

const main = (): void => {
  const args = process.argv.slice(2);
  const modeArg = args.find((arg) => arg.startsWith('--mode='))?.slice(7);
  const mode = modeArg ?? 'opt-in';

  if (!isMode(mode)) {
    console.error(`unknown --mode=${mode} (expected opt-in|opt-out)`);
    process.exitCode = 2;

    return;
  }

  const prelude = args.find((arg) => arg.startsWith('--prelude='))?.slice(10);

  const named = args.filter((arg) => !arg.startsWith('--'));

  const files =
    named.length > 0
      ? named.map((file) => path.relative(workspaceRoot, path.resolve(file)))
      : fs
          .globSync(SOURCES, { cwd: workspaceRoot, exclude: NOT_PUBLISHED })
          .sort();

  const { results, census, foreign } = checkExamples({
    root: workspaceRoot,
    files,
    mode,
    prelude,
  });

  for (const result of results) {
    for (const diagnostic of result.diagnostics) {
      console.log(formatDiagnostic(diagnostic));
    }
  }

  for (const line of foreign) console.log(line);

  console.log(`\nmode: ${mode}\n${summarize(results, census)}`);

  const failed = results.some((r) => r.diagnostics.length > 0);

  process.exitCode = failed || foreign.length > 0 ? 1 : 0;
};

if (import.meta.main) main();
