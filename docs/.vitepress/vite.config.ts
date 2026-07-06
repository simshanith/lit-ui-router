import { defineConfig, Plugin } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/**
 * Vite plugin to handle /app/* and /app-mobx/* deep linking in dev server.
 * Mirrors Cloudflare _redirects: `/app/* /app 200`, `/app-mobx/* /app-mobx 200`
 * Rewrites requests to serve the matching sample-app SPA html.
 */
function spaFallbackPlugin(): Plugin {
  return {
    name: 'spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith('/app-mobx')) {
          req.url = '/app-mobx.html';
        } else if (req.url?.startsWith('/app')) {
          req.url = '/app.html';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    spaFallbackPlugin(),
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
      ],
    }),
  ],

  build: {
    // VitePress 1.x defaults this list with `safari14`, but esbuild >=0.27.7
    // refuses to emit destructuring for Safari <14.1 (JSC array-rest bug,
    // compat-table/compat-table#2008) and has no lowering transform for it.
    target: ['chrome87', 'edge88', 'es2020', 'firefox78', 'safari14.1'],
  },

  server: {
    open: !Boolean(process.env.CI) && !Boolean(process.env.E2E_TEST),
  },
});
