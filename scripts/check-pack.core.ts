// Pure logic for the packed-manifest check — no filesystem or pnpm here, so
// every unit is directly testable with plain fixtures (see check-pack.test.ts).
// The IO (enumerating publishable packages, running `pnpm pack`, extracting
// the packed package.json) lives in check-pack.ts.

import {
  DEP_FIELDS,
  type DepField,
  type PackageManifest,
  type Report,
} from './types.ts';

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
