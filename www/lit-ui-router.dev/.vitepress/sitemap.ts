import { rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { SitemapIndexStream, streamToPromise } from 'sitemap';

import { SURFACES } from '../catalog/surfaces.ts';

/** The sitemap index robots.txt names. */
export const SITEMAP_INDEX = '/sitemap.xml';

/** Where the build moves VitePress's sitemap, which it always writes at the index's path. */
export const PAGES_SITEMAP = '/sitemap-pages.xml';

/** The index's entries: the pages sitemap, then each sitemap-listed worker row's own. */
export const childSitemaps = (): string[] => [
  PAGES_SITEMAP,
  ...SURFACES.flatMap(({ renderer, sitemap, paths: [mount] }) =>
    renderer === 'worker' && sitemap ? [`${mount}/sitemap.xml`] : [],
  ),
];

/** A sitemap index of `paths`, each absolute on `hostname`. */
export const sitemapIndexXml = async (
  hostname: string,
  paths: string[],
): Promise<string> =>
  String(
    await streamToPromise(
      Readable.from(paths.map((path) => `${hostname}${path}`)).pipe(
        new SitemapIndexStream(),
      ),
    ),
  );

/** Moves VitePress's sitemap aside and writes the index in its place. */
export async function writeSitemapIndex(
  outDir: string,
  hostname: string,
): Promise<void> {
  await rename(join(outDir, SITEMAP_INDEX), join(outDir, PAGES_SITEMAP));
  await writeFile(
    join(outDir, SITEMAP_INDEX),
    await sitemapIndexXml(hostname, childSitemaps()),
  );
}
