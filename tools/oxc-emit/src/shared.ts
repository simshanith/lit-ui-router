import { globSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, relative } from 'node:path';

import {
  assertNoCollision,
  inlinedSources,
  type InlinedSource,
} from './inline.ts';

export const SRC = 'src';

export const OUT = 'dist';

// Second JS emit for packages that ship the `development` export condition.
// Types are NOT duplicated here: every subpath puts `types` ahead of
// `development`, so TS resolves the one d.ts under any condition set.
export const DEV_OUT = 'dist/development';

// Third JS emit, for packages that also ship the `node` condition: development
// warnings that read `process.env.NODE_ENV` at runtime instead of folding.
export const NODE_OUT = 'dist/node';

// The build-time constant the guarded warning sites read. Vite/vitest supply it
// unconfigured, so specs exercise the development branch as-is.
export const DEV_DEFINE_KEY = 'import.meta.env.DEV';

// `true` only in the --node pass, so its runtime NODE_ENV checks fold out of the others.
export const NODE_DEFINE_KEY = 'import.meta.env.NODE';

// The manifest version, defined only for sources that read it.
export const VERSION_DEFINE_KEY = 'import.meta.env.PACKAGE_VERSION';

// Undefined when empty: any define turns on oxc's define plugin, which rewrites unrelated code.
export function passDefine(
  source: string,
  version: string | undefined,
  dev: string | undefined,
  node?: string,
): Record<string, string> | undefined {
  const define: Record<string, string> = {};

  if (version !== undefined && source.includes(VERSION_DEFINE_KEY)) {
    define[VERSION_DEFINE_KEY] = JSON.stringify(version);
  }

  if (dev !== undefined) define[DEV_DEFINE_KEY] = dev;

  if (node !== undefined) define[NODE_DEFINE_KEY] = node;

  return Object.keys(define).length > 0 ? define : undefined;
}

export const fail = (file: string, errors: { message: string }[]): never => {
  throw new Error(
    `${file}: ${errors.map((error) => error.message).join('\n')}`,
  );
};

// From the consuming package's root; excludes mirror its tsconfig.src.
export function publishableSources(): string[] {
  return globSync(`${SRC}/**/*.ts`, {
    exclude: [`${SRC}/**/*.spec.ts`, `${SRC}/specs/**`, `${SRC}/**/*.d.ts`],
  });
}

/** One emitted file: its source and its path under the out dir, without extension. */
export interface EmitUnit {
  readonly file: string;
  readonly stem: string;
  /** Canonical `@repo/*` source; its map embeds the text, which no tarball ships. */
  readonly inlined: boolean;
}

/** Every file both passes emit, and the specifiers they rewrite. */
export interface EmitPlan {
  readonly units: EmitUnit[];
  readonly inlined: InlinedSource[];
}

/** The package's own sources plus the `@repo/*` sources it inlines. */
export function emitPlan(): EmitPlan {
  const own = publishableSources().map((file) => ({
    file,
    stem: relative(SRC, file).replace(/\.ts$/, ''),
    inlined: false,
  }));

  const inlined = inlinedSources(process.cwd());

  assertNoCollision(
    own.map((unit) => unit.stem),
    inlined,
  );

  return {
    units: [
      ...own,
      ...inlined.map(({ file, stem }) => ({ file, stem, inlined: true })),
    ],
    inlined,
  };
}

// remapping ships CJS function-as-module.exports; typed locally, fetched via require
interface RawMap {
  sources?: (string | null)[];
}

interface ComposedMap {
  sources: string[];
  sourcesContent?: (string | null)[];
  file: string;
  toString(): string;
}

// SAFETY: remapping's module.exports is the function with this signature
const remapping = createRequire(import.meta.url)('@ampproject/remapping') as (
  map: RawMap,
  loader: (source: string) => RawMap | null,
  options: { excludeContent: boolean },
) => ComposedMap;

// Compose an emit stage's map (or chain of two) into the shipped map for `out`:
// single relative source; sourcesContent only for `embed`, a source no tarball ships.
export function shippedMap(
  file: string,
  out: string,
  finalMap: RawMap,
  priorMap?: RawMap,
  embed?: string,
): string {
  const map = remapping(
    finalMap,
    (source) => (priorMap && source === file ? priorMap : null),
    { excludeContent: true },
  );

  // exactly one original source; remapping's own resolution double-prefixes relative paths
  map.sources = [relative(dirname(out), file)];
  map.file = basename(out);

  if (embed !== undefined) map.sourcesContent = [embed];

  return map.toString();
}
