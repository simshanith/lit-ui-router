// The "flimsy wrapper": one path through lit-ui-router-ssr's public prerender(), captured in memory.
import { UIRouterLit } from 'lit-ui-router/pure';
import { LitElementRenderer } from '@lit-labs/ssr/lib/lit-element-renderer.js';
import {
  LightElementRenderer,
  prerender,
  settle,
  UiViewRenderer,
} from 'lit-ui-router-ssr';
import { installServerLocation } from 'ui-router-server/location';

import { configure, page } from './app.ts';
import { mounts } from './route-table.ts';

export type RouteRender =
  | { kind: 'page'; status: number; body: string }
  | { kind: 'redirect'; status: number; location: string };

export async function renderRoute(path: string): Promise<RouteRender> {
  const router = configure(installServerLocation(new UIRouterLit()));
  const files = new Map<string, string>();

  try {
    const result = await prerender({
      mounts,
      router,
      paths: [path],
      outDir: 'memory',
      notFound: false,
      rules: 'none',
      trailingSlash: 'exact',
      // the default omits LitElementRenderer, so a shadow-DOM shell such as <app-root> would render empty
      elementRenderers: [
        UiViewRenderer,
        LightElementRenderer,
        LitElementRenderer,
      ],
      renderShell: async (_verdict, { path: at }) => {
        await settle(router, at);

        return page(router);
      },
      document: (body) => body,
      write: (file, body) => {
        files.set(file, body);
      },
    });

    const rule = result.rules[0];

    if (rule)
      return { kind: 'redirect', status: rule.status, location: rule.to };

    const [emitted] = result.pages;
    const body = [...files.values()][0];

    if (!emitted || body === undefined)
      throw new Error(
        `renderRoute: nothing emitted for ${path}: ${JSON.stringify(result.warnings)}`,
      );

    const status =
      'status' in emitted.verdict && emitted.verdict.status
        ? emitted.verdict.status
        : 200;

    return { kind: 'page', status, body };
  } finally {
    router.dispose();
  }
}
