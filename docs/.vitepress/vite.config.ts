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
        server.middlewares.use((req, _res, next) => {
          if (req.url?.startsWith('/app.html/')) {
            req.url = '/app.html'
          }
          
          next()
        })
      },
    },
  ],
  
  server: {
    
    open: true,
  },
});
