import { type Surface, SURFACES } from '../catalog/surfaces.ts';

type Row = (typeof SURFACES)[number];

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compiled = new Map<string, RegExp>();

/** A `run_worker_first` glob as a RegExp: `*` matches any run of characters, `/` included. */
export function globPattern(glob: string): RegExp {
  let pattern = compiled.get(glob);

  if (!pattern) {
    pattern = new RegExp(`^${glob.split('*').map(escapeRegExp).join('.*')}$`);
    compiled.set(glob, pattern);
  }

  return pattern;
}

/** A glob without `*` outranks every wildcard; wildcards rank by the text before their first `*`. */
const specificity = (glob: string): number =>
  glob.includes('*') ? glob.indexOf('*') : Infinity;

/** The row owning a path: its most specific matching glob wins, and a tie between rows throws. */
export function surfaceIn<S extends Surface>(
  surfaces: readonly S[],
  path: string,
): S {
  const matches = surfaces.flatMap((surface) =>
    surface.paths
      .filter((glob) => globPattern(glob).test(path))
      .map((glob) => ({ surface, rank: specificity(glob) })),
  );

  const best = Math.max(...matches.map(({ rank }) => rank));

  const owners = [
    ...new Set(
      matches.flatMap(({ surface, rank }) => (rank === best ? [surface] : [])),
    ),
  ];

  const [owner, ...others] = owners;

  if (!owner || others.length > 0) {
    throw new Error(
      `${path}: ${owner ? `claimed by ${owners.map(({ id }) => id).join(', ')}` : 'no surface'}`,
    );
  }

  return owner;
}

/** The catalog row owning a path. */
export const surfaceOf = (path: string): Row => surfaceIn(SURFACES, path);

/** The URL a page source is served at under cleanUrls: `site/index.md` is `/site/`. */
export const pageUrl = (relativePath: string): string =>
  `/${relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')}`;

/** A path glob as a page-source glob: `/site/` is `site/index.md`, and a trailing `*` reaches any depth. */
export const sourceGlob = (glob: string): string =>
  glob.slice(1).replace(/\/$/, '/index.md').replace(/\*$/, '**');

/** Source globs of the rows with Markdown pages that `match` selects. */
export const pageGlobs = (match: (surface: Row) => boolean): string[] =>
  SURFACES.filter(
    (surface) =>
      (surface.renderer === 'vitepress' || surface.renderer === 'typedoc') &&
      match(surface),
  ).flatMap(({ paths }) => paths.map(sourceGlob));

/** `ignoreDeadLinks` entries: a RegExp per glob of an `ignore` row, the bare paths of an `ignore-bare` row. */
export const deadLinkIgnores = (): (string | RegExp)[] =>
  SURFACES.flatMap(({ paths, deadLinks }): (string | RegExp)[] => {
    if (deadLinks === 'ignore') return paths.map(globPattern);

    if (deadLinks === 'ignore-bare')
      return paths.filter((glob) => !glob.includes('*'));

    return [];
  });
