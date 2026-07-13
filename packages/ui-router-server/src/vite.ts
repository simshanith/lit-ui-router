/**
 * The Vite plugin: the Connect adapter (see `./connect`) wired into Vite's
 * dev and preview middleware stacks, both of which are Connect-shaped. It is
 * the honest-status upgrade of Vite's built-in SPA fallback — `vite dev` and
 * `vite preview` answer the same 302s and mount-owned 404s the production
 * worker does, so a mounted app has dev/prod routing parity from one mounts
 * table.
 *
 * Dependency-free like the tiers it fronts: the structural types below
 * declare the sliver of Vite's plugin surface the plugin touches
 * (`server.middlewares.use`), so Vite stays a type-only peer this package
 * never imports. The returned object is a structural subset of Vite's
 * `Plugin` — spread it straight into `plugins: [...]`.
 */

import { createConnectMiddleware } from './connect.ts';
import type { ConnectAdapterOptions, ConnectMiddleware } from './connect.ts';
import type { ServerRouter } from './index.ts';

/** The sliver of Vite's dev/preview server the plugin uses: the Connect stack. */
export interface ViteMiddlewareServer {
  middlewares: { use(middleware: ConnectMiddleware): unknown };
}

/** A structural subset of Vite's `Plugin` — assignable into `plugins: [...]`. */
export interface ServerRouterPlugin {
  name: string;
  configureServer(server: ViteMiddlewareServer): void;
  configurePreviewServer(server: ViteMiddlewareServer): void;
}

/**
 * Wraps a [[ServerRouter]] as a Vite plugin. The middleware installs in the
 * PRE position — synchronously inside `configureServer`, before Vite adds
 * its own middlewares — which is exactly where `connect-history-api-fallback`
 * sits and the only position that beats Vite's always-200 HTML fallback: a
 * redirect answers 302 and a mount-owned miss answers 404 before Vite can
 * serve `index.html`. The adapter's `shouldHandle` still lets module and
 * asset fetches pass untouched, essential under Vite where a mount's module
 * URLs share paths with its routes.
 *
 * `serveShell` defaults to rewriting `req.url` to the mount base and
 * `next()`ing into Vite's HTML/transform layer (dev) or `sirv` (preview);
 * point [[ConnectAdapterOptions.shellPath]] at the mount's actual HTML entry
 * when it isn't served at the base.
 */
export function serverRouterPlugin(
  router: ServerRouter,
  options?: ConnectAdapterOptions,
): ServerRouterPlugin {
  const middleware = createConnectMiddleware(router, options);
  const install = (server: ViteMiddlewareServer): void => {
    server.middlewares.use(middleware);
  };
  return {
    name: 'ui-router-server',
    configureServer: install,
    configurePreviewServer: install,
  };
}
