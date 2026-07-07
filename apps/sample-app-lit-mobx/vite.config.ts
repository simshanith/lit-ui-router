import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { codecovVitePlugin } from '@codecov/vite-plugin';
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

// static-copy v4 matches files only and always preserves source structure;
// v3 copies matched directories recursively and flattens by default.
const appRequire = createRequire(import.meta.url);
// the plugin's exports map blocks ./package.json; its entry lives in dist/
const staticCopyPkg = path.join(
  appRequire.resolve('vite-plugin-static-copy'),
  '../../package.json',
);
const staticCopyMajor = Number(
  (
    JSON.parse(readFileSync(staticCopyPkg, 'utf8')) as { version: string }
  ).version.split('.', 1)[0],
);
// path segments v4 prepends to dest for sources outside the vite root
const stripBase = path
  .relative(path.dirname(fileURLToPath(import.meta.url)), visualizerImages)
  .replaceAll('\\', '/')
  .replace(/^(?:\.\.\/)+/, '')
  .split('/').length;
const visualizerImagesTarget =
  staticCopyMajor >= 4
    ? { src: `${visualizerImages}/**`, dest: 'images', rename: { stripBase } }
    : { src: `${visualizerImages}/*`, dest: 'images' };

export default defineConfig({
  // Static data (favicon, simulated REST fixtures) lives in the shared
  // sample-app package; the apps differ only in their reactivity idiom.
  publicDir: '../sample-app-shared/public',
  plugins: [
    checker({ typescript: true }),
    viteStaticCopy({
      targets: [visualizerImagesTarget],
    }),
    // Codecov bundle analysis; no-op unless CODECOV_TOKEN is set (CI).
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: 'sample-app-lit-mobx',
      uploadToken: process.env.CODECOV_TOKEN,
      gitService: 'github',
      telemetry: false,
    }),
  ],
  server: {
    open: true,
  },
});
