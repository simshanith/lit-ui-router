// Pure logic for the packed-manifest check — no filesystem or pnpm here, so
// every unit is directly testable with plain fixtures (see check-pack.test.ts).
// The IO (enumerating publishable packages, running `pnpm pack`, extracting
// the packed package.json) lives in check-pack.ts.

import type { PackageManifest } from '@tools/bootstrap/types.ts';

import { STRIPPED_MANIFEST_FIELDS } from '../steps/release-pack.core.ts';
import { DEP_FIELDS, type DepField, type Report } from './types.ts';

// Specifier protocols pnpm must substitute at pack time. The npm registry
// accepts a manifest that still contains them, but consumers then fail with
// EUNSUPPORTEDPROTOCOL — so a leak here means every publish is broken.
const UNSUBSTITUTED_PREFIXES = ['catalog:', 'workspace:'];

// A specifier pnpm should have substituted at pack time but left in place.
export type UnsubstitutedRef = { field: DepField; dep: string; spec: string };

/**
 * Declaration sites in a packed manifest whose specifier was not substituted.
 * `manifest` is the parsed package.json from inside the packed tarball.
 */
export function findUnsubstitutedRefs(
  manifest: PackageManifest | undefined,
): UnsubstitutedRef[] {
  const refs: UnsubstitutedRef[] = [];

  for (const field of DEP_FIELDS) {
    for (const [dep, spec] of Object.entries(manifest?.[field] ?? {})) {
      // The type says string; the bytes come from a tarball, so say which
      // declaration disagreed rather than dying inside String.prototype.trim.
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the error names the JSON type that arrived where the manifest type promises a string
      const kind = typeof spec;

      if (kind !== 'string') {
        throw new TypeError(
          `${field}.${dep}: specifier is ${kind}, not a string`,
        );
      }

      if (!UNSUBSTITUTED_PREFIXES.some((p) => spec.trim().startsWith(p))) {
        continue;
      }

      refs.push({ field, dep, spec });
    }
  }

  return refs;
}

export type PackResult = {
  name: string;
  dir: string;
  refs: UnsubstitutedRef[];
};

/** Render the human-readable report. */
export function formatReport(results: PackResult[]): Report {
  if (results.length === 0) {
    return {
      ok: false,
      text: '✗ pack check failed — no publishable workspace packages found (broken workspace globs?).',
    };
  }

  const bad = results.filter((result) => result.refs.length > 0);

  if (bad.length === 0) {
    return {
      ok: true,
      text:
        `✓ pack check passed — ${results.length} publishable packages, ` +
        `all packed manifests fully substituted.`,
    };
  }

  const lines = [
    `✗ pack check failed — packed manifests contain catalog:/workspace: ` +
      `refs npm cannot resolve (publishing would break consumers):`,
    '',
  ];

  for (const { name, dir, refs } of bad) {
    lines.push(`  ${name} (${dir})`);

    for (const { field, dep, spec } of refs) {
      lines.push(`      • ${field.padEnd(20)} ${dep.padEnd(30)} ${spec}`);
    }

    lines.push('');
  }

  return { ok: false, text: lines.join('\n') };
}

// ── Packed-manifest gate (publish workflow) ─────────────────────────────────
// The Pack step strips STRIPPED_MANIFEST_FIELDS before `pnpm pack`, then
// re-checks the tarball it is about to hand release-it. These checks are that
// gate.

/**
 * Violations in the manifest npm would publish, as human-readable strings.
 *
 * Semantics match the inline workflow check this replaces:
 * - Every {@link STRIPPED_MANIFEST_FIELDS} field must be absent — a
 *   present-but-empty object still fails, because the strip step should have
 *   deleted the key.
 * - No `catalog:`/`workspace:` anywhere in the serialized runtime dependency
 *   fields. Deliberately blunter than {@link findUnsubstitutedRefs}: a
 *   substring test instead of a prefix test, because at publish time ANY
 *   trace of those protocols ships a broken release (the 1.3.0–1.5.0 class).
 *   devDependencies are not scanned — their mere presence already fails.
 */
export function findPackedManifestViolations(
  manifest: PackageManifest,
): string[] {
  const violations: string[] = [];

  for (const field of STRIPPED_MANIFEST_FIELDS) {
    if (manifest[field]) {
      violations.push(`${field} leaked into packed manifest`);
    }
  }

  const runtime = JSON.stringify([
    manifest.dependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ]);

  if (/catalog:|workspace:/.test(runtime)) {
    violations.push('unsubstituted refs in packed manifest');
  }

  return violations;
}

