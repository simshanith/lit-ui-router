import { serverRouterPlugin } from 'lit-ui-router-ssr/vite';
import { createServerRouter } from 'ui-router-server';
import { defineConfig } from 'vite';

import { mountsAt } from './src/route-table.ts';

// The plugin doesn't read Vite's `base`, so the mount takes it from `--base=` too.
const base =
  process.argv
    .find((arg) => arg.startsWith('--base='))
    ?.slice('--base='.length) ?? '/';

export default defineConfig({
  base,
  build: { target: 'esnext' },
  plugins: [
    serverRouterPlugin(createServerRouter({ mounts: mountsAt(base) }), {
      prerender: './src/prerender.ts',
    }),
  ],
});
