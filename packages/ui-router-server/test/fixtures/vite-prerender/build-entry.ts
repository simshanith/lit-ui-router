// Run by vite-prerender.test.ts in a child process: builds argv's prerender entry into argv's outDir.
import path from 'node:path';

import { build } from 'vite';

import { createServerRouter } from '../../../src/index.ts';
import { serverRouterPlugin } from '../../../src/vite.ts';
import { mounts } from './src/routes.ts';

const [outDir = '', entry = ''] = process.argv.slice(2);

await build({
  root: import.meta.dirname,
  configFile: false,
  logLevel: 'silent',
  build: { outDir: path.resolve(outDir), emptyOutDir: true },
  plugins: [
    serverRouterPlugin(createServerRouter({ mounts }), { prerender: entry }),
  ],
});
