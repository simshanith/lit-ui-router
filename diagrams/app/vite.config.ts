import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { createServerRouter } from 'ui-router-server';
import { serverRouterPlugin } from 'ui-router-server/vite';
import type { Manifest } from './src/manifest.ts';
import { BASE, mountsFor } from './src/routes.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(HERE, 'dist');

// The generated index is on disk at config time, so the dev server can narrow
// /sheet/:num to the numbers that were actually drawn — and answer 404 for
// the ones that were not, exactly as the deployed site will.
const manifest = JSON.parse(
  readFileSync(join(HERE, 'public', 'manifest.json'), 'utf8'),
) as Manifest;

const serverRouter = createServerRouter({
  mounts: mountsFor(manifest.sheets.map((sheet) => sheet.num)),
});

export default defineConfig(({ isPreview }) => ({
  base: BASE,
  build: {
    target: 'esnext',
  },
  plugins: [
    serverRouterPlugin(serverRouter, {
      // Preview serves what Pages serves: the prerendered `<subpath>/index.html`
      // when the build wrote one, with or without the trailing slash. Dev has
      // no dist, so every shell verdict is the live index.html.
      serveShell: (_mount, req, _res, next) => {
        const path = (req.url ?? '/').replace(/[?#].*$/, '').replace(/\/+$/, '');
        const file = `${path}/index.html`;
        req.url = isPreview && existsSync(join(DIST, file)) ? file : BASE;
        next();
      },
      // The adapter sits in front of the static layer here, so it should
      // judge asset requests too — otherwise `vite preview` answers 200 for
      // a path that only looks like a route.
      shouldHandle: (req) => (req.headers.accept ?? '').includes('text/html'),
    }),
  ],
}));
