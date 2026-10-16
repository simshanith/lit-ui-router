import { existsSync, realpathSync } from 'node:fs';
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

// The `bundleProbe` manifest field: per-subpath boundary claims, and the
// export conditions whose targets also probe, under the same claims.
export type BundleProbeClaims = Readonly<
  Record<
    string,
    {
      readonly free?: readonly string[];
      readonly conditions?: readonly string[];
    }
  >
>;

export type PackageProbe = {
  name: string;
  declared: string[];
  // dirs of the @repo/* devDependencies that @tools/oxc-emit inlines into dist/
  inlined: string[];
  entries: PackageEntry[];
};

// A conditioned target probes like a default one: a built file under dist/.
const conditionFile = (
  name: string,
  packageDir: string,
  subpath: string,
  value: ExportsTarget,
  condition: string,
): string => {
  const target =
    value === null || Array.isArray(value) || isTargetPath(value)
      ? undefined
      : value[condition];

  if (!isTargetPath(target) || !/^\.\/dist\/.*\.js$/.test(target)) {
    throw new Error(
      `${name}: bundleProbe condition '${condition}' on '${subpath}' names no dist/*.js target`,
    );
  }

  const file = path.join(packageDir, target);

  if (!existsSync(file)) {
    throw new Error(
      `${name}: export '${subpath}' condition '${condition}' resolves to missing ${target}; run build:js first`,
    );
  }

  return file;
};

// The default target's entry, then one per claimed condition, all under the subpath's free claims.
const subpathEntries = (
  name: string,
  packageDir: string,
  subpath: string,
  value: ExportsTarget,
  file: string,
  claim: BundleProbeClaims[string] | undefined,
): PackageEntry[] => {
  const free = [...(claim?.free ?? [])];
  const label = subpath === '.' ? 'index' : subpath.slice(2);

  return [
    { label, file, free },
    ...(claim?.conditions ?? []).map((condition) => ({
      label: `${label}-${condition}`,
      file: conditionFile(name, packageDir, subpath, value, condition),
      free,
    })),
  ];
};

// The exports map is the single source of truth for what gets probed: a new
// export joins the invariant checks and the codecov series without touching
// any script. Rules: './package.json', wildcard patterns, and non-JS targets
// are skipped; './src/*.ts' and './dist/*.js' targets bundle as-is, so a dist
// entry probes the emit consumers install (build:js runs first); anything
// else fails loudly. Labels come
// from the subpath ('.' labels index), naming the <prefix>-<label>-esm series.
//
// The optional `bundleProbe` manifest field carries the per-entry boundary
// claims, keyed by the same subpath the exports map uses:
//   "bundleProbe": { "./context": { "free": ["lit"] } }
// `conditions` adds the target of each named condition as a further entry,
// labelled <label>-<condition>:
//   "bundleProbe": { ".": { "free": ["lit"], "conditions": ["node"] } }
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

  const inlined = Object.keys(manifest.devDependencies ?? {})
    .filter((dependency) => dependency.startsWith('@repo/'))
    .map((dependency) =>
      realpathSync(path.join(packageDir, 'node_modules', dependency)),
    );

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

    if (!/^\.\/(src|dist)\//.test(target)) {
      throw new Error(
        `${name}: export '${subpath}' target '${target}' is outside src/ and dist/`,
      );
    }

    const file = path.join(packageDir, target);

    if (!existsSync(file)) {
      throw new Error(
        `${name}: export '${subpath}' resolves to missing ${target}; run build:js first`,
      );
    }

    bundled.add(subpath);
    entries.push(
      ...subpathEntries(
        name,
        packageDir,
        subpath,
        value,
        file,
        claims?.[subpath],
      ),
    );
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

  return { name, declared, inlined, entries };
};
