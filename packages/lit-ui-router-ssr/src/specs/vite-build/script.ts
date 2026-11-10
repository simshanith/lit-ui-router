import type { TemplateResult } from 'lit';
import { UIRouterLit } from 'lit-ui-router/pure';
import { settle } from 'lit-ui-router-ssr';
import { definePrerender } from 'lit-ui-router-ssr/vite';
import type { PrerenderEntry } from 'lit-ui-router-ssr/vite';
import { installServerLocation } from 'ui-router-server/location';

import { states } from './app.ts';
import { mounts, paths } from './routes.ts';

// What a prerender script holds, over the page template the entry picks.
export const scriptFor = (
  template: (router: UIRouterLit) => TemplateResult,
): PrerenderEntry => {
  const router = installServerLocation(new UIRouterLit(), {
    urlConfig: { strict: false },
  });

  for (const state of states) router.stateRegistry.register(state);
  router.urlService.rules.otherwise({ state: 'notFound' });

  return definePrerender((site) => ({
    mounts,
    router,
    paths,
    renderShell: async (_verdict, { path }) => {
      await settle(router, path);

      return template(router);
    },
    document: (body) => site.shellHtml.replace('<!--app-->', body),
  }));
};
