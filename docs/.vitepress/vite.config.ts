import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
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
    {
      name: 'sample-app-lit-e2e',
      configureServer(server) {
        if (process.env.E2E_TEST && !process.env.CI) {
          const TIMEOUT_DURATION = 2_000; // 2 seconds

          // Start a one-time timeout when server is configured
          setTimeout(() => {
            console.log(
              'No requests received for 2 seconds after startup, shutting down server...',
            );
            server.close();
          }, TIMEOUT_DURATION);
        }

        server.middlewares.use((req, res, next) => {
          if (process.env.E2E_TEST && req.url?.includes('/e2e-done')) {
            res.statusCode = 200;
            res.end();
            server.close();
            return;
          }
          if (req.url?.startsWith('/app.html/')) {
            req.url = '/app.html';
          }

          next();
        });
      },
    },
  ],

  server: {
    open: !Boolean(process.env.E2E_TEST),
  },
});
