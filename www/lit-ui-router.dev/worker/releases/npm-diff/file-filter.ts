// The diff page's file presets: how the url names them; the release-diffs worker's index says which files each shows.

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

/** Whether `filter` shows `file`, as the release-diffs worker's index lists its presets. */
export const shows = (
  filter: FileFilter,
  file: { readonly filters: readonly FileFilter[] },
): boolean => file.filters.includes(filter);

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

/** How many of `files` each preset shows. */
export const filterCounts = (
  files: readonly { readonly filters: readonly FileFilter[] }[],
): Record<FileFilter, number> =>
  // SAFETY: the entries name every preset once.
  Object.fromEntries(
    FILE_FILTERS.map((filter) => [
      filter,
      files.filter((file) => shows(filter, file)).length,
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
