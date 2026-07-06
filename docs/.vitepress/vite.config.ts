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
      ],
    }),
  ],

  server: {
    open: !Boolean(process.env.CI) && !Boolean(process.env.E2E_TEST),
  },
});
