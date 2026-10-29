import { createServerRouter } from 'ui-router-server';
import { serverRouterPlugin } from 'ui-router-server/vite';
import { mounts } from 'sample-app-routes';
// Examples embedded same-origin at /examples/<name>/; built by
// `examples#build:embeds` (hash routing, so no SPA fallback needed).
import { EXAMPLE_NAMES } from 'examples/embeds';
import { writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { defineConfig, Plugin } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

import { llmsPlugins } from './llms.ts';

// The mount shells as the dev server serves them. Production (worker/)
// serves each at its bare mount via Cloudflare's html_handling; the dev server
// serves the static-copied files, so the paths carry `.html`. The vanilla
// pushState mounts share ONE base-agnostic build (`/app.html`) — the shell
// derives its base from location.pathname at boot (see sample-app-shared's
// configureRouter), so it renders real routes under /not-found-spa and
// /simulated-routing too, mirroring the worker's shellPath aliasing.
// /app-mobx, /app-effect, /app-signals and /app-hash keep their own builds
// (different bindings / location mode).
const SHELL_PATHS = new Map([
  ['/app', '/app.html'],
  ['/app-mobx', '/app-mobx.html'],
  ['/app-effect', '/app-effect.html'],
  ['/app-signals', '/app-signals.html'],
  ['/app-hash', '/app-hash.html'],
  ['/not-found-spa', '/app.html'],
  ['/simulated-routing', '/app.html'],
]);

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

// vite's own build.chunkSizeWarningLimit default, applied to every client chunk.
const CHUNK_BUDGET_KB = 500;

// The lazy local-search index (API pages included) measures ~597 kB; the budget leaves 20% headroom.
const SEARCH_INDEX_BUDGET_KB = 720;

/** Fails the client build on a chunk over its budget and logs the search index's size. */
function chunkBudgetPlugin(): Plugin {
  return {
    name: 'chunk-budget',
    apply: (_config, { command, isSsrBuild }) =>
      command === 'build' && !isSsrBuild,
    generateBundle(_options, bundle) {
      const over: string[] = [];

      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        const kB = Buffer.byteLength(chunk.code) / 1000;
        const isIndex = chunk.name.startsWith('@localSearchIndex');
        const budget = isIndex ? SEARCH_INDEX_BUDGET_KB : CHUNK_BUDGET_KB;

        if (isIndex) {
          const gzipKB = gzipSync(chunk.code).length / 1000;

          console.log(
            `chunk-budget: ${chunk.fileName} ${kB.toFixed(1)} kB (gzip ${gzipKB.toFixed(1)} kB) of ${budget} kB`,
          );
        }

        if (kB > budget) {
          over.push(`${chunk.fileName} ${kB.toFixed(1)} kB > ${budget} kB`);
        }
      }

      if (over.length) this.error(`chunks over budget: ${over.join(', ')}`);
    },
  };
}

const RELEASE_PAGES_CSS = fileURLToPath(
  new URL('../worker/releases/release-pages.css', import.meta.url),
);

const RELEASE_PAGES_ENTRY = '\0release-pages-entry';

/** Emits the release pages' stylesheet, the theme's Inter faces and variables first, at a stable `/<basename>`. */
function releasePagesStylesheetPlugin(): Plugin {
  // `?url` keeps them out of style.css; a CSS @import would skip vitepress:webfonts and load Google Fonts.
  const sources = [
    'vitepress/dist/client/theme-default/styles/fonts.css',
    'vitepress/dist/client/theme-default/styles/vars.css',
    RELEASE_PAGES_CSS,
  ];

  let stylesheet = '';

  return {
    name: 'release-pages-stylesheet',
    apply: (_config, { command, isSsrBuild }) =>
      command === 'build' && !isSsrBuild,
    buildStart() {
      this.emitFile({ type: 'chunk', id: RELEASE_PAGES_ENTRY });
    },
    resolveId: {
      filter: { id: /^\0release-pages-entry$/ },
      handler: (id) => id,
    },
    load: {
      filter: { id: /^\0release-pages-entry$/ },
      handler: () =>
        sources
          .map(
            (source, i) =>
              `export { default as css${i} } from '${source}?url';`,
          )
          .join('\n'),
    },
    generateBundle(_options, bundle) {
      const parts = sources.map((source) => {
        const name = basename(source);

        const asset = Object.values(bundle).find(
          (file) =>
            file.type === 'asset' &&
            file.originalFileNames.some((original) =>
              original.endsWith(`/${name}`),
            ),
        );

        if (asset?.type !== 'asset') this.error(`no emitted css for ${source}`);
        delete bundle[asset.fileName];

        return asset.source.toString();
      });

      for (const file of Object.values(bundle)) {
        if (
          file.type === 'chunk' &&
          file.facadeModuleId === RELEASE_PAGES_ENTRY
        ) {
          delete bundle[file.fileName];
        }
      }

      stylesheet = parts.join('');
    },
    // Written after the bundle: vitepress links the first css asset in the output as every docs page's stylesheet.
    async writeBundle({ dir = '' }) {
      await writeFile(join(dir, basename(RELEASE_PAGES_CSS)), stylesheet);
    },
  };
}

