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
  // The plugin hands over the built shell, not Vite's `base`; the shell's <base href> carries it.
  const base = /<base href="([^"]*)"/.exec(site.shellHtml)?.[1] ?? '/';

  const under = (path: string): string => `${base}${path.replace(/^\//, '')}`;

  const router = configure(
    installServerLocation(new UIRouterLit(), { baseHref: base }),
  );

  // `_redirects` and a page per redirect, for hosts that don't read `_redirects`.
  const writeRedirects = redirectPages({ base, redirectsFile: true });

  return {
    mounts,
    router,
    paths,
    // The route table's lines are site-absolute; the host serves them under `base`.
    rules: (lines, context) =>
      writeRedirects(
        lines.map((line) => ({
          ...line,
          from: under(line.from),
          to: under(line.to),
        })),
        context,
      ),
    // The default omits LitElementRenderer, which <app-root>'s shadow root needs.
    elementRenderers: [
      UiViewRenderer,
      LightElementRenderer,
      LitElementRenderer,
    ],
    // Each page carries its resolves, so the client boots without fetching them again.
    dehydrate: {},
    renderShell: async (_verdict, { path }) => {
      await settle(router, path);

      return page(router);
    },
    document: (body) => site.shellHtml.replace('<!--app-->', body),
  };
});
