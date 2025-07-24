import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    checker({ typescript: true }),
    cloudflare(),
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
