import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createServerRouter } from 'ui-router-server';
import { serverRouterPlugin } from 'ui-router-server/vite';
import { build } from 'vite';
import { afterAll, expect, it } from 'vitest';

import { mounts } from './src/routes.ts';

const outDir = await mkdtemp(path.join(tmpdir(), 'ui-router-server-vitest-'));

afterAll(() => rm(outDir, { recursive: true, force: true }));

it('prerenders from a build run under vitest', async () => {
  await build({
    root: import.meta.dirname,
    configFile: false,
    logLevel: 'silent',
    build: { outDir, emptyOutDir: true },
    plugins: [
      serverRouterPlugin(createServerRouter({ mounts }), {
        prerender: {
          entry: './src/prerender-element.ts',
          preload: ['./src/registry.ts'],
        },
      }),
    ],
  });

  expect(await readFile(path.join(outDir, 'index.html'), 'utf8')).toBe(
    '<fixture-element></fixture-element>',
  );
  expect('fixtureRegistry' in globalThis).toBe(false);
});
