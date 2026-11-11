// Runs after `vite build`: the router decides what each path is, and the pages go into the built index.html.
import { LitElementRenderer } from '@lit-labs/ssr';
import { UIRouterLit } from 'lit-ui-router/pure';
import {
  LightElementRenderer,
  settle,
  UiViewRenderer,
} from 'lit-ui-router-ssr';
import { definePrerender } from 'lit-ui-router-ssr/vite';
import { installServerLocation } from 'ui-router-server/location';
import { redirectPages } from 'ui-router-server/prerender';

import { configure, page } from './app.ts';
import { mounts, paths } from './route-table.ts';

export default definePrerender((site) => {
  // Vite's `base`, so the server render builds its hrefs where the host serves the pages.
  const router = configure(
    installServerLocation(new UIRouterLit(), { baseHref: site.base }),
  );

  return {
    mounts,
    router,
    paths,
    // `_redirects` and a page per redirect, for hosts that don't read `_redirects`.
    rules: redirectPages({ redirectsFile: true }),
    // The default omits LitElementRenderer, which <app-root>'s shadow root needs.
    elementRenderers: [
      UiViewRenderer,
      LightElementRenderer,
      LitElementRenderer,
    ],
    // `{}` dehydrates with defaults: each page embeds its resolved data; client adopts the resolves instead of rerunning
    dehydrate: {},
    renderShell: async (_verdict, { path }) => {
      await settle(router, path);

      return page(router);
    },
    document: (body) => site.shellHtml.replace('<!--app-->', body),
  };
});
