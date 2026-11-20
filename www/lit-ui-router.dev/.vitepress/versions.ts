import * as v from 'valibot';

import bundled from '../public/versions.json' with { type: 'json' };

/** The production origin; every version is a path under it. */
export const SITE_ORIGIN = 'https://lit-ui-router.dev';

// Loose: a frozen build parses the live manifest, so fields a later schema adds must pass.
const DocsVersion = v.object({
  id: v.pipe(v.string(), v.nonEmpty()),
  label: v.pipe(v.string(), v.nonEmpty()),
  path: v.pipe(v.string(), v.startsWith('/'), v.endsWith('/')),
  /** The release tag a frozen site-wide snapshot is built from. */
  tag: v.optional(v.pipe(v.string(), v.nonEmpty())),
});

/** A line's URL segment: `v` and a major, `v0` included. */
export const LINE_ID = /^v(\d+)$/;

/** One major of one package: its page at `/packages/<pkg>/<id>`, its reference under `/reference/<pkg>/<id>/`. */
const PackageLine = v.object({
  id: v.pipe(v.string(), v.regex(LINE_ID)),
  /** The release tag the line was baked from, `<package>@<version>`. */
  tag: v.pipe(v.string(), v.nonEmpty()),
  /** `current` holds the latest release and is re-baked each release round; `frozen` is an older major. */
  status: v.picklist(['current', 'frozen']),
});

/** The version manifest at `/versions.json`: every served build of this site and how each is shown. */
export const VersionManifest = v.object({
  /** The unversioned URLs, which follow `main`. */
  current: DocsVersion,
  /** Every served site-wide version, newest first, hidden ones included: the guides at the router's major. */
  others: v.array(DocsVersion),
  /** Ids of site-wide versions that get the deprecated banner. */
  deprecated: v.array(v.string()),
  /** Ids of site-wide versions left out of the menu and search, still served. */
  hidden: v.array(v.string()),
  /** Each package's baked lines, keyed by npm name; a package without one is absent. */
  packages: v.optional(v.record(v.string(), v.array(PackageLine)), {}),
});

export type DocsVersion = v.InferOutput<typeof DocsVersion>;

export type PackageLine = v.InferOutput<typeof PackageLine>;

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

/** A line id's major. */
export const lineMajor = (id: string): number =>
  Number(LINE_ID.exec(id)?.[1] ?? Number.NaN);

/** A package's lines, newest major first. */
export const packageLines = (
  manifest: VersionManifest,
  name: string,
): PackageLine[] =>
  (Object.hasOwn(manifest.packages, name)
    ? [...(manifest.packages[name] ?? [])]
    : []
  ).sort((a, b) => lineMajor(b.id) - lineMajor(a.id));

/** What the schema can't say about the package lines: each names a catalog package, a tag of that package at the line's major, and one line per major with the newest current. */
export function lineProblems(
  manifest: VersionManifest,
  packages: readonly string[],
): string[] {
  return Object.entries(manifest.packages).flatMap(([name, listed]) => {
    if (!packages.includes(name)) return [`${name}: not a catalog package`];

    const lines = packageLines(manifest, name);
    const ids = lines.map(({ id }) => id);

    return [
      ...lines.flatMap(({ id, tag }) =>
        tag.startsWith(`${name}@${lineMajor(id)}.`)
          ? []
          : [`${name} ${id}: tag ${tag} is not ${name}@${lineMajor(id)}.x`],
      ),
      ...ids.flatMap((id, index) =>
        ids.indexOf(id) === index ? [] : [`${name} ${id}: listed twice`],
      ),
      ...lines.flatMap(({ id, status }, index) =>
        (status === 'current') === (index === 0)
          ? []
          : index === 0
            ? [`${name} ${id}: the newest line is not current`]
            : [`${name} ${id}: an older line is current`],
      ),
      ...(listed.length === 0 ? [`${name}: lists no line`] : []),
    ];
  });
}

/** The version menu's site-wide entries: the current version, then the others that aren't hidden. */
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
