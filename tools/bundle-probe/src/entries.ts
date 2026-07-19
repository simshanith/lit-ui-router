import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type PackageEntry = { label: string; file: string };

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
export const readPackageProbe = async (
  packageDir: string,
): Promise<PackageProbe> => {
  const manifest = JSON.parse(
    await readFile(path.join(packageDir, 'package.json'), 'utf8'),
  ) as {
    name: string;
    exports?: Record<string, unknown>;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  const declared = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ];
  const entries: PackageEntry[] = [];
  for (const [subpath, value] of Object.entries(manifest.exports ?? {})) {
    if (subpath === './package.json' || subpath.includes('*')) continue;
    const target =
      typeof value === 'string'
        ? value
        : (value as Record<string, unknown>).default;
    if (typeof target !== 'string') {
      throw new Error(
        `${manifest.name}: export '${subpath}' has no default target`,
      );
    }
    if (!/\.(js|ts)$/.test(target)) continue;
    const source = target.startsWith('./src/')
      ? target
      : target.replace(/^\.\/dist\/(.+)\.js$/, './src/$1.ts');
    if (!source.startsWith('./src/')) {
      throw new Error(
        `${manifest.name}: cannot map export '${subpath}' target '${target}' to a source file`,
      );
    }
    const file = path.join(packageDir, source);
    if (!existsSync(file)) {
      throw new Error(
        `${manifest.name}: export '${subpath}' resolves to missing ${source}`,
      );
    }
    entries.push({ label: subpath === '.' ? 'index' : subpath.slice(2), file });
  }
  if (entries.length === 0) {
    throw new Error(`${manifest.name}: no bundleable exports found`);
  }
  return { name: manifest.name, declared, entries };
};
