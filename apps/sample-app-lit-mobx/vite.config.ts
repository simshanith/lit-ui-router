import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  // Static data (favicon, simulated REST fixtures) is shared with the
  // vanilla sample app rather than duplicated; the apps differ only in
  // their reactivity idiom.
  publicDir: '../sample-app-lit/public',
  plugins: [
    checker({ typescript: true }),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@uirouter/visualizer/images/*',
          dest: 'images',
        },
      ],
    }),
  ],
  server: {
    open: true,
  },
});
