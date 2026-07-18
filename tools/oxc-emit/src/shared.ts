import { globSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, relative } from 'node:path';

export const SRC = 'src';
export const OUT = 'dist';

export const fail = (file: string, errors: { message: string }[]): never => {
  throw new Error(
    `${file}: ${errors.map((error) => error.message).join('\n')}`,
  );
};

// From the consuming package's root; excludes mirror its tsconfig.src.
export function publishableSources(): string[] {
  return globSync(`${SRC}/**/*.ts`, {
    exclude: [`${SRC}/**/*.spec.ts`, `${SRC}/specs/**`],
  });
}

// remapping ships CJS function-as-module.exports; typed locally, fetched via require
interface RawMap {
  sources?: (string | null)[];
}
interface ComposedMap {
  sources: string[];
  file: string;
  toString(): string;
}
const remapping = createRequire(import.meta.url)('@ampproject/remapping') as (
  map: RawMap,
  loader: (source: string) => RawMap | null,
  options: { excludeContent: boolean },
) => ComposedMap;

// Compose an emit stage's map (or chain of two) into the shipped map for `out`:
// single relative src source, no sourcesContent — the shipped src/ files are the referents.
export function shippedMap(
  file: string,
  out: string,
  finalMap: RawMap,
  priorMap?: RawMap,
): string {
  const map = remapping(
    finalMap,
    (source) => (priorMap && source === file ? priorMap : null),
    { excludeContent: true },
  );
  // exactly one original source; remapping's own resolution double-prefixes relative paths
  map.sources = [relative(dirname(out), file)];
  map.file = basename(out);
  return map.toString();
}
