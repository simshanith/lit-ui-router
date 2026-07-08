import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// @uirouter/visualizer is a dep of sample-app-shared, so resolve it from there;
// require.resolve yields a realpath, avoiding globs through pnpm symlinks.
const sharedRequire = createRequire(
  new URL('../sample-app-shared/package.json', import.meta.url),
);
const visualizerImages = path
  .join(
    path.dirname(sharedRequire.resolve('@uirouter/visualizer/package.json')),
    'images',
  )
  .replaceAll('\\', '/'); // glob patterns need posix separators

// path segments static-copy prepends to dest for sources outside the vite root
const stripBase = path
  .relative(path.dirname(fileURLToPath(import.meta.url)), visualizerImages)
  .replaceAll('\\', '/')
  .replace(/^(?:\.\.\/)+/, '')
  .split('/').length;

export default defineConfig({
  // Static data (favicon, simulated REST fixtures) lives in the shared
  // sample-app package; the apps differ only in their reactivity idiom.
  publicDir: '../sample-app-shared/public',
  build: {
    // Provenance for scripts/upload-bundle-stats.mjs: the manifest tells
    // rollup-emitted assets apart from publicDir/static-copy files.
    manifest: true,
  },
  plugins: [
    checker({ typescript: true }),
    viteStaticCopy({
      targets: [
        {
          src: `${visualizerImages}/**`,
          dest: 'images',
          rename: { stripBase },
        },
      ],
    }),
  ],
  // Pinned ports (vanilla 5173/4173, mobx 5174/4174): strictPort fails loudly
  // instead of drifting, and open stays off so `turbo dev` spawns no browsers.
  server: {
    port: 5173,
    strictPort: true,
    open: false,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
