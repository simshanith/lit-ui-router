import { codecovVitePlugin } from '@codecov/vite-plugin';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  // Static data (favicon, simulated REST fixtures) lives in the shared
  // sample-app package; the apps differ only in their reactivity idiom.
  publicDir: '../sample-app-shared/public',
  plugins: [
    checker({ typescript: true }),
    viteStaticCopy({
      targets: [
        {
          src: '../sample-app-shared/node_modules/@uirouter/visualizer/images/*',
          dest: 'images',
        },
      ],
    }),
    // Codecov bundle analysis; no-op unless CODECOV_TOKEN is set (CI).
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: 'sample-app-lit-vanilla',
      uploadToken: process.env.CODECOV_TOKEN,
      gitService: 'github',
      telemetry: false,
    }),
  ],
  server: {
    open: true,
  },
});
