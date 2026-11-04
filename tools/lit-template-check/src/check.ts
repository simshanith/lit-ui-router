#!/usr/bin/env node
// Type-checks lit `html` templates over the //#lint:templates file set
// by overlaying each file with its lowered type-check block (see ./lower.ts)
// and asking the TypeScript 7.1 API for that file's diagnostics in its own
// project. Usage: lit-template-check [--stats] [--dump=<dir>]
import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { WORKSPACE_SRC_GLOB } from '@tools/shared/globs.ts';
import { createFileSystemLayer } from 'typescript-7.1/fs';
import {
  API,
  DiagnosticCategory,
  type Diagnostic,
  ModuleKind,
} from 'typescript-7.1/sync';

import {
  type LowerStats,
  lowerFile,
  type Segment,
  toOriginal,
} from './lower.ts';
import { type DuplicateTag, registryFor } from './registry.ts';
import { type FileSites, findSites } from './sites.ts';

export type ParsedFile = FileSites & { path: string; source: string };

interface LoweredFile {
  path: string;
  source: string;
  text: string;
  segments: Segment[];
}

interface Finding {
  path: string;
  offset: number;
  rule: string;
  /** Absent for findings the tool reports itself. */
  code?: number;
  text: string;
}

interface CheckResult {
  findings: Finding[];
  internal: string[];
  unmapped: number;
}

const ERROR: number = DiagnosticCategory.Error;

const addCounts = (
  into: Record<string, number>,
  from: Record<string, number>,
) => {
  for (const [key, count] of Object.entries(from)) {
    into[key] = (into[key] ?? 0) + count;
  }
};

const lineCol = (source: string, offset: number) => {
  const before = source.slice(0, offset).split('\n');

  return `${before.length}:${(before.at(-1) ?? '').length + 1}`;
};

// UTF-16 offset of a diagnostic in the text the server checked
const virtualOffset = (text: string, diagnostic: Diagnostic): number => {
  const start = diagnostic.startPosition;

  if (!start) return diagnostic.pos;
  let offset = 0;

  for (let line = 0; line < start.line; line += 1) {
    offset = text.indexOf('\n', offset) + 1;
  }

  return offset + start.character;
};

export function parseFiles(api: API, files: string[]): ParsedFile[] {
  const parsed: ParsedFile[] = [];

  for (const path of files) {
    const source = readFileSync(path, 'utf8');

    if (!/\b(html|svg|mathml)`|customElement/.test(source)) continue;
    const retained = api.createSourceFileFromFile(path);

    parsed.push({ path, source, ...findSites(retained.sourceFile) });
    retained.dispose();
  }

  return parsed;
}

// the unlowered programs, only to learn which definitions each file can see
export function programFilesOf(api: API, open: ParsedFile[]) {
  const programFiles = new Map<string, Set<string>>();
  const imports = new Map<string, Set<string>>();
  const base = api.createSnapshot({ openFiles: open.map((file) => file.path) });

  try {
    for (const { path, specifiers } of open) {
      const program = base.getDefaultProjectForFile(path)?.program;

      programFiles.set(path, new Set(program?.getSourceFileNames() ?? []));
      imports.set(
        path,
        new Set(
          specifiers.flatMap((specifier) => {
            const resolved = program?.getResolvedModule(
              path,
              specifier,
              ModuleKind.ESNext,
            );

            return resolved ? [resolved.resolvedFileName] : [];
          }),
        ),
      );
    }
  } finally {
    base.dispose();
  }

  return { programFiles, imports };
}

export function lowerAll(
  parsed: ParsedFile[],
  { programFiles, imports }: ReturnType<typeof programFilesOf>,
) {
  const totals: LowerStats = {
    templates: 0,
    lowered: {},
    skipped: {},
    directives: {},
  };

  const defining = parsed.filter((file) => file.definitions.length > 0);
  const unnameable = new Set<string>();
  const duplicates = new Map<string, DuplicateTag>();
  const lowered: LoweredFile[] = [];

  for (const { path, source, sites, litModule } of parsed) {
    if (sites.length === 0) continue;

    const registry = registryFor(
      path,
      defining,
      programFiles.get(path) ?? new Set(),
      imports.get(path),
    );

    for (const key of registry.unnameable) unnameable.add(key);

    for (const duplicate of registry.duplicates) {
      duplicates.set(`${duplicate.path}#${duplicate.start}`, duplicate);
    }

    const result = lowerFile(source, sites, litModule, registry);

    totals.templates += result.stats.templates;
    addCounts(totals.lowered, result.stats.lowered);
    addCounts(totals.skipped, result.stats.skipped);
    addCounts(totals.directives, result.stats.directives);
    lowered.push({
      path,
      source,
      text: result.text,
      segments: result.segments,
    });
  }

  return {
    lowered,
    totals,
    unnameable: unnameable.size,
    duplicates: [...duplicates.values()],
  };
}

