// The diff page's file presets: which published files each one shows.

export const FILE_FILTERS = ['src', 'js', 'types', 'all'] as const;

export type FileFilter = (typeof FILE_FILTERS)[number];

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

/** The presets that show the published file at `path`, in `FILE_FILTERS` order. */
export const filtersOf = (path: string): FileFilter[] =>
  FILE_FILTERS.filter((filter) => matchesFilter(filter, path));
