// Pure logic for the packed-manifest check — no filesystem or pnpm here, so
// every unit is directly testable with plain fixtures (see check-pack.test.ts).
// The IO (enumerating publishable packages, running `pnpm pack`, extracting
// the packed package.json) lives in check-pack.ts.

import type { PackageManifest } from '@tools/shared/types.ts';

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
      if (typeof spec !== 'string') continue;
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
// The publish workflow strips devDependencies and scripts before `pnpm pack`
// (dev-only metadata that leaks private workspace names and monorepo-only
// commands into the published manifest), then re-checks the tarball it is
// about to hand release-it. These checks are that gate.

/**
 * The manifest fields publish-npm.yml's Pack step deletes before `pnpm pack`
 * (`npm pkg delete ...STRIPPED_MANIFEST_FIELDS`). The single source of truth
 * for the strip: the packed-manifest gate fails when any of them survive, and
 * anything reproducing the Pack step (e.g. check-published-diff) should build
 * its delete args from this list.
 */
export const STRIPPED_MANIFEST_FIELDS = ['devDependencies', 'scripts'] as const;

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
