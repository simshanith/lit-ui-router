import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// @uirouter/visualizer is a dep of this package; require.resolve yields a
// realpath, avoiding globs through pnpm symlinks.
const sharedRequire = createRequire(
  new URL('../package.json', import.meta.url),
);
const visualizerImages = path
  .join(
    path.dirname(sharedRequire.resolve('@uirouter/visualizer/package.json')),
    'images',
  )
  .replaceAll('\\', '/'); // glob patterns need posix separators

export interface SampleAppViteConfigOptions {
  /** the app's `import.meta.url` — anchors stripBase to that app's vite root */
  configUrl: string;
  serverPort: number;
  previewPort: number;
}

export const sampleAppViteConfig = ({
  configUrl,
  serverPort,
  previewPort,
}: SampleAppViteConfigOptions) => {
  // path segments static-copy prepends to dest for sources outside the vite root
  const stripBase = path
    .relative(path.dirname(fileURLToPath(configUrl)), visualizerImages)
    .replaceAll('\\', '/')
    .replace(/^(?:\.\.\/)+/, '')
    .split('/').length;

  return defineConfig({
    // Static data (favicon, simulated REST fixtures) lives in the shared
    // sample-app package; the apps differ only in their reactivity idiom.
    publicDir: '../sample-app-shared/public',
    build: {
      // Provenance for scripts/upload-bundle-stats.ts: the manifest tells
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
          // Per-mount 404 page; the docs worker serves it for unmatched paths.
          {
            src: '404.html',
            dest: '',
          },
        ],
      }),
    ],
    // Pinned per-app ports: strictPort fails loudly instead of drifting, and
    // open stays off so `turbo dev` spawns no browsers.
    server: {
      port: serverPort,
      strictPort: true,
      open: false,
    },
    preview: {
      port: previewPort,
      strictPort: true,
    },
  });
};
