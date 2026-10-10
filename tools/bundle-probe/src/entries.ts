import { existsSync } from 'node:fs';
import path from 'node:path';

import { requireManifest } from '@tools/bootstrap/manifest.ts';
import type { ExportsTarget } from '@tools/bootstrap/types.ts';

export type PackageEntry = {
  label: string;
  file: string;
  // packages this entry claims to bundle without; see free-of.ts
  free: string[];
};

/** An exports target that is a path, not conditions, a fallback list, or null. */
const isTargetPath = (target: ExportsTarget | undefined): target is string =>
  typeof target === 'string';

// The `bundleProbe` manifest field: per-subpath boundary claims.
export type BundleProbeClaims = Readonly<
  Record<string, { readonly free?: readonly string[] }>
>;

export type PackageProbe = {
  name: string;
  declared: string[];
  entries: PackageEntry[];
};

// The exports map is the single source of truth for what gets probed: a new
// export joins the invariant checks and the codecov series without touching
// any script. Rules: './package.json', wildcard patterns, and non-JS targets
// are skipped; './src/*.ts' targets bundle as-is; './dist/*.js' targets map
// back to the sibling './src/*.ts'; anything else fails loudly. Labels come
// from the subpath ('.' labels index), naming the <prefix>-<label>-esm series.
//
// The optional `bundleProbe` manifest field carries the per-entry boundary
// claims, keyed by the same subpath the exports map uses:
//   "bundleProbe": { "./context": { "free": ["lit"] } }
// eslint-disable-next-line complexity -- one linear pass over the exports map; splitting it scatters the mapping rules above
export const readPackageProbe = (packageDir: string): PackageProbe => {
  const manifest = requireManifest(packageDir);
  const name = manifest.name;

  if (name === undefined) {
    throw new Error(`${packageDir}: package.json has no name`);
  }

  const declared = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ];

  // SAFETY: bundleProbe, when present, is hand-authored as BundleProbeClaims
  const claims = (manifest as { bundleProbe?: BundleProbeClaims }).bundleProbe;

  const entries: PackageEntry[] = [];
  const bundled = new Set<string>();

  for (const [subpath, value] of Object.entries(manifest.exports ?? {})) {
    if (subpath === './package.json' || subpath.includes('*')) continue;

    const target = isTargetPath(value)
      ? value
      : value === null || Array.isArray(value)
        ? undefined
        : value.default;

    if (!isTargetPath(target)) {
      throw new Error(`${name}: export '${subpath}' has no default target`);
    }

    if (!/\.(js|ts)$/.test(target)) continue;

    const source = target.startsWith('./src/')
      ? target
      : target.replace(/^\.\/dist\/(.+)\.js$/, './src/$1.ts');

    if (!source.startsWith('./src/')) {
      throw new Error(
        `${name}: cannot map export '${subpath}' target '${target}' to a source file`,
      );
    }

    const file = path.join(packageDir, source);

    if (!existsSync(file)) {
      throw new Error(
        `${name}: export '${subpath}' resolves to missing ${source}`,
      );
    }

    const free = claims?.[subpath]?.free;
    bundled.add(subpath);
    entries.push({
      label: subpath === '.' ? 'index' : subpath.slice(2),
      file,
      free: [...(free ?? [])],
    });
  }

  if (entries.length === 0) {
    throw new Error(`${name}: no bundleable exports found`);
  }

  // A claim on an export the loop skipped would otherwise pass unchecked.
  for (const subpath of Object.keys(claims ?? {})) {
    if (!bundled.has(subpath)) {
      throw new Error(
        `${name}: bundleProbe names '${subpath}', which is not a bundled export`,
      );
    }
  }

  return { name, declared, entries };
};
