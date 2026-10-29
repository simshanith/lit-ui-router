import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { TestContext } from 'node:test';

import { createServerRouter } from '../src/index.ts';
import type { MountConfig } from '../src/index.ts';
import { prerender } from '../src/ssr.ts';
import type {
  FileWriter,
  PrerenderOptions,
  RedirectLine,
  RenderContext,
} from '../src/ssr.ts';
import { stubDev } from './import-meta-env.ts';

// The root mount projects an otherwise rule; the /app mount has none, so its unmatched paths verdict notFound.
const rootMount: MountConfig = {
  routes: [
    { name: 'home', url: '/' },
    { name: 'sheet', url: '/sheet/:num' },
    { name: 'notFound' },
  ],
  otherwise: { state: 'notFound' },
  config: { strict: false },
};

const appMount: MountConfig = {
  routes: [
    { name: 'welcome', url: '/welcome' },
    { name: 'legacy', url: '/legacy', redirectTo: 'welcome' },
  ],
  config: { strict: false },
  ignoreDiagnostics: ['bareBaseNotFound'],
};

const mounts = { '/': rootMount, '/app': appMount };

const memoryWriter = () => {
  const files = new Map<string, string>();

  const write: FileWriter = (file, body) => {
    files.set(file, body);
  };

  return { files, write };
};

const run = async (overrides: Partial<PrerenderOptions> = {}) => {
  const { files, write } = memoryWriter();
  const contexts: RenderContext[] = [];

  const result = await prerender({
    mounts,
    outDir: 'dist',
    paths: ['/', '/sheet/7B', '/app/legacy'],
    render: (verdict, context) => {
      contexts.push(context);

      return `<p>${context.path} ${verdict.status ?? 200}</p>`;
    },
    write,
    ...overrides,
  });

  return { files, result, contexts };
};

const silenceWarn = (t: TestContext) =>
  t.mock.method(console, 'warn', () => {});

describe('prerender', () => {
  it('writes each shell through render and the 404 document from the projection', async () => {
    const { files, result, contexts } = await run();

    assert.deepEqual(
      [...files.keys()],
      [
        'dist/index.html',
        'dist/sheet/7B/index.html',
        'dist/404.html',
        'dist/_redirects',
      ],
    );
    assert.equal(files.get('dist/sheet/7B/index.html'), '<p>/sheet/7B 200</p>');
    assert.deepEqual(result.tally, {
      shell: 2,
      redirect: 1,
      notFound: 0,
      document: 1,
    });
    assert.deepEqual(contexts[1], {
      path: '/sheet/7B',
      subpath: '/sheet/7B',
      file: 'sheet/7B/index.html',
    });
    assert.equal(result.pages[2]?.verdict.kind, 'shell');
    assert.equal(result.pages[2]?.file, '404.html');
  });

  it('writes redirects as rules lines in both spellings, extraRules first', async () => {
    const legacy: RedirectLine = { from: '/old', to: '/', status: 301 };

    const { files, result } = await run({
      paths: ['/app/legacy'],
      notFound: false,
      extraRules: [legacy],
    });

    assert.deepEqual(result.rules, [
      legacy,
      { from: '/app/legacy', to: '/app/welcome', status: 302 },
      { from: '/app/legacy/', to: '/app/welcome', status: 302 },
    ]);
    assert.equal(
      files.get('dist/_redirects'),
      '/old / 301\n/app/legacy /app/welcome 302\n/app/legacy/ /app/welcome 302\n',
    );
  });

  it('writes one spelling under exact, and hands lines to a rules function', async () => {
    let received: RedirectLine[] = [];

    const { files, result } = await run({
      paths: ['/app/legacy'],
      notFound: false,
      trailingSlash: 'exact',
      rules: (lines) => {
        received = lines;
      },
    });

    assert.equal(result.rules.length, 1);
    assert.deepEqual(received, result.rules);
    assert.equal(files.has('dist/_redirects'), false);
  });

  it('counts and warns on an unclaimed path, emitting nothing', async (t) => {
    const warn = silenceWarn(t);

    const { files, result } = await run({
      paths: ['/app/missing'],
      notFound: false,
    });

    assert.equal(result.tally.notFound, 1);
    assert.deepEqual(result.warnings, ['/app/missing']);
    assert.equal(files.size, 0);
    assert.equal(warn.mock.callCount(), 1);
    assert.match(
      String(warn.mock.calls[0]?.arguments[0]),
      /^ui-router-server: prerender: .*no otherwise projection/,
    );
    assert.equal(warn.mock.calls[0]?.arguments[1], '/app/missing');
  });

  it('warns once when a mount rejects the trailing slash a static host adds', async (t) => {
    const warn = silenceWarn(t);
    const strict = { ...mounts, '/': { ...rootMount, config: {} } };

    await run({
      mounts: strict,
      paths: ['/', '/sheet/7B', '/sheet/12'],
      notFound: false,
    });

    assert.equal(warn.mock.callCount(), 1);
    assert.match(String(warn.mock.calls[0]?.arguments[0]), /strict: false/);
    assert.equal(warn.mock.calls[0]?.arguments[1], '/sheet/7B');
  });

  it('raises no warning outside development', async (t) => {
    const warn = silenceWarn(t);
    t.after(stubDev(false));

    const { result } = await run({
      mounts: { ...mounts, '/': { ...rootMount, config: {} } },
      paths: ['/sheet/7B', '/app/missing'],
      notFound: false,
    });

    assert.deepEqual(result.warnings, ['/app/missing']);
    assert.equal(warn.mock.callCount(), 0);
  });

  it('plans and sizes every page under dryRun, writing nothing', async (t) => {
    silenceWarn(t);

    const { files, result } = await run({
      paths: ['/sheet/7B'],
      notFound: false,
      dryRun: true,
      render: () => 'aé€😀\uD800',
    });

    assert.equal(files.size, 0);
    assert.equal(result.pages[0]?.bytes, 1 + 2 + 3 + 4 + 3);
  });

  it('takes a compiled resolver, and refuses what it cannot probe', async () => {
    const resolver = createServerRouter({ mounts });

    const { files } = await run({
      mounts: undefined,
      resolver,
      paths: ['/sheet/7B'],
      notFound: false,
    });

    assert.deepEqual([...files.keys()], ['dist/sheet/7B/index.html']);
    await assert.rejects(run({ mounts: undefined, paths: [] }), /mount table/);
    await assert.rejects(
      run({ mounts: undefined, resolver, paths: [] }),
      /notFound.probe/,
    );
  });

  it('writes through node:fs by default', async (t) => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'ui-router-server-'));
    t.after(() => rm(outDir, { recursive: true, force: true }));

    await prerender({
      mounts,
      outDir,
      paths: ['/sheet/7B', '/app/legacy'],
      notFound: false,
      render: () => '<p>7B</p>',
    });

    assert.equal(
      await readFile(path.join(outDir, 'sheet/7B/index.html'), 'utf8'),
      '<p>7B</p>',
    );
    assert.match(
      await readFile(path.join(outDir, '_redirects'), 'utf8'),
      /^\/app\/legacy \/app\/welcome 302$/m,
    );
  });
});
