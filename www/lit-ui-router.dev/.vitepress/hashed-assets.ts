import { globSync } from 'node:fs';
import { join } from 'node:path';

/** The folder `public/_headers` caches for a year: a file here must change its name when its content changes. */
export const HASHED_ASSETS = 'assets';

// An eight-character hash before the extension, as VitePress and the release-diff build name their output.
const HASHED = /[.-][\w-]{8}(?:\.lean)?\.\w+$/;

/** The names that carry no content hash. */
export const unhashed = (names: readonly string[]): string[] =>
  names.filter((name) => !HASHED.test(name));

/** Fails the build when a file under the year-cached folder has a fixed name. */
export function checkHashedAssets(outDir: string): void {
  const fixed = unhashed(
    globSync('**/*.*', { cwd: join(outDir, HASHED_ASSETS) }).sort(),
  );

  if (fixed.length > 0)
    throw new Error(
      `/${HASHED_ASSETS}/ is cached for a year (public/_headers), so every file in it needs a content hash in its name. Without one:\n${fixed.map((name) => `  ${name}`).join('\n')}`,
    );
}
