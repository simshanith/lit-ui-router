import { defineConfig } from 'vite';

// `vite build --ssr` emits the render module Eleventy imports; `vite build` emits the client.
export default defineConfig(({ isSsrBuild }) => ({
  build: isSsrBuild
    ? {
        ssr: true,
        outDir: 'node_modules/.build/server',
        rolldownOptions: {
          input: {
            'render-route': 'src/render-route.ts',
            'route-table': 'src/route-table.ts',
          },
          output: { entryFileNames: '[name].js' },
        },
      }
    : {
        target: 'esnext',
        outDir: 'node_modules/.build/client',
        rolldownOptions: {
          input: 'src/client.ts',
          output: {
            entryFileNames: 'assets/client.js',
            chunkFileNames: 'assets/[name]-[hash].js',
          },
        },
      },
}));
