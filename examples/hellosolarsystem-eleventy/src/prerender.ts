// One prerender() over every path: the router decides what each path is, Eleventy writes the files.
import { LitElementRenderer } from '@lit-labs/ssr';
import { UIRouterLit } from 'lit-ui-router/pure';
import {
  LightElementRenderer,
  prerender,
  settle,
  UiViewRenderer,
} from 'lit-ui-router-ssr';
import { installServerLocation } from 'ui-router-server/location';
import { redirectPages } from 'ui-router-server/prerender';

import { configure, page } from './app.ts';
import { solarBodies } from './bodies.ts';
import { mounts } from './routes.ts';

/** One page body and the file it belongs at, relative to the site root. */
export interface SitePage {
  file: string;
  status: number;
  body: string;
}

/** A redirect page's file, relative to the site root, and the url it sends the browser to. */
export interface SiteRedirect {
  file: string;
  to: string;
}

/** Every page the router drew, the redirects it answered instead, and the `_redirects` body. */
export interface Site {
  pages: SitePage[];
  redirects: SiteRedirect[];
  redirectsFile: string;
}

/** Renders every page, href and redirect under `base`, the path the site is served at. */
export async function renderSite(base = '/'): Promise<Site> {
  const router = configure(
    installServerLocation(new UIRouterLit(), { baseHref: base }),
  );

  const files = new Map<string, string>();

  try {
    const result = await prerender({
      mounts,
      router,
      // Every path to emit. `/legacy` emits its redirect page and `_redirects` line; the 404 page comes from `otherwise` unlisted.
      paths: ['/', ...solarBodies.map(({ id }) => `/planets/${id}`), '/legacy'],
      outDir: '',
      base,
      // `_redirects`, and a page per redirect whose body is its target, for the layout to wrap.
      rules: redirectPages({ redirectsFile: true, page: ({ to }) => to }),
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
        files.set(file, body);
      },
    });

    const pages = result.pages.map(({ file, verdict }) => ({
      file,
      status: ('status' in verdict && verdict.status) || 200,
      body: files.get(file) ?? '',
    }));

    const redirectsFile = files.get('_redirects') ?? '';

    files.delete('_redirects');

    for (const { file } of pages) files.delete(file);

    return {
      pages,
      redirects: [...files].map(([file, to]) => ({ file, to })),
      redirectsFile,
    };
  } finally {
    router.dispose();
  }
}
