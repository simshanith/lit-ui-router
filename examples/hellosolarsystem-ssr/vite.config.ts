import { serverRouterPlugin } from 'lit-ui-router-ssr/vite';
import { createServerRouter } from 'ui-router-server';
import { defineConfig } from 'vite';

import { mounts } from './src/routes.ts';

export default defineConfig({
  plugins: [
    serverRouterPlugin(createServerRouter({ mounts }), {
      prerender: './src/prerender.ts',
    }),
  ],
});
