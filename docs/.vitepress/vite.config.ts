import { createServerRouter } from 'ui-router-server';
import { serverRouterPlugin } from 'ui-router-server/vite';
import { mounts } from 'sample-app-routes';
import { defineConfig, Plugin } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Tutorial examples embedded same-origin at /examples/<name>/; built by
// `examples#build:embeds` (hash routing, so no SPA fallback needed).
const EMBEDDED_EXAMPLES = ['helloworld', 'hellosolarsystem', 'hellogalaxy'];

// The mount shells as the dev server serves them. Production (docs/worker)
// serves each at its bare mount via Cloudflare's html_handling; the dev server
// serves the static-copied files, so the paths carry `.html`. The vanilla
// pushState mounts share ONE base-agnostic build (`/app.html`) — the shell
// derives its base from location.pathname at boot (see sample-app-shared's
// configureRouter), so it renders real routes under /not-found-spa and
// /simulated-routing too, mirroring the worker's shellPath aliasing. /app-mobx
// and /app-hash keep their own builds (different bindings / location mode).
const SHELL_PATHS: Record<string, string> = {
  '/app': '/app.html',
  '/app-mobx': '/app-mobx.html',
  '/app-hash': '/app-hash.html',
  '/not-found-spa': '/app.html',
  '/simulated-routing': '/app.html',
};

// The dev-server twin of the docs worker: the SAME mounts table, resolved by
// the SAME ui-router-server engine, so `vitepress dev` answers the honest
// 302s and mount-owned 404s the production worker does — dev/prod routing
// parity from one config, and the retirement of the always-200 SPA fallback
// this file used to hand-roll. The plugin installs its middleware in the pre
// position (before Vite's own HTML fallback); asset/module fetches pass
// through its navigation gate untouched.
const router = createServerRouter({ mounts });

/**
 * Directory requests for the embedded tutorial examples resolve to their
 * built index.html (production gets this from Cloudflare's static-asset index
 * resolution). Unrelated to routing — the examples use hash routing and carry
 * no server verdicts — so it stays a plain rewrite beside the router plugin.
 */
function examplesIndexPlugin(): Plugin {
  return {
    name: 'examples-index-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const dir = req.url?.match(/^\/examples\/([\w-]+)\/?$/);
        if (dir) req.url = `/examples/${dir[1]}/index.html`;
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    serverRouterPlugin(router, {
      shellPath: (mount) => SHELL_PATHS[mount] ?? mount,
      // Dev parity with the worker's mount-owned 404: serve the mount's
      // static-copied 404 page relabeled to an honest 404, not the adapter's
      // text/plain default. The 304 guard mirrors the adapter's own relabel.
      serveNotFound: (mount, req, res, next) => {
        req.url = `${mount}/404.html`;
        const writeHead = res.writeHead.bind(res);
        res.writeHead = (status: number, ...rest: unknown[]) =>
          writeHead(status === 304 ? 304 : 404, ...rest);
        next();
      },
    }),
    examplesIndexPlugin(),
    // static-copy v4 matches files only and always preserves source directory
    // structure; stripBase drops the node_modules/<app>/dist/<dir> prefix.
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/assets/*',
          dest: 'assets',
          rename: { stripBase: true },
        },
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/index.html',
          dest: '',
          rename: { name: 'app.html', stripBase: true },
        },
        {
          src: 'node_modules/sample-app-lit-mobx/dist/assets/*',
          dest: 'assets',
          rename: { stripBase: true },
        },
        {
          src: 'node_modules/sample-app-lit-mobx/dist/index.html',
          dest: '',
          rename: { name: 'app-mobx.html', stripBase: true },
        },
        // The hash-location sibling shell: the vanilla app's second build
        // (`vite build --mode hash`), hash location + `/app-hash/` base baked
        // in. Its bundle is content-hashed against different env, so it
        // coexists with the vanilla one under /assets.
        {
          src: 'node_modules/sample-app-lit-vanilla/dist-hash/assets/*',
          dest: 'assets',
          rename: { stripBase: true },
        },
        {
          src: 'node_modules/sample-app-lit-vanilla/dist-hash/index.html',
          dest: '',
          rename: { name: 'app-hash.html', stripBase: true },
        },
        // Per-mount 404 pages: the worker (docs/worker/index.ts) serves
        // <mount>/404.html with status 404 for unmatched paths in a mount.
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/404.html',
          dest: 'app',
          rename: { stripBase: true },
        },
        {
          src: 'node_modules/sample-app-lit-mobx/dist/404.html',
          dest: 'app-mobx',
          rename: { stripBase: true },
        },
        // Hash deep paths (`/app-hash/foo`) never happen under a hash client,
        // but a mistyped one gets the same honest 404 page as the other mounts.
        {
          src: 'node_modules/sample-app-lit-vanilla/dist-hash/404.html',
          dest: 'app-hash',
          rename: { stripBase: true },
        },
        // The aliased exhibits (/not-found-naive, /not-found-spa,
        // /simulated-routing) need no shells of their own: they share the one
        // vanilla build above (app.html + its /assets bundle). The shell
        // derives its base from location.pathname at boot, so it deep-links
        // under every exhibit prefix — the worker (and dev SHELL_PATHS) alias
        // those mounts to /app. No 404.html either: exhibit misses serve a
        // status'd shell (the `otherwise` projection), not a static page.
        //
        // images/ and static/ come from sample-app-shared and are identical
        // in both apps' dists; copy once so neither can silently clobber.
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/images/**',
          dest: 'images',
          rename: { stripBase: 4 },
        },
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/static/**',
          dest: 'static',
          rename: { stripBase: 4 },
        },
        // stripBase ignores the leading ../, so 3 = examples/<name>/dist.
        ...EMBEDDED_EXAMPLES.map((name) => ({
          src: `../examples/${name}/dist/**`,
          dest: `examples/${name}`,
          rename: { stripBase: 3 },
        })),
      ],
    }),
  ],

  server: {
    open: !process.env.CI && !process.env.E2E_TEST,
  },
});
