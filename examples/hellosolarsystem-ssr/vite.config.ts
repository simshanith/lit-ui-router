import { serverRouterPlugin } from 'lit-ui-router-ssr/vite';
import { createServerRouter } from 'ui-router-server';
import { defineConfig } from 'vite';

import { mounts } from './src/route-table.ts';

export default defineConfig({
  build: { target: 'esnext' },
  plugins: [
    serverRouterPlugin(createServerRouter({ mounts }), {
      prerender: './src/prerender.ts',
    }),
  ],
});
