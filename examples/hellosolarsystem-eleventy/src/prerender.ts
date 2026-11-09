// One prerender() over every path: the router decides what each path is, Eleventy writes the pages.
import { LitElementRenderer } from '@lit-labs/ssr';
import { UIRouterLit } from 'lit-ui-router/pure';
import {
  LightElementRenderer,
  prerender,
  type RedirectLine,
  settle,
  UiViewRenderer,
} from 'lit-ui-router-ssr';
import { installServerLocation } from 'ui-router-server/location';

import { configure, page } from './app.ts';
import { mounts, paths } from './route-table.ts';

/** One page body and the file it belongs at, relative to the site root. */
export interface SitePage {
  file: string;
  status: number;
  body: string;
}

/** Every page the router drew, and the redirects it answered instead of a page. */
export interface Site {
  pages: SitePage[];
  rules: RedirectLine[];
}

/** Renders every page with hrefs under `baseHref`, the path the site is served at. */
export async function renderSite(baseHref = '/'): Promise<Site> {
  const router = configure(
    installServerLocation(new UIRouterLit(), { baseHref }),
  );

  const bodies = new Map<string, string>();

  try {
    const result = await prerender({
      mounts,
      router,
      paths,
      outDir: '',
      // Eleventy writes the rules file, with the site's base path on each line.
      rules: 'none',
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
      write: (file, body) => {
        bodies.set(file, body);
      },
    });

    return {
      pages: result.pages.map(({ file, verdict }) => ({
        file,
        status: ('status' in verdict && verdict.status) || 200,
        body: bodies.get(file) ?? '',
      })),
      rules: result.rules,
    };
  } finally {
    router.dispose();
  }
}
