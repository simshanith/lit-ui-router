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
import { mountsAt, pathsAt } from './route-table.ts';

export default definePrerender((site) => {
  // The build hands over the shell, not Vite's `base`; index.html carries it in <base href>.
  const base = /<base href="([^"]*)"/.exec(site.shellHtml)?.[1] ?? '/';

  const router = configure(
    installServerLocation(new UIRouterLit(), { baseHref: base }),
  );

  return {
    mounts: mountsAt(base),
    router,
    paths: pathsAt(base),
    // `_redirects` for hosts that read it, and a page per redirect for those that don't.
    rules: redirectPages({ base, redirectsFile: true }),
    // The default omits LitElementRenderer, which <app-root>'s shadow root needs.
    elementRenderers: [
      UiViewRenderer,
      LightElementRenderer,
      LitElementRenderer,
    ],
    // Each page carries its resolves, so the client boots without fetching them again.
    dehydrate: {},
    renderShell: async (_verdict, { subpath }) => {
      // The router reads urls under its baseHref, so it settles on the path inside the mount.
      await settle(router, subpath || '/');

      return page(router);
    },
    document: (body) => site.shellHtml.replace('<!--app-->', body),
  };
});
