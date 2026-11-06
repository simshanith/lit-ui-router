import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
  },
  css: {
    modules: {
      // Readable scoped names, so the page can show what a module class compiles to.
      generateScopedName: '[name]__[local]__[hash:base64:5]',
    },
  },
});
