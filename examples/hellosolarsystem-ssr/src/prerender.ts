// Runs after `vite build`: the router decides what each path is, and the pages go into the built index.html.
import { UIRouterLit } from 'lit-ui-router/pure';
import { shadowElementRenderers } from 'lit-ui-router-ssr';
import { definePrerender } from 'lit-ui-router-ssr/vite';
import { installServerLocation } from 'ui-router-server/location';
import { redirectPages } from 'ui-router-server/prerender';

import { configure, page } from './app.ts';
import { solarBodies } from './bodies.ts';
import { mounts } from './routes.ts';

export default definePrerender((site) => ({
  mounts,
  // Vite's `base`, so the server render builds its hrefs where the host serves the pages.
  router: configure(
    installServerLocation(new UIRouterLit(), { baseHref: site.base }),
  ),
  // Every path to emit. `/legacy` and the numbered planet urls emit redirect pages and `_redirects` lines; the 404 page comes from `otherwise` unlisted.
  paths: [
    '/',
    ...solarBodies.map(({ id }) => `/planets/${id}`),
    ...solarBodies.map((_, index) => `/planets/${index + 1}`),
    '/legacy',
  ],
  // `_redirects` and a page per redirect, for hosts that don't read `_redirects`.
  rules: redirectPages({ redirectsFile: true }),
  // <app-root> holds the <ui-view> in its shadow root.
  elementRenderers: shadowElementRenderers,
  // `{}` dehydrates with defaults: each page embeds its resolved data; client adopts the resolves instead of rerunning
  dehydrate: {},
  template: page,
}));
