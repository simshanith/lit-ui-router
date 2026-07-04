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
          src: 'node_modules/sample-app-lit/dist/assets/*',
          dest: 'assets',
        },
        {
          src: 'node_modules/sample-app-lit/dist/images/*',
          dest: 'images',
        },
        {
          src: 'node_modules/sample-app-lit/dist/static/*',
          dest: 'static',
        },
        {
          src: 'node_modules/sample-app-lit/dist/index.html',
          dest: '',
          rename: 'app.html',
        },
        {
          src: 'node_modules/sample-app-lit-mobx/dist/assets/*',
          dest: 'assets',
        },
        {
          src: 'node_modules/sample-app-lit-mobx/dist/images/*',
          dest: 'images',
        },
        {
          src: 'node_modules/sample-app-lit-mobx/dist/static/*',
          dest: 'static',
        },
        {
          src: 'node_modules/sample-app-lit-mobx/dist/index.html',
          dest: '',
          rename: 'app-mobx.html',
        },
      ],
    }),
  ],

  server: {
    open: !Boolean(process.env.CI) && !Boolean(process.env.E2E_TEST),
  },
});
