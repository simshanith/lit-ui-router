// Shared by the theme and the snapshot build: no node, DOM or vitepress imports.
import { PACKAGES } from '../catalog/packages.ts';
import {
  type DocsVersion,
  lineMajor,
  menuVersions,
  packageLines,
  type VersionManifest,
} from './versions.ts';

/** The package whose major the guides, the tutorial and the introduction follow under `/vN/`. */
export const ROUTER_PACKAGE = 'lit-ui-router';

const PACKAGE_NAMES: ReadonlySet<string> = new Set(
  PACKAGES.map(({ name }) => name),
);

/** URL spaces with one live copy and no lines: the site page, the release pages and their search stubs. */
export const UNVERSIONED = [
  '/site/',
  '/releases/',
  '/package-releases/',
] as const;

/** Where a URL path sits among the docs lines. */
export interface Place {
  /** True for a page with no versions; the rest then describes nothing. */
  unversioned: boolean;
  /** The site-wide line whose prefix holds the path. */
  siteLine?: DocsVersion;
  /** The package whose page or reference this is. */
  package?: string;
  /** The package line the path is on. */
  packageLine?: string;
  /** The page's unversioned path without its leading slash: `reference/ui-router-server/vite/`. */
  page: string;
}

/** What a menu entry points at. */
export type LineTarget =
  | { kind: 'main' }
  | { kind: 'site'; line: DocsVersion }
  | { kind: 'package'; package: string; line: string };

const PACKAGE_PAGE = /^packages\/([^/]+)(?:\/(v\d+))?\/?$/;

// A line segment is `v<major>`, so no reference entry point may take that name.
const REFERENCE_PAGE = /^reference\/([^/]+)(?:\/(v\d+))?(?:\/(.*))?$/;

/** Locates a root-absolute URL path: its site-wide line, and its package and package line when it is a package's page. */
export function locate(manifest: VersionManifest, path: string): Place {
  const siteLine = manifest.others.find(
    (other) => path.startsWith(other.path) || `${path}/` === other.path,
  );

  const inner = `/${path.slice(siteLine ? siteLine.path.length : 1)}`;
  const page = inner.slice(1);

  const unversioned = UNVERSIONED.some(
    (space) => inner.startsWith(space) || `${inner}/` === space,
  );

  const base = { unversioned, ...(siteLine && { siteLine }) };
  const ofPackage = PACKAGE_PAGE.exec(page);
  const ofReference = REFERENCE_PAGE.exec(page);
  const [, name, packageLine] = ofPackage ?? ofReference ?? [];

  if (unversioned || !name || !PACKAGE_NAMES.has(name))
    return { ...base, page };

  return {
    ...base,
    package: name,
    ...(packageLine && { packageLine }),
    page: ofPackage
      ? `packages/${name}`
      : `reference/${name}/${ofReference?.[3] ?? ''}`,
  };
}

/** A package's own page on one of its lines. */
export const linePackagePage = (name: string, line: string): string =>
  `/packages/${name}/${line}`;

/** The same page at the target; undefined when the page has no versions or belongs to no package the target line is of. */
export function pageAt(place: Place, target: LineTarget): string | undefined {
  if (place.unversioned) return undefined;

  if (target.kind === 'main') return `/${place.page}`;

  if (target.kind === 'site') return `${target.line.path}${place.page}`;

  if (place.package !== target.package) return undefined;

  const stem = `reference/${target.package}/`;

  return place.page.startsWith(stem)
    ? `/${stem}${target.line}/${place.page.slice(stem.length)}`
    : linePackagePage(target.package, target.line);
}

/** Where a target sends a page it has no copy of: the line's package page, or the site-wide line's home. */
export function homeOf(place: Place, target: LineTarget): string {
  if (target.kind === 'package')
    return linePackagePage(target.package, target.line);

  if (target.kind === 'site') return target.line.path;

  return place.package ? `/packages/${place.package}` : '/';
}

/** A package line's label: `v0` is `0.x`. */
export const lineLabel = (id: string): string => `${lineMajor(id)}.x`;

export interface MenuEntry {
  label: string;
  /** The same page at the entry's target. */
  href: string;
  /** Where to go when the target has no such page. */
  fallback: string;
  /** True for the entry the page is on. */
  current: boolean;
}

/** A page's version menu: the label of the line it is on, and its entries. */
export interface VersionMenu {
  label: string;
  entries: MenuEntry[];
}

interface Candidate {
  target: LineTarget;
  label: string;
  current: boolean;
}

/** The targets a place offers: the unversioned docs, the package's lines, and the site-wide lines where the router's major applies. */
function candidates(manifest: VersionManifest, place: Place): Candidate[] {
  const { package: name, packageLine, siteLine } = place;
  const lines = name ? packageLines(manifest, name) : [];
  const site = menuVersions(manifest).slice(1);

  // A site-wide line also covers the router's own pages, until the router has a line of that major.
  const siteWide =
    !name || name === ROUTER_PACKAGE || siteLine
      ? site.filter((line) => lines.every(({ id }) => id !== line.id))
      : [];

  return [
    {
      target: { kind: 'main' },
      label: manifest.current.label,
      current: !packageLine && !siteLine,
    },
    ...lines.map(({ id }): Candidate => ({
      target: { kind: 'package', package: name ?? '', line: id },
      label: lineLabel(id),
      current: id === packageLine,
    })),
    ...siteWide.map((line): Candidate => ({
      target: { kind: 'site', line },
      label: line.label,
      current: !packageLine && line.id === siteLine?.id,
    })),
  ];
}

/**
 * The version menu for a page: the unversioned docs first, then the lines that hold a copy of it.
 * `notFound` sends every entry to its fallback, since a missing page has no counterpart.
 */
export function versionMenu(
  manifest: VersionManifest,
  path: string,
  notFound = false,
): VersionMenu {
  const place = locate(manifest, path);

  const entries = place.unversioned
    ? []
    : candidates(manifest, place).map(({ target, label, current }) => {
        const fallback = homeOf(place, target);

        return {
          label,
          href: notFound ? fallback : (pageAt(place, target) ?? fallback),
          fallback,
          current,
        };
      });

  const label =
    entries.find(({ current }) => current)?.label ??
    (place.packageLine
      ? lineLabel(place.packageLine)
      : (place.siteLine?.label ?? manifest.current.label));

  return { label, entries };
}
