// Run by vite-prerender.test.ts under node's --conditions: builds into argv's outDir.
import path from 'node:path';

import { prerender } from 'ui-router-server/prerender';
import { build } from 'vite';

import { createServerRouter } from '../../../src/index.ts';
import { serverRouterPlugin } from '../../../src/vite.ts';
import { mounts } from './src/routes.ts';

Object.assign(globalThis, { processPrerender: prerender });

await build({
  root: import.meta.dirname,
  configFile: false,
  logLevel: 'silent',
  build: { outDir: path.resolve(process.argv[2] ?? ''), emptyOutDir: true },
  plugins: [
    serverRouterPlugin(createServerRouter({ mounts }), {
      prerender: './src/prerender-identity.ts',
    }),
  ],
});