/** Render the packed-manifest report. */
export function formatPackedManifestReport(violations: string[]): Report {
  if (violations.length === 0) {
    return { ok: true, text: '✓ packed manifest clean' };
  }

  const lines = [
    '✗ packed manifest check failed — this tarball must not be published:',
    ...violations.map((violation) => `  • ${violation}`),
  ];

  return { ok: false, text: lines.join('\n') };
}

// ── Packed-file graph ───────────────────────────────────────────────────────
// @tools/oxc-emit inlines private @repo/* source into dist/ and rewrites the
// imports. These checks prove the tarball holds what its emitted files reach.

// Emitted code and declarations; src/*.ts ships only as sourcemap referents.
const EMITTED = /\.(?:js|mjs|cjs|d\.ts|d\.mts|d\.cts)$/;

// Static `from "x"`, bare `import "x"`, and dynamic `import("x")`.
const SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+)["']/g;

/** A sourcemap's sources and embedded contents, as the packed bytes hold them. */
export interface PackedMap {
  readonly sources?: readonly (string | null)[];
  readonly sourcesContent?: readonly (string | null)[];
}

/** One packed text file, by its path under `package/`. */
export interface PackedFile {
  readonly path: string;
  readonly text: string;
}

const posixJoin = (from: string, to: string): string => {
  const parts: string[] = [];

  for (const part of `${from}/${to}`.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.' && part !== '') parts.push(part);
  }

  return parts.join('/');
};

const dirOf = (path: string): string => path.split('/').slice(0, -1).join('/');

/** A relative specifier resolves when its target, or a declaration for it, is packed. */
function resolves(packed: ReadonlySet<string>, from: string, spec: string) {
  const target = posixJoin(dirOf(from), spec);
  const declaration = target.replace(/\.(m|c)?js$/, '.d.$1ts');

  return packed.has(target) || packed.has(declaration);
}

function importProblems(
  file: PackedFile,
  packed: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];

  for (const [, spec] of file.text.matchAll(SPECIFIER)) {
    if (spec === undefined) continue;

    if (spec.startsWith('@repo/')) {
      problems.push(`${file.path}: imports private ${spec}`);
    } else if (spec.startsWith('.') && !resolves(packed, file.path, spec)) {
      problems.push(`${file.path}: imports ${spec}, which is not packed`);
    }
  }

  return problems;
}

function mapProblems(
  path: string,
  map: PackedMap,
  packed: ReadonlySet<string>,
): string[] {
  return (map.sources ?? []).flatMap((source, index) => {
    if (source === null) return [];

    const embedded = (map.sourcesContent?.[index] ?? null) !== null;

    return embedded || packed.has(posixJoin(dirOf(path), source))
      ? []
      : [`${path}: source ${source} is neither packed nor embedded`];
  });
}

/**
 * Packed files whose imports or sourcemaps reach outside the tarball.
 * `paths` lists every packed file; `files` the text of the ones to scan.
 * `maps` holds each parsed `.map` by path.
 */
export function findPackedFileProblems(
  paths: readonly string[],
  files: readonly PackedFile[],
  maps: ReadonlyMap<string, PackedMap>,
): string[] {
  const packed = new Set(paths);

  return [
    ...files
      .filter((file) => EMITTED.test(file.path))
      .flatMap((file) => importProblems(file, packed)),
    ...[...maps].flatMap(([path, map]) => mapProblems(path, map, packed)),
  ];
}

/** Render the packed-file report: one block per package with problems. */
export function formatFileReport(
  results: readonly { name: string; problems: readonly string[] }[],
): Report {
  const bad = results.filter((result) => result.problems.length > 0);

  if (bad.length === 0) {
    return {
      ok: true,
      text: `✓ packed files check passed — every emitted import and sourcemap source resolves inside its tarball.`,
    };
  }

  const lines = [
    '✗ packed files check failed — emitted files reach outside their tarball:',
    '',
  ];

  for (const { name, problems } of bad) {
    lines.push(`  ${name}`);

    for (const problem of problems) lines.push(`      • ${problem}`);
    lines.push('');
  }

  return { ok: false, text: lines.join('\n') };
}
