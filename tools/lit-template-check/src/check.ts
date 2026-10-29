#!/usr/bin/env node
// Spike: type-checks lit `html` templates over the //#lint:templates file set
// by overlaying each file with its lowered type-check block (see ./lower.ts)
// and asking the TypeScript 7 API for that file's diagnostics in its own
// project. Usage: lit-template-check [--stats] [--dump=<dir>]
import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { WORKSPACE_SRC_GLOB } from '@tools/shared/globs.ts';
import { createFileSystemLayer } from 'typescript/fs';
import { API, DiagnosticCategory, type Diagnostic } from 'typescript/sync';

import {
  type LowerStats,
  lowerFile,
  type Segment,
  toOriginal,
} from './lower.ts';
import { registryFor } from './registry.ts';
import { type FileSites, findSites } from './sites.ts';

type ParsedFile = FileSites & { path: string; source: string };

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
  code: number;
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

function parseFiles(api: API, files: string[]): ParsedFile[] {
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

// the unlowered programs, only to learn which definitions each one holds
function programFilesOf(api: API, openFiles: string[]) {
  const programFiles = new Map<string, Set<string>>();
  const base = api.createSnapshot({ openFiles });

  try {
    for (const path of openFiles) {
      const program = base.getDefaultProjectForFile(path)?.program;

      programFiles.set(path, new Set(program?.getSourceFileNames() ?? []));
    }
  } finally {
    base.dispose();
  }

  return programFiles;
}

function lowerAll(
  parsed: ParsedFile[],
  programFiles: Map<string, Set<string>>,
) {
  const totals: LowerStats = {
    templates: 0,
    lowered: {},
    skipped: {},
    directives: {},
  };

  const defining = parsed.filter((file) => file.definitions.length > 0);
  const unnameable = new Set<string>();
  const lowered: LoweredFile[] = [];

  for (const { path, source, sites, litModule } of parsed) {
    if (sites.length === 0) continue;

    const registry = registryFor(
      path,
      defining,
      programFiles.get(path) ?? new Set(),
    );

    for (const key of registry.unnameable) unnameable.add(key);
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

  return { lowered, totals, unnameable: unnameable.size };
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

  try {
    const parsed = parseFiles(api, files);

    const programFiles = programFilesOf(
      api,
      parsed.filter((file) => file.sites.length > 0).map((file) => file.path),
    );

    lowering = lowerAll(parsed, programFiles);
    lowerMs = performance.now() - started;

    if (dumpDir) dump(dumpDir, lowering.lowered);
    checked = checkLowered(api, lowering.lowered);
  } finally {
    api.close();
  }

  const { lowered, totals, unnameable } = lowering;
  const { findings, internal, unmapped } = checked;
  const sources = new Map(lowered.map((file) => [file.path, file.source]));

  findings.sort((a, b) => a.path.localeCompare(b.path) || a.offset - b.offset);

  for (const { path, offset, rule, code, text } of findings) {
    const at = lineCol(sources.get(path) ?? '', offset);

    console.log(
      `${relative(workspaceRoot, path)}:${at} ${rule} TS${code}: ${text}`,
    );
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
