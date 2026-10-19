import { defineConfig } from 'vite';

// The page loads public/main.js as written; vite only serves and copies it.
export default defineConfig({
  build: {
    modulePreload: { polyfill: false },
  },
});