export default defineConfig({
  plugins: [
    ...llmsPlugins(),
    chunkBudgetPlugin(),
    releasePagesStylesheetPlugin(),
    serverRouterPlugin(router, {
      shellPath: (mount) => SHELL_PATHS.get(mount) ?? mount,
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
    // structure; stripBase drops the node_modules/<app>/dist/<variant>/<dir> prefix.
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/vanilla/assets/*',
          dest: 'assets',
          rename: { stripBase: true },
        },
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/vanilla/index.html',
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
        {
          src: 'node_modules/sample-app-lit-effect/dist/assets/*',
          dest: 'assets',
          rename: { stripBase: true },
        },
        {
          src: 'node_modules/sample-app-lit-effect/dist/index.html',
          dest: '',
          rename: { name: 'app-effect.html', stripBase: true },
        },
        {
          src: 'node_modules/sample-app-lit-signals/dist/assets/*',
          dest: 'assets',
          rename: { stripBase: true },
        },
        {
          src: 'node_modules/sample-app-lit-signals/dist/index.html',
          dest: '',
          rename: { name: 'app-signals.html', stripBase: true },
        },
        // The hash-location sibling shell: the vanilla app's second build
        // (`vite build --mode hash`), hash location + `/app-hash/` base baked
        // in. Its bundle is content-hashed against different env, so it
        // coexists with the vanilla one under /assets.
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/hash/assets/*',
          dest: 'assets',
          rename: { stripBase: true },
        },
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/hash/index.html',
          dest: '',
          rename: { name: 'app-hash.html', stripBase: true },
        },
        // Per-mount 404 pages: the worker (worker/index.ts) serves
        // <mount>/404.html with status 404 for unmatched paths in a mount.
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/vanilla/404.html',
          dest: 'app',
          rename: { stripBase: true },
        },
        {
          src: 'node_modules/sample-app-lit-mobx/dist/404.html',
          dest: 'app-mobx',
          rename: { stripBase: true },
        },
        {
          src: 'node_modules/sample-app-lit-effect/dist/404.html',
          dest: 'app-effect',
          rename: { stripBase: true },
        },
        {
          src: 'node_modules/sample-app-lit-signals/dist/404.html',
          dest: 'app-signals',
          rename: { stripBase: true },
        },
        // Hash deep paths (`/app-hash/foo`) never happen under a hash client,
        // but a mistyped one gets the same honest 404 page as the other mounts.
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/hash/404.html',
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
          src: 'node_modules/sample-app-lit-vanilla/dist/vanilla/images/**',
          dest: 'images',
          rename: { stripBase: 5 },
        },
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/vanilla/static/**',
          dest: 'static',
          rename: { stripBase: 5 },
        },
        // stripBase ignores the leading ../, so 3 = examples/<name>/dist.
        ...EXAMPLE_NAMES.map((name) => ({
          src: `../../examples/${name}/dist/**`,
          dest: `examples/${name}`,
          rename: { stripBase: 3 },
        })),
      ],
    }),
  ],

  resolve: {
    // VitePress's documented internal-component override; only VPContent imports this path.
    alias: [
      {
        find: /^\.\/VPHome\.vue$/,
        replacement: fileURLToPath(
          new URL('./theme/components/VPHomeMain.vue', import.meta.url),
        ),
      },
    ],
  },

  build: {
    rolldownOptions: {
      // A throw here is swallowed, so fail through the exit code instead.
      onLog(level, log, handler) {
        // The reporter's only warning is the chunk-size one chunk-budget replaces.
        if (log.plugin === 'builtin:vite-reporter') return;
        handler(level, log);

        if (level !== 'warn') return;
        process.exitCode = 1;
        console.error('Failing the docs build on the warning above.');
      },
    },
  },

  server: {
    open: !process.env.CI && !process.env.E2E_TEST,
  },
});
