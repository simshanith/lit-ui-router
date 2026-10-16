// Private workspace source (`@repo/*`, under packages/shared/) ships inside each
// consumer's dist/ rather than as a dependency: the emit passes compile the
// each file its exports map names into dist/shared/ and point the consumer's imports at it.
import { realpathSync } from 'node:fs';
import { basename, join, posix, relative } from 'node:path';

import { requireManifest } from '@tools/bootstrap/manifest.ts';
import type {
  ExportsConditions,
  ExportsTarget,
} from '@tools/bootstrap/types.ts';

export const INLINE_SCOPE = '@repo/';

// Under each pass's out dir; assertNoCollision rejects a src/shared/ of the consumer's own.
export const INLINE_DIR = 'shared';

/** A canonical source a consumer inlines. */
export interface InlinedSource {
  /** The bare specifier the consumer imports, e.g. `@repo/route-snapshot`. */
  readonly specifier: string;
  /** The canonical file, relative to the consumer's root. */
  readonly file: string;
  /** Its emit path under the out dir, without extension. */
  readonly stem: string;
}

/** An exports target that names one TypeScript file, the only shape inlining reads. */
function isTsFile(target: ExportsTarget | undefined): target is string {
  return typeof target === 'string' && target.endsWith('.ts');
}

/** Each subpath of a `@repo/*` exports map, as the specifier a consumer imports and the file it names. */
export function exportedFiles(
  name: string,
  exports: ExportsConditions | undefined,
): [specifier: string, file: string][] {
  const entries = Object.entries(exports ?? {});

  if (entries.length === 0) {
    throw new Error(`${name}: exports must name the .ts files to inline`);
  }

  return entries.map(([subpath, target]) => {
    if (!isTsFile(target)) {
      throw new Error(
        `${name}: exports["${subpath}"] must name one .ts file to inline`,
      );
    }

    return [posix.join(name, subpath), target];
  });
}

/** The `@repo/*` sources the package in `dir` inlines, from its devDependencies. */
export function inlinedSources(dir: string): InlinedSource[] {
  const { devDependencies = {} } = requireManifest(dir);

  return Object.keys(devDependencies)
    .filter((name) => name.startsWith(INLINE_SCOPE))
    .flatMap((name) => {
      const linked = join(dir, 'node_modules', name);

      return exportedFiles(name, requireManifest(linked).exports).map(
        ([specifier, entry]) => {
          const file = relative(dir, realpathSync(join(linked, entry)));

          return {
            specifier,
            file,
            stem: posix.join(INLINE_DIR, basename(file, '.ts')),
          };
        },
      );
    });
}

// Matches the emit-dts specifier pattern: static `from "x"` and dynamic `import("x")`.
const REPO_SPECIFIER = /((?:from|import\()\s*")(@repo\/[^"]*)(?=")/g;

/**
 * Points every `@repo/*` specifier in emitted code at its inlined file.
 * `outStem` is the emitting file's path under the out dir, without extension.
 * Changes the import line's length, so map columns after it on that line shift.
 */
export function rewriteInlined(
  code: string,
  outStem: string,
  inlined: readonly InlinedSource[],
): string {
  return code.replace(REPO_SPECIFIER, (_match, head: string, specifier) => {
    const target = inlined.find((source) => source.specifier === specifier);

    if (!target) {
      throw new Error(
        `${outStem}: imports ${specifier}, which package.json does not list in devDependencies`,
      );
    }

    const path = posix.relative(posix.dirname(outStem), target.stem);

    return `${head}${path.startsWith('.') ? path : `./${path}`}.js`;
  });
}

/** Fails when an inlined source would overwrite one of the package's own emits, or another inlined source. */
export function assertNoCollision(
  ownStems: readonly string[],
  inlined: readonly InlinedSource[],
): void {
  const taken = new Map(ownStems.map((stem) => [stem, 'src/']));

  for (const { specifier, stem } of inlined) {
    const owner = taken.get(stem);

    if (owner) {
      throw new Error(
        `${specifier} inlines to ${stem}, which ${owner} already emits`,
      );
    }

    taken.set(stem, specifier);
  }
}
