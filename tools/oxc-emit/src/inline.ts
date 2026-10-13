// Private workspace source (`@repo/*`, under packages/shared/) ships inside each
// consumer's dist/ rather than as a dependency: the emit passes compile the
// canonical file into dist/shared/ and point the consumer's imports at it.
import { realpathSync } from 'node:fs';
import { basename, join, posix, relative } from 'node:path';

import { requireManifest } from '@tools/bootstrap/manifest.ts';
import type { ExportsTarget } from '@tools/bootstrap/types.ts';

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

/** The `@repo/*` sources the package in `dir` inlines, from its devDependencies. */
export function inlinedSources(dir: string): InlinedSource[] {
  const { devDependencies = {} } = requireManifest(dir);

  return Object.keys(devDependencies)
    .filter((name) => name.startsWith(INLINE_SCOPE))
    .map((specifier) => {
      const linked = join(dir, 'node_modules', specifier);
      const entry = requireManifest(linked).exports?.['.'];

      if (!isTsFile(entry)) {
        throw new Error(
          `${specifier}: exports["."] must name one .ts file to inline`,
        );
      }

      const file = relative(dir, realpathSync(join(linked, entry)));

      return {
        specifier,
        file,
        stem: posix.join(INLINE_DIR, basename(file, '.ts')),
      };
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

/** Fails when an inlined source would overwrite one of the package's own emits. */
export function assertNoCollision(
  ownStems: readonly string[],
  inlined: readonly InlinedSource[],
): void {
  const own = new Set(ownStems);
  const clash = inlined.find((source) => own.has(source.stem));

  if (clash) {
    throw new Error(
      `${clash.specifier} inlines to ${clash.stem}, which src/ already emits`,
    );
  }
}
