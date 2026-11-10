// Data only: the build writes dist/_redirects from it and the dev server answers it; checks live in .vitepress/redirects.ts.
import type { RedirectLine } from 'ui-router-server/prerender';

import type { PackageName } from './packages.ts';

/** A `_redirects` row, with the released packages whose README or `homepage` links its source. */
export interface Redirect extends RedirectLine {
  /** Published tarballs keep these links forever, so the rule is permanent. */
  linkedFrom?: readonly PackageName[];
}

/** Moved docs URLs, in `_redirects` order: static rules first, first match wins. */
export const REDIRECTS = [
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
  // The API reference moved to /reference/<npm-name>/; api-urls.txt lists every URL it served.
  {
    from: '/api/',
    to: '/reference/',
    status: 301,
    linkedFrom: ['lit-ui-router'],
  },
  { from: '/api.md', to: '/reference.md', status: 301 },
  { from: '/api/reference/', to: '/reference/lit-ui-router/', status: 301 },
  {
    from: '/api/reference.md',
    to: '/reference/lit-ui-router.md',
    status: 301,
  },
  {
    from: '/api/navigation-location-plugin/',
    to: '/reference/ui-router-navigation-location-plugin/',
    status: 301,
  },
  {
    from: '/api/navigation-location-plugin.md',
    to: '/reference/ui-router-navigation-location-plugin.md',
    status: 301,
  },
  {
    from: '/api/reference/*',
    to: '/reference/lit-ui-router/:splat',
    status: 301,
    linkedFrom: [
      'eslint-plugin-lit-ui-router',
      'lit-ui-router-effect',
      'lit-ui-router-mobx',
      'lit-ui-router-signals',
    ],
  },
  {
    from: '/api/navigation-location-plugin/*',
    to: '/reference/ui-router-navigation-location-plugin/:splat',
    status: 301,
  },
  {
    from: '/api/*',
    to: '/reference/:splat',
    status: 301,
    linkedFrom: ['lit-ui-router-ssr', 'ui-router-server'],
  },
] as const satisfies readonly Redirect[];
