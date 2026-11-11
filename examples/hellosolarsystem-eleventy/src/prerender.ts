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
import { solarBodies } from './bodies.ts';
import { mounts } from './routes.ts';

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
      // Every path to emit. `/legacy` emits its redirect page and `_redirects` line; the 404 page comes from `otherwise` unlisted.
      paths: ['/', ...solarBodies.map(({ id }) => `/planets/${id}`), '/legacy'],
      outDir: '',
      // Eleventy writes the rules file, with the site's base path on each line.
      rules: 'none',
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
