// The /releases sitemap: the index, each package's page and each version's page; diff pages stay out.
import XMLBuilder from 'fast-xml-builder';

import { SURFACES } from '../../catalog/surfaces.ts';
import type { LedgerPackage, LedgerVersion } from './ledger.ts';
import { RELEASES_MOUNT } from './routes.ts';

/** The sitemap protocol's cap on one file's URLs. */
export const MAX_URLS = 50_000;

/** Whether the catalog lists the releases space in the sitemap. */
export const inSitemap = (): boolean =>
  SURFACES.some(({ id, sitemap }) => id === 'releases' && sitemap);

/** One `<url>`: a path on the mount, and when its content last changed. */
export interface SitemapEntry {
  path: string;
  lastmod?: string;
}

/** When a version reached npm, or else GitHub, as a W3C datetime. */
const publishedAt = (row: LedgerVersion): string | undefined => {
  const stamp = row.npm_published_at ?? row.gh_published_at;
  const time = stamp === null ? NaN : Date.parse(stamp);

  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
};

// ISO datetimes in one zone order as strings.
const newest = (stamps: (string | undefined)[]): string | undefined =>
  stamps.reduce<string | undefined>(
    (latest, stamp) =>
      stamp !== undefined && (latest === undefined || stamp > latest)
        ? stamp
        : latest,
    undefined,
  );

const packagePath = (name: string): string =>
  `${RELEASES_MOUNT}/${encodeURIComponent(name)}/`;

/** Each package's page and its versions' pages, after the index; a page's lastmod is its newest version's. */
export const sitemapEntries = (
  packages: readonly LedgerPackage[],
  versions: readonly (readonly LedgerVersion[])[],
): SitemapEntry[] => {
  const perPackage = packages.map(({ name }, at) => {
    const rows = versions[at] ?? [];

    const pages = rows.map((row) => ({
      path: `${packagePath(name)}${encodeURIComponent(row.version)}/`,
      lastmod: publishedAt(row),
    }));

    return [
      { path: packagePath(name), lastmod: newest(pages.map((p) => p.lastmod)) },
      ...pages,
    ];
  });

  const index = {
    path: `${RELEASES_MOUNT}/`,
    lastmod: newest(perPackage.map(([page]) => page?.lastmod)),
  };

  return [index, ...perPackage.flat()].slice(0, MAX_URLS);
};

const builder = new XMLBuilder({ ignoreAttributes: false });

/** A sitemap of `entries`, each absolute on `origin`. */
export const sitemapXml = (origin: string, entries: SitemapEntry[]): string =>
  builder.build({
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    urlset: {
      '@_xmlns': 'http://www.sitemaps.org/schemas/sitemap/0.9',
      url: entries.map(({ path, lastmod }) => ({
        loc: `${origin}${path}`,
        lastmod,
      })),
    },
  });
