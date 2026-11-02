// Copied from @tools/md-content-mapper (#1663) until one of the two lands.
// `paths` stands in for a consumer's node_modules; paths skips package.json
// exports, so each export's TypeScript target is mapped by hand.
import fs from 'node:fs';
import path from 'node:path';

import * as v from 'valibot';

import type { ExportsTarget } from '@tools/bootstrap/types.ts';

const ExportsSchema: v.GenericSchema<ExportsTarget> = v.lazy(() =>
  v.union([
    v.string(),
    v.null(),
    v.array(ExportsSchema),
    v.record(v.string(), ExportsSchema),
  ]),
);

const ManifestSchema = v.object({
  name: v.optional(v.string()),
  exports: v.optional(ExportsSchema),
});

/** `compilerOptions.paths`: a specifier pattern to the files it resolves to. */
export type CompilerPaths = Map<string, string[]>;

const CONDITIONS = ['types', 'import', 'default', 'node', 'browser'];

/** A TypeScript target, or the `.d.ts` sibling TypeScript would find beside a JS target. */
const typesTarget = (target: ExportsTarget): string | undefined => {
  if (v.is(v.string(), target)) {
    if (/\.[cm]?tsx?$/.test(target)) return target;

    return /\.[cm]?js$/.test(target)
      ? target.replace(/\.([cm]?)js$/, '.d.$1ts')
      : undefined;
  }

  if (target === null) return undefined;

  if (Array.isArray(target)) return target.map(typesTarget).find(Boolean);

  return CONDITIONS.flatMap((key) =>
    key in target ? [typesTarget(target[key])] : [],
  ).find(Boolean);
};

const readManifest = (dir: string): v.InferOutput<typeof ManifestSchema> => {
  const file = path.join(dir, 'package.json');

  return fs.existsSync(file)
    ? v.parse(ManifestSchema, JSON.parse(fs.readFileSync(file, 'utf8')))
    : {};
};

const subpathsOf = (exports: ExportsTarget): [string, ExportsTarget][] => {
  if (v.is(v.record(v.string(), ExportsSchema), exports)) {
    const entries = Object.entries(exports);

    return entries.every(([key]) => key.startsWith('.'))
      ? entries
      : [['.', exports]];
  }

  return [['.', exports]];
};

/** The `paths` entries a consumer with `dir` installed as `name` would resolve to. */
export const packagePaths = (name: string, dir: string): CompilerPaths => {
  const { exports } = readManifest(dir);

  if (exports === undefined) {
    return new Map([
      [name, [dir]],
      [`${name}/*`, [path.join(dir, '*')]],
    ]);
  }

  return new Map(
    subpathsOf(exports).flatMap(([subpath, target]): [string, string[]][] => {
      const types = typesTarget(target);

      return types
        ? [[`${name}${subpath.slice(1)}`, [path.join(dir, types)]]]
        : [];
    }),
  );
};

const installed = (nodeModules: string): [string, string][] =>
  fs.readdirSync(nodeModules).flatMap((entry): [string, string][] => {
    if (entry.startsWith('.')) return [];

    if (!entry.startsWith('@')) return [[entry, path.join(nodeModules, entry)]];

    return fs
      .readdirSync(path.join(nodeModules, entry))
      .map((scoped) => [
        `${entry}/${scoped}`,
        path.join(nodeModules, entry, scoped),
      ]);
  });

/**
 * `paths` for every workspace package under `packages/`, then every package
 * installed in a workspace member; the first install of a name wins.
 */
export const workspacePaths = (root: string): CompilerPaths => {
  const packages = fs
    .globSync('packages/*/package.json', { cwd: root })
    .map((manifest) => path.join(root, path.dirname(manifest)))
    .flatMap((dir): [string, string][] => {
      const { name } = readManifest(dir);

      return name ? [[name, dir]] : [];
    });

  const dependencies = fs
    .globSync('{packages,apps,www}/*/node_modules', { cwd: root })
    .flatMap((nodeModules) => installed(path.join(root, nodeModules)));

  const seen = new Set<string>();

  const paths: CompilerPaths = new Map();

  for (const [name, dir] of [...packages, ...dependencies]) {
    if (seen.has(name)) continue;

    seen.add(name);

    for (const [pattern, targets] of packagePaths(name, dir)) {
      paths.set(pattern, targets);
    }
  }

  return paths;
};
