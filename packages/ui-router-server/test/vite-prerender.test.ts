import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { build, createBuilder, preview } from 'vite';
import type { PreviewServer } from 'vite';

import { createServerRouter } from '../src/index.ts';
import { serverRouterPlugin } from '../src/vite.ts';
import { LOG_LINES } from './fixtures/vite-prerender/src/prerender-logs.ts';
import { mounts } from './fixtures/vite-prerender/src/routes.ts';

const execNode = promisify(execFile);

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

const tempDir = async (t: TestContext) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ui-router-server-vite-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  return dir;
};

describe('serverRouterPlugin prerender, in a worker', () => {
  const buildElement = async (outDir: string) => {
    await build({
      root,
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

    return readFile(path.join(outDir, 'index.html'), 'utf8');
  };

  it('prerenders twice in one process, with nothing left in its globals', async (t) => {
    const [first, second] = [await tempDir(t), await tempDir(t)];

    assert.equal(
      await buildElement(first),
      '<fixture-element></fixture-element>',
    );
    assert.equal(
      await buildElement(second),
      '<fixture-element></fixture-element>',
    );
    assert.ok(!('fixtureRegistry' in globalThis));
  });

  it('prerenders under vitest, in a happy-dom environment', async () => {
    const vitest = fileURLToPath(
      import.meta
        .resolve('vitest/package.json')
        .replace(/package\.json$/, 'vitest.mjs'),
    );

    await execNode(
      process.execPath,
      [vitest, 'run', '--config', 'vitest.config.ts'],
      {
        cwd: root,
      },
    );
  });
});

describe('serverRouterPlugin prerender, per environment', () => {
  it("prerenders once, after the client environment's build under buildApp", async (t) => {
    const [outDir, ssrOutDir] = await Promise.all([tempDir(t), tempDir(t)]);

    const builder = await createBuilder({
      root,
      configFile: false,
      logLevel: 'silent',
      builder: {},
      environments: {
        client: { build: { outDir, emptyOutDir: true } },
        ssr: {
          build: {
            outDir: ssrOutDir,
            emptyOutDir: true,
            ssr: path.join(root, 'src/main.ts'),
          },
        },
      },
      plugins: [plugin()],
    });

    await builder.buildApp();

    const about = await readFile(path.join(outDir, 'about/index.html'), 'utf8');
    assert.match(about, /<p>\/about 200<\/p>/);
    assert.ok(!(await readdir(ssrOutDir)).includes('_redirects'));
  });

  const buildUnder = async (
    t: TestContext,
    args: string[],
    env: Record<string, string> = {},
  ) => {
    const outDir = await tempDir(t);
    await execNode(
      process.execPath,
      [
        ...args,
        '--import',
        './test/import-meta-env.ts',
        '--import',
        path.join(root, 'capture-prerender.ts'),
        path.join(root, 'build-entry.ts'),
        outDir,
        './src/prerender-identity.ts',
      ],
      {
        cwd: path.join(import.meta.dirname, '..'),
        env: { ...process.env, ...env },
      },
    );

    return readFile(path.join(outDir, 'index.html'), 'utf8');
  };

  // This package's `node` export is its development build, so `production` is the condition that splits it.
  it("loads the entry's dependencies under the process's --conditions", async (t) => {
    assert.match(
      await buildUnder(t, ['--conditions', 'production']),
      /one copy: true/,
    );
  });

  it('reads --conditions from NODE_OPTIONS too', async (t) => {
    assert.match(
      await buildUnder(t, [], { NODE_OPTIONS: '--conditions=production' }),
      /one copy: true/,
    );
  });
});

describe("serverRouterPlugin prerender, the worker's output", () => {
  const expected = (stream: string) =>
    Array.from(
      { length: LOG_LINES },
      (_, line) => `${stream} line ${String(line)}`,
    );

  const buildLogs = async (t: TestContext, entry: string) =>
    execNode(
      process.execPath,
      [
        '--import',
        './test/import-meta-env.ts',
        path.join(root, 'build-entry.ts'),
        await tempDir(t),
        entry,
      ],
      { cwd: path.join(import.meta.dirname, '..') },
    );

  it('reaches the parent whole before the worker is terminated', async (t) => {
    const { stdout, stderr } = await buildLogs(t, './src/prerender-logs.ts');

    const lines = (stream: string, output: string) =>
      output.split('\n').filter((line) => line.startsWith(`${stream} line `));

    assert.deepEqual(lines('stdout', stdout), expected('stdout'));
    assert.deepEqual(lines('stderr', stderr), expected('stderr'));
  });

  it('reaches the parent whole when the entry throws', async (t) => {
    await assert.rejects(buildLogs(t, './src/prerender-logs-throw.ts'), {
      stdout: new RegExp(expected('stdout').join('\n')),
      stderr: new RegExp(expected('stderr').join('\n')),
    });
  });
});