function classify(
  file: LoweredFile,
  diagnostic: Diagnostic,
  result: CheckResult,
) {
  if (diagnostic.category !== ERROR) return;

  const mapped = toOriginal(
    file.segments,
    virtualOffset(file.text, diagnostic),
  );

  if (!mapped) {
    result.unmapped += 1;
  } else if (mapped.segment.kind === 'prelude') {
    result.internal.push(
      `${file.path}: prelude TS${diagnostic.code}: ${diagnostic.text}`,
    );
  } else {
    result.findings.push({
      path: file.path,
      offset: mapped.offset,
      rule: mapped.segment.rule ?? 'suppression',
      code: diagnostic.code,
      text: diagnostic.text,
    });
  }
}

function checkLowered(api: API, lowered: LoweredFile[]): CheckResult {
  const result: CheckResult = { findings: [], internal: [], unmapped: 0 };

  const snapshot = api.createSnapshot({
    openFiles: lowered.map((file) => file.path),
    fileSystem: createFileSystemLayer(
      lowered.map((file) => [file.path, file.text]),
    ),
  });

  try {
    for (const file of lowered) {
      const program = snapshot.getDefaultProjectForFile(file.path)?.program;

      if (!program) {
        result.internal.push(`${file.path}: no project`);
        continue;
      }

      for (const diagnostic of [
        ...program.getSyntacticDiagnostics(file.path),
        ...program.getSemanticDiagnostics(file.path),
      ]) {
        classify(file, diagnostic, result);
      }
    }
  } finally {
    snapshot.dispose();
  }

  return result;
}

function dump(dir: string, lowered: LoweredFile[]) {
  for (const file of lowered) {
    const out = join(dir, relative(workspaceRoot, file.path));

    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, file.text);
  }
}

const main = (): void => {
  const showStats = process.argv.includes('--stats');

  const dumpDir = process.argv
    .find((arg) => arg.startsWith('--dump='))
    ?.slice('--dump='.length);

  const started = performance.now();

  const files = globSync(WORKSPACE_SRC_GLOB, { cwd: workspaceRoot })
    .map((file) => join(workspaceRoot, file))
    .sort();

  if (files.length === 0) {
    console.error(`no files match ${WORKSPACE_SRC_GLOB}`);
    process.exitCode = 2;

    return;
  }

  const api = new API({ cwd: workspaceRoot });
  let lowerMs = 0;
  let lowering: ReturnType<typeof lowerAll>;
  let checked: CheckResult;
  let parsed: ParsedFile[];

  try {
    parsed = parseFiles(api, files);

    const visibility = programFilesOf(
      api,
      parsed.filter((file) => file.sites.length > 0),
    );

    lowering = lowerAll(parsed, visibility);
    lowerMs = performance.now() - started;

    if (dumpDir) dump(dumpDir, lowering.lowered);
    checked = checkLowered(api, lowering.lowered);
  } finally {
    api.close();
  }

  const { lowered, totals, unnameable, duplicates } = lowering;
  const { findings, internal, unmapped } = checked;
  const sources = new Map(parsed.map((file) => [file.path, file.source]));

  for (const { tag, path, start, first } of duplicates) {
    findings.push({
      path,
      offset: start,
      rule: 'duplicate-tag',
      text: `<${tag}> is already defined in ${relative(workspaceRoot, first)}`,
    });
  }

  findings.sort((a, b) => a.path.localeCompare(b.path) || a.offset - b.offset);

  for (const { path, offset, rule, code, text } of findings) {
    const at = lineCol(sources.get(path) ?? '', offset);

    const source = code === undefined ? rule : `${rule} TS${code}`;

    console.log(`${relative(workspaceRoot, path)}:${at} ${source}: ${text}`);
  }

  for (const line of internal) console.error(`internal: ${line}`);

  if (showStats) {
    const stats = {
      files: files.length,
      filesWithTemplates: lowered.length,
      ...totals,
      unmappedDiagnostics: unmapped,
      unnameableDefinitions: unnameable,
      lowerMs: Math.round(lowerMs),
      totalMs: Math.round(performance.now() - started),
    };

    console.log(JSON.stringify(stats, null, 2));
  }

  const plural = findings.length === 1 ? '' : 's';

  console.log(
    `${findings.length} problem${plural} in ${lowered.length} files with templates (${files.length} checked)`,
  );

  if (findings.length > 0 || internal.length > 0) process.exitCode = 1;
};

if (import.meta.main) main();
