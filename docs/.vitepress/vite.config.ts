import { createServerRouter } from 'ui-router-server';
import { serverRouterPlugin } from 'ui-router-server/vite';
import { mounts } from 'sample-app-routes';
import { defineConfig, Plugin } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Tutorial examples embedded same-origin at /examples/<name>/; built by
// `examples#build:embeds` (hash routing, so no SPA fallback needed).
const EMBEDDED_EXAMPLES = ['helloworld', 'hellosolarsystem', 'hellogalaxy'];

// VitePress 1.x / vite 6 default targets list `safari14`, but esbuild >=0.27.7
// refuses to emit destructuring for Safari <14.1 (JSC array-rest bug,
// compat-table/compat-table#2008) and has no lowering transform for it.
const TARGET = ['chrome87', 'edge88', 'es2020', 'firefox78', 'safari14.1'];

// The mount shells as the dev server serves them. Production (docs/worker)
// serves each at its bare mount via Cloudflare's html_handling; the dev
// server serves the static-copied files, so the paths carry `.html` and the
// borrowed exhibits (/not-found-spa, /simulated-routing) point at the vanilla
// shell — the SHELL_PATHS aliasing the worker does, in the dev host's terms.
const SHELL_PATHS: Record<string, string> = {
  '/app': '/app.html',
  '/app-mobx': '/app-mobx.html',
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
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/assets/*',
          dest: 'assets',
        },
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/index.html',
          dest: '',
          rename: 'app.html',
        },
        {
          src: 'node_modules/sample-app-lit-mobx/dist/assets/*',
          dest: 'assets',
        },
        {
          src: 'node_modules/sample-app-lit-mobx/dist/index.html',
          dest: '',
          rename: 'app-mobx.html',
        },
        // Per-mount 404 pages: the worker (docs/worker/index.ts) serves
        // <mount>/404.html with status 404 for unmatched paths in a mount.
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/404.html',
          dest: 'app',
        },
        {
          src: 'node_modules/sample-app-lit-mobx/dist/404.html',
          dest: 'app-mobx',
        },
        // images/ and static/ come from sample-app-shared and are identical
        // in both apps' dists; copy once so neither can silently clobber.
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/images/*',
          dest: 'images',
        },
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/static/*',
          dest: 'static',
        },
        ...EMBEDDED_EXAMPLES.map((name) => ({
          src: `../examples/${name}/dist/*`,
          dest: `examples/${name}`,
        })),
      ],
    }),
  ],

  build: {
    target: TARGET,
  },

  optimizeDeps: {
    // the dev dep-optimizer ignores build.target and pre-bundles against
    // vite's internal ESBUILD_MODULES_TARGET, which still lists safari14
    esbuildOptions: {
      target: TARGET,
    },
  },

  server: {
    open: !Boolean(process.env.CI) && !Boolean(process.env.E2E_TEST),
  },
});
