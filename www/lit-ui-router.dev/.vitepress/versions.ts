import * as v from 'valibot';

import bundled from '../public/versions.json' with { type: 'json' };

/** The production origin; every version is a path under it. */
export const SITE_ORIGIN = 'https://lit-ui-router.dev';

const DocsVersion = v.strictObject({
  id: v.pipe(v.string(), v.nonEmpty()),
  label: v.pipe(v.string(), v.nonEmpty()),
  path: v.pipe(v.string(), v.startsWith('/'), v.endsWith('/')),
});

/** The version manifest at `/versions.json`: every served build of this site and how each is shown. */
export const VersionManifest = v.strictObject({
  current: DocsVersion,
  /** Every served non-current version, newest first, hidden ones included. */
  others: v.array(DocsVersion),
  /** Ids of versions that get the deprecated banner. */
  deprecated: v.array(v.string()),
  /** Ids of versions left out of the menu and search, still served. */
  hidden: v.array(v.string()),
});

export type DocsVersion = v.InferOutput<typeof DocsVersion>;

export type VersionManifest = v.InferOutput<typeof VersionManifest>;

export type BannerKind = 'none' | 'older' | 'deprecated' | 'unreleased';

/** The manifest bundled into this build. */
export const BUNDLED_MANIFEST: VersionManifest = v.parse(
  VersionManifest,
  bundled,
);

/** The version a build with this VitePress `base` serves, if the manifest lists it. */
export function versionOf(
  manifest: VersionManifest,
  base: string,
): DocsVersion | undefined {
  return [manifest.current, ...manifest.others].find(
    (version) => version.path === base,
  );
}

/** The version menu's entries: the current version, then the others that aren't hidden. */
export function menuVersions(manifest: VersionManifest): DocsVersion[] {
  const hidden = new Set(manifest.hidden);

  return [
    manifest.current,
    ...manifest.others.filter((version) => !hidden.has(version.id)),
  ];
}

/** A page's clean URL path under its version's base, from its VitePress `relativePath`. */
export function pagePath(relativePath: string): string {
  return relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
}

/** The same page in another version; that version's home for the 404 page. */
export function sameVersionPage(
  target: DocsVersion,
  relativePath: string,
  isNotFound: boolean,
): string {
  return isNotFound ? target.path : `${target.path}${pagePath(relativePath)}`;
}

/** Which banner a build of this version shows. */
export function bannerKind(
  manifest: VersionManifest,
  version: DocsVersion | undefined,
): BannerKind {
  if (!version || version.id === manifest.current.id) return 'none';

  if (manifest.hidden.includes(version.id)) return 'unreleased';

  if (manifest.deprecated.includes(version.id)) return 'deprecated';

  return 'older';
}

/** Fetches the live manifest from the site root; undefined on any failure. */
export async function fetchManifest(): Promise<VersionManifest | undefined> {
  const response = await fetch('/versions.json').catch(() => null);

  if (!response?.ok) return undefined;

  const result = v.safeParse(
    VersionManifest,
    await response.json().catch(() => null),
  );

  return result.success ? result.output : undefined;
}
