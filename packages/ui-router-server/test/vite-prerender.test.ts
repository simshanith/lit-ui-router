import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { build, preview } from 'vite';
import type { PreviewServer } from 'vite';

import { createServerRouter } from '../src/index.ts';
import { serverRouterPlugin } from '../src/vite.ts';
import { mounts } from './fixtures/vite-prerender/src/routes.ts';

const root = path.join(import.meta.dirname, 'fixtures/vite-prerender');

const plugin = () =>
  serverRouterPlugin(createServerRouter({ mounts }), {
    prerender: { entry: './src/prerender.ts' },
  });

// A real `vite build` of the fixture, then `vite preview` over what it wrote.
describe('serverRouterPlugin prerender, end to end', () => {
  let outDir = '';
  let server: PreviewServer | undefined;

  before(async () => {
    outDir = await mkdtemp(path.join(tmpdir(), 'ui-router-server-vite-'));
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true },
      plugins: [plugin()],
    });
  });

  after(async () => {
    await server?.close();
    await rm(outDir, { recursive: true, force: true });
  });

  it('writes the pages, the 404 document and _redirects into the outDir', async () => {
    const files = (await readdir(outDir, { recursive: true })).sort();
    assert.ok(files.includes('assets'));
    assert.deepEqual(
      files.filter((file) => !file.startsWith('assets')),
      ['404.html', '_redirects', 'about', 'about/index.html', 'index.html'],
    );

    const about = await readFile(path.join(outDir, 'about/index.html'), 'utf8');
    assert.match(about, /<div id="root"><p>\/about 200<\/p><\/div>/);
    assert.match(about, /<script type="module" crossorigin src="\/assets\//);

    const notFound = await readFile(path.join(outDir, '404.html'), 'utf8');
    assert.match(notFound, /<p>\/__ui-router-server-probe__ 404<\/p>/);

    assert.equal(
      await readFile(path.join(outDir, '_redirects'), 'utf8'),
      '/legacy /about 302\n/legacy/ /about 302\n',
    );
  });

  it('previews the emitted pages, with redirects still from the middleware', async () => {
    server = await preview({
      root,
      configFile: false,
      logLevel: 'silent',
      build: { outDir },
      preview: { port: 0, open: false },
      plugins: [plugin()],
    });
    const origin = server.resolvedUrls?.local[0];
    assert.ok(origin);

    const page = (url: string) =>
      fetch(new URL(url, origin), {
        headers: { accept: 'text/html' },
        redirect: 'manual',
      });

    const about = await page('/about');
    assert.equal(about.status, 200);
    assert.match(await about.text(), /<p>\/about 200<\/p>/);

    const missing = await page('/nowhere');
    assert.equal(missing.status, 404);
    assert.match(await missing.text(), /<p>\/__ui-router-server-probe__ 404/);

    const legacy = await page('/legacy');
    assert.equal(legacy.status, 302);
    assert.equal(legacy.headers.get('location'), '/about');
  });
});
