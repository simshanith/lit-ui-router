/**
 * The Vite plugin for a Lit app: `ui-router-server/vite`'s
 * `serverRouterPlugin`, with the prerender worker set up for Lit. It names
 * `@lit-labs/ssr`'s DOM shim and `lit-ui-router-ssr/register` as preloads, so
 * the prerender script imports the app, the router and this package
 * statically, and `definePrerender` calls this package's `prerender()` with
 * the options the script returns.
 *
 * Nothing here imports Lit, `@lit-labs/ssr` or Vite, so `vite.config.ts`
 * loads it without defining an element or installing a global in Vite's
 * process.
 *
 * @module
 */
import { serverRouterPlugin as siteRouterPlugin } from 'ui-router-server/vite';
import type {
  PrerenderBuild,
  PrerenderEntry,
  ServerRouterPlugin,
  ServerRouterPluginOptions,
} from 'ui-router-server/vite';
import type { ServerRouter } from 'ui-router-server';

import type { PrerenderOptions } from './prerender.js';

export type {
  PrerenderBuild,
  PrerenderEntry,
  ServerRouterPlugin,
  ServerRouterPluginOptions,
} from 'ui-router-server/vite';

// The shim first, then the served <ui-view>, defined in the registry the shim installed.
const litPreload = [
  '@lit-labs/ssr/lib/install-global-dom-shim.js',
  'lit-ui-router-ssr/register',
];

/**
 * What a prerender script's callback returns: this package's
 * {@link PrerenderOptions}, less what the build supplies. `outDir` and
 * `write` come from the build, so a script may still pass either to
 * override it.
 */
export type PrerenderScriptOptions = Omit<
  PrerenderOptions,
  'outDir' | 'write'
> &
  Partial<Pick<PrerenderOptions, 'outDir' | 'write'>>;

/**
 * The callback {@link definePrerender} takes: handed the build's values,
 * such as `shellHtml` for a `document` hook, it returns the prerender
 * options.
 */
export type PrerenderScript = (
  build: PrerenderBuild,
) => PrerenderScriptOptions | Promise<PrerenderScriptOptions>;

// Loaded on call, inside the worker: the plugin's process never evaluates lit.
const loadPrerender = async () => (await import('./prerender.js')).prerender;

/**
 * Turns a callback that returns this package's prerender options into a
 * prerender script's default export. The export spreads the build's values
 * (`outDir`, `shellHtml`, `write`) under the options and calls this
 * package's `prerender()`, so the script never calls it itself.
 *
 * @param script - returns the prerender options; handed the build's values
 * @returns the default export for the prerender script
 *
 * @example
 * ```ts
 * export default definePrerender((site) => ({
 *   mounts,
 *   router,
 *   paths: ['/', '/about'],
 *   renderShell: async (_verdict, { path }) => {
 *     await settle(router, path);
 *     return page(router);
 *   },
 *   document: (body) => site.shellHtml.replace('<!--app-->', body),
 * }));
 * ```
 */
export function definePrerender(script: PrerenderScript): PrerenderEntry {
  return async (build) => {
    const [options, prerender] = await Promise.all([
      script(build),
      loadPrerender(),
    ]);

    // `root` is an event target, which the worker can't post back.
    const { root: _root, ...result } = await prerender({
      ...build,
      ...options,
    });

    return result;
  };
}

/**
 * `ui-router-server/vite`'s `serverRouterPlugin`, set up for a Lit app: with
 * {@link ServerRouterPluginOptions.prerender | prerender}, the worker loads
 * `@lit-labs/ssr`'s DOM shim, then `lit-ui-router-ssr/register`, then any
 * `preload` passed here, before the prerender script, so the script imports
 * everything statically. Its default export
 * comes from this module's {@link definePrerender}.
 *
 * `vite dev` and `vite preview` behave as under `ui-router-server/vite`.
 *
 * @param router - the server router the middleware and the build step read
 * @param options - the Connect adapter's options, plus the build step
 * @returns a plugin to spread into `plugins: [...]`
 * @throws from the build step when the script has no default export
 * function, the built `index.html` is missing, or a listed path matches no
 * route
 *
 * @example
 * ```ts
 * import { createServerRouter } from 'ui-router-server';
 * import { serverRouterPlugin } from 'lit-ui-router-ssr/vite';
 *
 * plugins: [
 *   serverRouterPlugin(createServerRouter({ mounts }), {
 *     prerender: './src/prerender.ts',
 *   }),
 * ],
 * ```
 */
export function serverRouterPlugin(
  router: ServerRouter,
  options: ServerRouterPluginOptions = {},
): ServerRouterPlugin {
  const { prerender } = options;

  if (prerender === undefined) return siteRouterPlugin(router, options);

  const { entry, preload = [] } =
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the option's own union: a string is shorthand for `{ entry }`
    typeof prerender === 'string' ? { entry: prerender } : prerender;

  return siteRouterPlugin(router, {
    ...options,
    prerender: { entry, preload: [...litPreload, ...preload] },
  });
}
