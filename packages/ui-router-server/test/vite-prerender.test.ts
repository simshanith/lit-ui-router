import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { getByText } from '@testing-library/dom';
import { parseHtml } from '@tools/lit-test-env/parse-html.ts';
import { build, createBuilder, preview } from 'vite';
import type { PreviewServer } from 'vite';

import { createServerRouter } from '../src/index.ts';
import { serverRouterPlugin } from '../src/vite.ts';
import { LOG_LINES } from './fixtures/vite-prerender/src/prerender-logs.ts';
import { keyedMounts } from './fixtures/vite-prerender/src/routes-keyed.ts';
import { mounts } from './fixtures/vite-prerender/src/routes.ts';

const execNode = promisify(execFile);

const root = path.join(import.meta.dirname, 'fixtures/vite-prerender');

/** The `<p>` whose whole text is `line`; throws unless there is exactly one. */
const paragraph = (page: string, line: string): HTMLElement =>
  getByText(parseHtml(page).body, line, { selector: 'p' });

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
    const line = paragraph(about, '/about 200');
    // the mount point and the module script have no role, so they're found by id and attribute
    const root = line.ownerDocument.querySelector('#root');
    assert.ok(root);
    assert.equal(root.childNodes.length, 1);
    assert.equal(root.firstChild, line);
    const script = line.ownerDocument.querySelector('script[src]');
    assert.ok(script);
    assert.equal(script.getAttribute('type'), 'module');
    assert.ok(script.hasAttribute('crossorigin'));
    assert.match(script.getAttribute('src') ?? '', /^\/assets\//);

    const notFound = await readFile(path.join(outDir, '404.html'), 'utf8');
    assert.ok(paragraph(notFound, '/__ui-router-server-probe__ 404'));

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
    assert.ok(paragraph(await about.text(), '/about 200'));

    const missing = await page('/nowhere');
    assert.equal(missing.status, 404);
    assert.ok(
      paragraph(await missing.text(), '/__ui-router-server-probe__ 404'),
    );

    const legacy = await page('/legacy');
    assert.equal(legacy.status, 302);
    assert.equal(legacy.headers.get('location'), '/about');
  });
});

