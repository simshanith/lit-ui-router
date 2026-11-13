import { defineConfig } from 'vite';

import packageJson from './package.json' with { type: 'json' };

// The demo page only; the library builds through oxc-emit, which defines the version as this does.
export default defineConfig({
  root: 'demo',
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(packageJson.version),
  },
});
