#!/usr/bin/env node
// Type-checks lit `html` templates over the //#lint:templates file set
// by overlaying each file with its lowered type-check block (see ./lower.ts)
// and asking the TypeScript 7.1 API for that file's diagnostics in its own
// project. Usage: lint-templates [--stats] [--dump=<dir>]
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
  type Program,
} from 'typescript-7.1/sync';

import {
  type LowerStats,
  lowerFile,
  type Segment,
  toOriginal,
} from './lower.ts';
import { classFindings, propertyInsertions } from './members.ts';
import { type DuplicateTag, registryFor } from './registry.ts';
import { type FileSites, findSites } from './sites.ts';

export type ParsedFile = FileSites & { path: string; source: string };

interface LoweredFile {
  path: string;
  source: string;
  text: string;
  segments: Segment[];
}

export interface Finding {
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

const SCANNED =
  /\b(html|svg|mathml)`|customElement|@property|@internalProperty|observedAttributes/;

// keys of an `HTMLElementTagNameMap` augmentation that name custom elements
const TAG_MAP_KEY = /['"]([a-z][\w.]*-[\w.-]*)['"]\??\s*:/g;

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

    if (!SCANNED.test(source)) continue;
    const retained = api.createSourceFileFromFile(path);

    parsed.push({ path, source, ...findSites(retained.sourceFile) });
    retained.dispose();
  }

  return parsed;
}

type ModuleFacts = Pick<FileSites, 'runtimeSpecifiers' | 'facade'>;

/**
 * Runtime imports as lit-analyzer's no-missing-import follows them: without
 * limit inside the workspace, and one module deep into node_modules, where
 * re-export-only modules don't count.
 */
class ImportGraph {
  readonly #api: API;
  readonly #facts = new Map<string, ModuleFacts>();
  readonly #edges = new Map<string, string[]>();
  readonly #tags = new Map<string, string[]>();

  constructor(api: API, parsed: ParsedFile[]) {
    this.#api = api;

    for (const file of parsed) this.#facts.set(file.path, file);
  }

  facts(path: string): ModuleFacts {
    let facts = this.#facts.get(path);

    if (!facts) {
      const retained = this.#api.createSourceFileFromFile(path);

      facts = findSites(retained.sourceFile);
      retained.dispose();
      this.#facts.set(path, facts);
    }

    return facts;
  }

  edges(project: string, program: Program, path: string): string[] {
    const key = `${project}\0${path}`;
    let edges = this.#edges.get(key);

    if (!edges) {
      edges = this.facts(path).runtimeSpecifiers.flatMap((specifier) => {
        const resolved = program.getResolvedModule(
          path,
          specifier,
          ModuleKind.ESNext,
        );

        return resolved ? [resolved.resolvedFileName] : [];
      });
      this.#edges.set(key, edges);
    }

    return edges;
  }

  reachable(project: string, program: Program, root: string): Set<string> {
    const seen = new Set<string>();

    const visit = (path: string, depth: number): void => {
      if (seen.has(path)) return;
      seen.add(path);
      const external = path.includes('/node_modules/');

      if (external && depth >= 1) return;

      for (const child of this.edges(project, program, path)) {
        const entering = !external && child.includes('/node_modules/');
        const next = entering ? 1 : depth + 1;

        visit(child, this.facts(child).facade ? next - 1 : next);
      }
    };

    visit(root, 0);

    return seen;
  }

  /** Custom tags a file's `HTMLElementTagNameMap` augmentations declare. */
  declaredTags(path: string): string[] {
    let tags = this.#tags.get(path);

    if (!tags) {
      const text = readFileSync(path, 'utf8');

      tags = text.includes('HTMLElementTagNameMap')
        ? [...text.matchAll(TAG_MAP_KEY)].map(([, tag]) => tag)
        : [];
      this.#tags.set(path, tags);
    }

    return tags;
  }
}

export interface Visibility {
  programFiles: Map<string, Set<string>>;
  imports: Map<string, Set<string>>;
  /** Files each open file loads at runtime, itself included. */
  reachable: Map<string, Set<string>>;
  /** Files of each open file's program that declare a custom tag's type. */
  declarers: Map<string, Map<string, string[]>>;
}

// the unlowered programs, to learn which definitions each file can see
export function programFilesOf(
  api: API,
  open: ParsedFile[],
  all: ParsedFile[] = open,
): Visibility {
  const visibility: Visibility = {
    programFiles: new Map(),
    imports: new Map(),
    reachable: new Map(),
    declarers: new Map(),
  };

  const graph = new ImportGraph(api, all);
  const base = api.createSnapshot({ openFiles: open.map((file) => file.path) });

  try {
    for (const { path, specifiers } of open) {
      const project = base.getDefaultProjectForFile(path);
      const program = project?.program;
      const files = new Set(program?.getSourceFileNames() ?? []);

      visibility.programFiles.set(path, files);
      visibility.imports.set(
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

      if (!project || !program) continue;
      visibility.reachable.set(
        path,
        graph.reachable(String(project.id), program, path),
      );
      const declarers = new Map<string, string[]>();

      for (const file of files) {
        for (const tag of graph.declaredTags(file)) {
          declarers.set(tag, [...(declarers.get(tag) ?? []), file]);
        }
      }

      visibility.declarers.set(path, declarers);
    }
  } finally {
    base.dispose();
  }

  return visibility;
}

/** Whether a custom tag's definition is in the file's program but not among its imports. */
function missingImportFor(
  path: string,
  defining: ParsedFile[],
  { programFiles, reachable, declarers }: Visibility,
) {
  const files = programFiles.get(path) ?? new Set();
  const loaded = reachable.get(path);
  const declared = declarers.get(path) ?? new Map<string, string[]>();

  return (tag: string): boolean => {
    if (!loaded) return false;

    const definers = [
      ...(declared.get(tag) ?? []),
      ...defining.flatMap((file) =>
        (file.path === path || files.has(file.path)) &&
        file.definitions.some((definition) => definition.tag === tag)
          ? [file.path]
          : [],
      ),
    ];

    return definers.length > 0 && !definers.some((file) => loaded.has(file));
  };
}

export function lowerAll(parsed: ParsedFile[], visibility: Visibility) {
  const { programFiles, imports } = visibility;

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

  for (const { path, source, sites, litModule, members } of parsed) {
    const insertions = propertyInsertions(path, members);

    if (sites.length === 0 && insertions.length === 0) continue;

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

    const result = lowerFile(source, sites, litModule, {
      ...registry,
      missingImport: missingImportFor(path, defining, visibility),
      insertions,
    });

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

const REPORTED =
  /Argument of type '(?:true|boolean)' is not assignable to parameter of type '(.*)'\.?$/s;

/** The message a `report` atom's parameter type carries. */
function reportText(text: string): string {
  const type = REPORTED.exec(text)?.[1];

  if (type === undefined) return text;
  const expected = /^\{ expected: (.*); got: (.*); \}$/s.exec(type);

  if (expected) {
    return `Type '${expected[2]}' is not assignable to '${expected[1]}'`;
  }

  if (/^".*"$/s.test(type)) {
    try {
      return String(JSON.parse(type));
    } catch {
      return type.slice(1, -1);
    }
  }

  return text;
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
  } else if (mapped.segment.report && REPORTED.test(diagnostic.text)) {
    result.findings.push({
      path: file.path,
      offset: mapped.offset,
      rule: mapped.segment.rule ?? 'report',
      text: reportText(diagnostic.text),
    });
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

/** Every finding over `files`, with the lowering that produced them. */
export function checkFiles(
  api: API,
  files: string[],
  { dumpDir }: { dumpDir?: string } = {},
) {
  const started = performance.now();
  const parsed = parseFiles(api, files);

  const visibility = programFilesOf(
    api,
    parsed.filter((file) => file.sites.length > 0),
    parsed,
  );

  const lowering = lowerAll(parsed, visibility);
  const lowerMs = performance.now() - started;

  if (dumpDir) dump(dumpDir, lowering.lowered);
  const checked = checkLowered(api, lowering.lowered);
  const findings = [...checked.findings];

  for (const { tag, path, start, first } of lowering.duplicates) {
    findings.push({
      path,
      offset: start,
      rule: 'duplicate-tag',
      text: `<${tag}> is already defined in ${relative(workspaceRoot, first)}`,
    });
  }

  for (const file of parsed) {
    for (const { start, rule, text } of classFindings(
      file.members,
      file.observedAttributes,
      file.definitions,
    )) {
      findings.push({ path: file.path, offset: start, rule, text });
    }
  }

  findings.sort((a, b) => a.path.localeCompare(b.path) || a.offset - b.offset);

  return { parsed, lowering, checked, findings, lowerMs };
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
  let result: ReturnType<typeof checkFiles>;

  try {
    result = checkFiles(api, files, { dumpDir });
  } finally {
    api.close();
  }

  const { parsed, lowering, checked, findings, lowerMs } = result;
  const { lowered, totals, unnameable } = lowering;
  const { internal, unmapped } = checked;
  const sources = new Map(parsed.map((file) => [file.path, file.source]));

  for (const { path, offset, rule, code, text } of findings) {
    const at = lineCol(sources.get(path) ?? '', offset);

    const source = code === undefined ? rule : `${rule} TS${code}`;

    console.log(`${relative(workspaceRoot, path)}:${at} ${source}: ${text}`);
  }

  for (const line of internal) console.error(`internal: ${line}`);

  if (showStats) {
    const stats = {
      files: files.length,
      filesLowered: lowered.length,
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
    `${findings.length} problem${plural} in ${lowered.length} lowered files (${files.length} checked)`,
  );

  if (findings.length > 0 || internal.length > 0) process.exitCode = 1;
};

if (import.meta.main) main();
