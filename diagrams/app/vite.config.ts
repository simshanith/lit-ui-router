import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { createServerRouter } from 'ui-router-server';
import { serverRouterPlugin } from 'ui-router-server/vite';
import type { Manifest } from './src/manifest.ts';
import { MOUNT, mountsFor } from './src/routes.ts';

// The generated index is on disk at config time, so the dev server can narrow
// /sheet/:num to the numbers that were actually drawn — and answer 404 for
// the ones that were not, exactly as the deployed site will.
const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('./public/manifest.json', import.meta.url)), 'utf8'),
) as Manifest;

const serverRouter = createServerRouter({
  mounts: mountsFor(manifest.sheets.map((sheet) => sheet.num)),
});

export default defineConfig({
  base: `${MOUNT}/`,
  build: {
    target: 'esnext',
  },
  plugins: [
    serverRouterPlugin(serverRouter, {
      shellPath: () => `${MOUNT}/`,
      // The adapter sits in front of the static layer here, so it should
      // judge asset requests too — otherwise `vite preview` answers 200 for
      // a path that only looks like a route.
      shouldHandle: (req) => (req.headers.accept ?? '').includes('text/html'),
    }),
  ],
});