// The same fixture built and previewed under `--base=/solar/`.
describe('serverRouterPlugin prerender under a base, end to end', () => {
  const base = '/solar/';
  let outDir = '';
  let server: PreviewServer | undefined;

  before(async () => {
    outDir = await mkdtemp(path.join(tmpdir(), 'ui-router-server-vite-base-'));
    await build({
      root,
      base,
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

  it('writes the pages where they were, and the base into _redirects', async () => {
    const about = await readFile(path.join(outDir, 'about/index.html'), 'utf8');

    const script = paragraph(about, '/about 200').ownerDocument.querySelector(
      'script[src]',
    );

    assert.match(script?.getAttribute('src') ?? '', /^\/solar\/assets\//);
    assert.equal(
      await readFile(path.join(outDir, '_redirects'), 'utf8'),
      '/solar/legacy /solar/about 302\n/solar/legacy/ /solar/about 302\n',
    );
  });

  it('previews the pages and redirects under the base', async () => {
    server = await preview({
      root,
      base,
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

    const home = await page('/solar/');
    assert.equal(home.status, 200);
    assert.ok(paragraph(await home.text(), '/ 200'));

    const about = await page('/solar/about');
    assert.equal(about.status, 200);
    assert.ok(paragraph(await about.text(), '/about 200'));

    const missing = await page('/solar/nowhere');
    assert.equal(missing.status, 404);
    assert.ok(
      paragraph(await missing.text(), '/__ui-router-server-probe__ 404'),
    );

    const legacy = await page('/solar/legacy');
    assert.equal(legacy.status, 302);
    assert.equal(legacy.headers.get('location'), '/solar/about');

    const outside = await page('/legacy');
    assert.equal(outside.status, 404);
    assert.equal(outside.headers.get('location'), null);
  });
});

// Every file under dir, keyed by its path relative to dir.
const tree = async (dir: string): Promise<Map<string, string>> => {
  const files = await readdir(dir, { recursive: true, withFileTypes: true });

  const entries = await Promise.all(
    files
      .filter((file) => file.isFile())
      .map(async (file) => {
        const full = path.join(file.parentPath, file.name);

        return [
          path.relative(dir, full),
          await readFile(full, 'utf8'),
        ] as const;
      }),
  );

  return new Map(entries.sort(([a], [b]) => a.localeCompare(b)));
};

// The answers a preview gives, request by request.
const answers = async (server: PreviewServer, urls: string[]) => {
  const origin = server.resolvedUrls?.local[0];
  assert.ok(origin);

  return Promise.all(
    urls.map(async (url) => {
      const res = await fetch(new URL(url, origin), {
        headers: { accept: 'text/html' },
        redirect: 'manual',
      });

      return {
        url,
        status: res.status,
        location: res.headers.get('location'),
        body: await res.text(),
      };
    }),
  );
};

// The relative table under Vite's `base`, and the table keyed by the base under `createServerRouter({ base })`.
describe('serverRouterPlugin under a base, keyed or relative', () => {
  const base = '/app/';

  const urls = [
    '/app/',
    '/app/about',
    '/app/legacy',
    '/app/nowhere',
    '/legacy',
  ];

  const servers: PreviewServer[] = [];
  const dirs: string[] = [];

  const relative = () =>
    serverRouterPlugin(createServerRouter({ mounts }), {
      prerender: './src/prerender-relative.ts',
    });

  const keyed = () =>
    serverRouterPlugin(createServerRouter({ base, mounts: keyedMounts }), {
      prerender: './src/prerender-keyed.ts',
    });

  const buildWith = async (
    plugin: ReturnType<typeof serverRouterPlugin>,
    viteBase?: string,
  ) => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'ui-router-server-base-'));
    dirs.push(outDir);
    await build({
      root,
      base: viteBase,
      configFile: false,
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true },
      plugins: [plugin],
    });

    return outDir;
  };

  const previewWith = async (
    plugin: ReturnType<typeof serverRouterPlugin>,
    outDir: string,
    viteBase?: string,
  ) => {
    const server = await preview({
      root,
      base: viteBase,
      configFile: false,
      logLevel: 'silent',
      build: { outDir },
      preview: { port: 0, open: false },
      plugins: [plugin],
    });

    servers.push(server);

    return server;
  };

  after(async () => {
    await Promise.all(servers.map((server) => server.close()));
    await Promise.all(
      dirs.map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  it('builds the same dist and previews the same answers', async () => {
    const [relativeDir, keyedDir] = await Promise.all([
      buildWith(relative(), base),
      buildWith(keyed()),
    ]);

    const [relativeTree, keyedTree] = await Promise.all([
      tree(relativeDir),
      tree(keyedDir),
    ]);

    assert.deepEqual(keyedTree, relativeTree);
    assert.equal(
      relativeTree.get('_redirects'),
      '/app/legacy /app/about 302\n/app/legacy/ /app/about 302\n',
    );
    assert.ok(relativeTree.has('legacy/index.html'));
    assert.ok(relativeTree.has('404.html'));

    const relativeAnswers = await answers(
      await previewWith(relative(), relativeDir, base),
      urls,
    );

    const keyedAnswers = await answers(
      await previewWith(keyed(), keyedDir),
      urls,
    );

    assert.deepEqual(keyedAnswers, relativeAnswers);
    assert.deepEqual(
      relativeAnswers.map(({ url, status, location }) => [
        url,
        status,
        location,
      ]),
      [
        ['/app/', 200, null],
        ['/app/about', 200, null],
        ['/app/legacy', 302, '/app/about'],
        ['/app/nowhere', 404, null],
        ['/legacy', 404, null],
      ],
    );
    assert.ok(paragraph(relativeAnswers[1]?.body ?? '', '/about 200'));
  });

  const undeclared = () =>
    serverRouterPlugin(createServerRouter({ mounts: keyedMounts }), {
      prerender: './src/prerender-relative.ts',
    });

  const carried =
    /mount '\/app' already carries base '\/app\/': declare createServerRouter\(\{ base: '\/app\/', mounts \}\), or key the mount '\/'/;

  it('fails a build and a preview whose table already carries an undeclared base', async () => {
    await assert.rejects(buildWith(undeclared(), base), carried);
    await assert.rejects(previewWith(undeclared(), tmpdir(), base), carried);
  });

  it("fails when Vite's base and the router's differ", async () => {
    await assert.rejects(
      buildWith(keyed(), '/other/'),
      /Vite's base '\/other\/' differs from the router's base '\/app\/'/,
    );
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
    assert.ok(paragraph(about, '/about 200'));
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
    assert.ok(
      paragraph(
        await buildUnder(t, ['--conditions', 'production']),
        'one copy: true',
      ),
    );
  });

  it('reads --conditions from NODE_OPTIONS too', async (t) => {
    assert.ok(
      paragraph(
        await buildUnder(t, [], { NODE_OPTIONS: '--conditions=production' }),
        'one copy: true',
      ),
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
