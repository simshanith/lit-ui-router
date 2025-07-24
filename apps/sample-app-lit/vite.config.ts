import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  // TODO: Enable this when the app typechecks properly
  plugins: [
    checker({ typescript: false }),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@uirouter/visualizer/images/*',
          dest: 'images',
        },
      ],
    }),
  ],
});
