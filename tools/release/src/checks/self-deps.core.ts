// Pure logic for the static-edges-vs-dynamic-discovery guard: the check:*
// turbo tasks hash the packed packages through ^build, which only covers
// packages declared in @tools/release's own manifest — an undeclared
// publishable package would get stale cached verdicts. The IO (reading this
// package's manifest) lives in ./self-deps.ts.

import { DEP_FIELDS } from './types.ts';
import type { PackageManifest } from '@tools/shared/types.ts';

/** Publishable member names absent from every dependency field of `manifest`. */
export function undeclaredMembers(
  publishable: string[],
  manifest: PackageManifest,
): string[] {
  const declared = new Set(
    DEP_FIELDS.flatMap((field) => Object.keys(manifest[field] ?? {})),
  );
  return publishable.filter((name) => !declared.has(name)).sort();
}

/** Error text telling the maintainer exactly which devDeps to add. */
export function formatUndeclared(missing: string[]): string {
  return (
    `publishable package(s) not declared in tools/release/package.json: ${missing.join(', ')}. ` +
    'Add each as a "workspace:*" devDependency of @tools/release — the check:pack and ' +
    'check:published-diff turbo tasks hash packed packages via ^build, so an undeclared ' +
    'package silently gets stale cached verdicts.'
  );
}
