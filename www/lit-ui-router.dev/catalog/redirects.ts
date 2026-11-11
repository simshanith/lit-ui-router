// Data only: the build writes dist/_redirects from it and the dev server answers it; checks live in .vitepress/redirects.ts.
import type { RedirectLine } from 'ui-router-server/prerender';

import type { PackageName } from './packages.ts';

/** A `_redirects` row, with the released packages whose README or `homepage` links its source. */
export interface Redirect extends RedirectLine {
  /** Published tarballs keep these links forever, so the rule is permanent. */
  linkedFrom?: readonly PackageName[];
}

/** Each API reference's directory before it moved to /reference/<npm-name>/; catalog/api-urls.txt lists every URL they served. */
const API_DIRS = {
  'lit-ui-router': 'reference',
  'ui-router-effect': 'ui-router-effect',
  'lit-ui-router-effect': 'lit-ui-router-effect',
  'ui-router-mobx': 'ui-router-mobx',
  'lit-ui-router-mobx': 'lit-ui-router-mobx',
  'ui-router-signals': 'ui-router-signals',
  'lit-ui-router-signals': 'lit-ui-router-signals',
  'ui-router-navigation-location-plugin': 'navigation-location-plugin',
  'ui-router-server': 'ui-router-server',
  'lit-ui-router-ssr': 'lit-ui-router-ssr',
  'ui-router-registry': 'ui-router-registry',
} as const satisfies Partial<Record<PackageName, string>>;

/** Released packages linking an old reference's index page. */
const ROOT_LINKS: Partial<Record<PackageName, readonly PackageName[]>> = {
  'lit-ui-router-ssr': ['lit-ui-router-ssr'],
};

/** Released packages linking pages inside an old reference. */
const PAGE_LINKS: Partial<Record<PackageName, readonly PackageName[]>> = {
  'lit-ui-router': [
    'eslint-plugin-lit-ui-router',
    'lit-ui-router-effect',
    'lit-ui-router-mobx',
    'lit-ui-router-signals',
  ],
  'ui-router-server': ['ui-router-server'],
};

const linked = (packages: readonly PackageName[] | undefined) =>
  packages ? { linkedFrom: packages } : {};

// SAFETY: API_DIRS is keyed by PackageName and holds strings
const apiDirs = Object.entries(API_DIRS) as [PackageName, string][];

const API_ROOTS: Redirect[] = apiDirs.flatMap(([name, dir]) => [
  {
    from: `/api/${dir}/`,
    to: `/reference/${name}/`,
    status: 301,
    ...linked(ROOT_LINKS[name]),
  },
  { from: `/api/${dir}.md`, to: `/reference/${name}.md`, status: 301 },
]);

// One splat per reference: Cloudflare does not apply dynamic rules in file order, so none may overlap.
const API_PAGES: Redirect[] = apiDirs.map(([name, dir]) => ({
  from: `/api/${dir}/*`,
  to: `/reference/${name}/:splat`,
  status: 301,
  ...linked(PAGE_LINKS[name]),
}));

/** Moved docs URLs, in `_redirects` order: an exact static rule beats any dynamic one, and no two dynamic sources overlap. */
export const REDIRECTS: readonly Redirect[] = [
  { from: '/about-this-site', to: '/site/', status: 301 },
  {
    from: '/packages/eslint-plugin',
    to: '/packages/eslint-plugin-lit-ui-router',
    status: 301,
    linkedFrom: ['eslint-plugin-lit-ui-router'],
  },
  {
    from: '/packages/eslint-plugin.md',
    to: '/packages/eslint-plugin-lit-ui-router.md',
    status: 301,
  },
  {
    from: '/packages/navigation-plugin',
    to: '/packages/ui-router-navigation-location-plugin',
    status: 301,
    linkedFrom: ['ui-router-navigation-location-plugin'],
  },
  {
    from: '/packages/navigation-plugin.md',
    to: '/packages/ui-router-navigation-location-plugin.md',
    status: 301,
  },
  {
    from: '/packages/server',
    to: '/packages/ui-router-server',
    status: 301,
    linkedFrom: ['ui-router-server', 'lit-ui-router-ssr'],
  },
  {
    from: '/packages/server.md',
    to: '/packages/ui-router-server.md',
    status: 301,
  },
  {
    from: '/packages/ssr',
    to: '/packages/lit-ui-router-ssr',
    status: 301,
    linkedFrom: ['lit-ui-router-ssr'],
  },
  {
    from: '/packages/ssr.md',
    to: '/packages/lit-ui-router-ssr.md',
    status: 301,
  },
  {
    from: '/api/',
    to: '/reference/',
    status: 301,
    linkedFrom: ['lit-ui-router'],
  },
  { from: '/api.md', to: '/reference.md', status: 301 },
  ...API_ROOTS,
  ...API_PAGES,
];
