// Pure logic for the packed-manifest check — no filesystem or pnpm here, so
// every unit is directly testable with plain fixtures (see check-pack.test.mjs).
// The IO (enumerating publishable packages, running `pnpm pack`, extracting
// the packed package.json) lives in check-pack.mjs.

import { DEP_FIELDS } from './check-catalog.core.mjs';

// Specifier protocols pnpm must substitute at pack time. The npm registry
// accepts a manifest that still contains them, but consumers then fail with
// EUNSUPPORTEDPROTOCOL — so a leak here means every publish is broken.
const UNSUBSTITUTED_PREFIXES = ['catalog:', 'workspace:'];

/**
 * Declaration sites in a packed manifest whose specifier was not substituted.
 * @param {object} manifest parsed package.json from inside the packed tarball
 * @returns {Array<{ field: string, dep: string, spec: string }>}
 */
export function findUnsubstitutedRefs(manifest) {
  const refs = [];
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

/**
 * Render the human-readable report.
 * @param {Array<{ name: string, dir: string, refs: Array<{ field: string, dep: string, spec: string }> }>} results
 * @returns {{ ok: boolean, text: string }}
 */
export function formatReport(results) {
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
