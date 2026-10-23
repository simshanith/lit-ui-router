// The diff page's file presets: which published files each one shows, and how the url names it.

export const FILE_FILTERS = ['src', 'js', 'types', 'all'] as const;

export type FileFilter = (typeof FILE_FILTERS)[number];

export const DEFAULT_FILTER: FileFilter = 'src';

/** The url parameter that names a preset other than the default. */
export const FILTER_PARAM = 'files';

export const FILTER_LABELS: Readonly<Record<FileFilter, string>> = {
  src: 'Source',
  js: 'Published JS',
  types: 'Types',
  all: 'All',
};

const isTypes = (path: string): boolean => /\.d\.[cm]?ts$/.test(path);

const isJs = (path: string): boolean => /\.[cm]?js$/.test(path);

/** `src/**`, and the package's root files that aren't build output: `package.json`, the readme, the license. */
const isSource = (path: string): boolean =>
  path.startsWith('src/') ||
  (!path.includes('/') &&
    !isJs(path) &&
    !isTypes(path) &&
    !path.endsWith('.map'));

const MATCHERS: Readonly<Record<FileFilter, (path: string) => boolean>> = {
  src: isSource,
  js: (path) => !path.startsWith('src/') && isJs(path),
  types: (path) => !path.startsWith('src/') && isTypes(path),
  all: () => true,
};

/** Whether `filter` shows the published file at `path`. */
export const matchesFilter = (filter: FileFilter, path: string): boolean =>
  MATCHERS[filter](path);

/** The preset a url's search names, or the default for a missing or unknown one. */
export const filterOf = (search: string): FileFilter => {
  const value = new URLSearchParams(search).get(FILTER_PARAM);

  return FILE_FILTERS.find((filter) => filter === value) ?? DEFAULT_FILTER;
};

/** `url` naming `filter`, its parameter omitted for the default. */
export const urlWithFilter = (url: string, filter: FileFilter): string => {
  const next = new URL(url);

  if (filter === DEFAULT_FILTER) next.searchParams.delete(FILTER_PARAM);
  else next.searchParams.set(FILTER_PARAM, filter);

  return next.href;
};

/** How many of `paths` each preset shows. */
export const filterCounts = (
  paths: readonly string[],
): Record<FileFilter, number> =>
  // SAFETY: the entries name every preset once.
  Object.fromEntries(
    FILE_FILTERS.map((filter) => [
      filter,
      paths.filter((path) => matchesFilter(filter, path)).length,
    ]),
  ) as Record<FileFilter, number>;

/** Orders paths as a file tree lists them: at the first segment they differ in, a directory before a file, then by name. */
export const comparePaths = (a: string, b: string): number => {
  const left = a.split('/');
  const right = b.split('/');
  const shared = Math.min(left.length, right.length);

  for (let i = 0; i < shared; i++) {
    if (left[i] === right[i]) continue;

    const leftIsDirectory = i < left.length - 1;
    const rightIsDirectory = i < right.length - 1;

    if (leftIsDirectory !== rightIsDirectory) return leftIsDirectory ? -1 : 1;

    return compareNames(left[i] ?? '', right[i] ?? '');
  }

  return left.length - right.length;
};

const collator = new Intl.Collator('en', { numeric: true });

/** Two sibling names, in natural order. */
export const compareNames = (a: string, b: string): number =>
  collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
