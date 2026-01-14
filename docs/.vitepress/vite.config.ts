import { defineConfig, Plugin } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/**
 * Vite plugin to handle /app/* deep linking in dev server.
 * Mirrors Cloudflare _redirects: `/app/* /app 200`
 * Rewrites /app/* requests to serve app.html (the sample-app SPA).
 */
function spaFallbackPlugin(): Plugin {
  return {
    name: 'spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith('/app')) {
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
      ],
    }),
  ],

  server: {
    open: !Boolean(process.env.CI) && !Boolean(process.env.E2E_TEST),
  },
});
