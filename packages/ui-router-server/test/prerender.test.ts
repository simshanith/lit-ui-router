import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { TestContext } from 'node:test';

import { createServerRouter } from '../src/index.ts';
import type { MountConfig, ServerRouter, Verdict } from '../src/index.ts';
import { prerender } from '../src/prerender.ts';
import type {
  FileWriter,
  PrerenderOptions,
  RedirectLine,
  RenderContext,
} from '../src/prerender.ts';
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
      delegate: 0,
      response: 0,
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

  it('counts and lists a delegating state, emitting no page, rule or warning', async (t) => {
    const warn = silenceWarn(t);

    const delegating = {
      ...mounts,
      '/app': {
        ...appMount,
        routes: [
          ...appMount.routes,
          { name: 'claims', url: '/claims', delegate: 'ledger' },
        ],
      },
    };

    const { files, result } = await run({
      mounts: delegating,
      paths: ['/app/claims', '/app/welcome'],
      notFound: false,
    });

    assert.deepEqual(result.tally, {
      shell: 1,
      redirect: 0,
      notFound: 0,
      delegate: 1,
      response: 0,
      document: 0,
    });
    assert.deepEqual(result.delegated, ['/app/claims']);
    assert.deepEqual(
      result.pages.map((page) => page.path),
      ['/app/welcome'],
    );
    assert.deepEqual(result.rules, []);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual([...files.keys()], ['dist/welcome/index.html']);
    assert.equal(warn.mock.callCount(), 0);
  });

  describe('response states', () => {
    const responding = {
      ...mounts,
      '/app': {
        ...appMount,
        routes: [
          ...appMount.routes,
          { name: 'badge', url: '/badge.svg', response: true },
          { name: 'latest', url: '/latest', response: true },
        ],
      },
    } satisfies Record<string, MountConfig>;

    const answers = {
      badge: () =>
        new Response('<svg/>', {
          status: 200,
          headers: { 'Content-Type': 'image/svg+xml' },
        }),
      latest: () =>
        new Response(null, {
          status: 302,
          headers: { Location: '/app/welcome' },
        }),
    } satisfies Record<string, () => Response>;

    it('writes a 2xx body at its url and a 3xx as a rules line', async () => {
      const contexts: RenderContext[] = [];

      const { files, result } = await run({
        mounts: responding,
        paths: ['/app/badge.svg', '/app/latest', '/app/welcome'],
        notFound: false,
        respond: (verdict, context) => {
          contexts.push(context);

          // SAFETY: the mount declares exactly these two response states.
          return answers[verdict.state as keyof typeof answers]();
        },
      });

      assert.deepEqual(result.tally, {
        shell: 1,
        redirect: 0,
        notFound: 0,
        delegate: 0,
        response: 2,
        document: 0,
      });
      assert.deepEqual(contexts[0], {
        path: '/app/badge.svg',
        subpath: '/badge.svg',
        file: 'badge.svg',
      });
      assert.equal(files.get('dist/badge.svg'), '<svg/>');
      assert.equal(result.pages[0]?.verdict.kind, 'response');
      assert.equal(result.pages[0]?.bytes, 6);
      assert.deepEqual(result.rules, [
        { from: '/app/latest', to: '/app/welcome', status: 302 },
        { from: '/app/latest/', to: '/app/welcome', status: 302 },
      ]);
      assert.deepEqual(
        [...files.keys()],
        ['dist/badge.svg', 'dist/welcome/index.html', 'dist/_redirects'],
      );
    });

    it('throws when no respond is supplied', async () => {
      await assert.rejects(
        run({ mounts: responding, paths: ['/app/badge.svg'], notFound: false }),
        /'\/app\/badge.svg' matched response state 'badge'; pass `respond`/,
      );
    });

    it('throws for an answer a static host cannot serve', async () => {
      for (const answer of [
        new Response('gone', { status: 410 }),
        new Response(null, { status: 302 }),
      ])
        await assert.rejects(
          run({
            mounts: responding,
            paths: ['/app/badge.svg'],
            notFound: false,
            respond: () => answer,
          }),
          /response state 'badge' answered '\/app\/badge.svg' with (410|302)/,
        );
    });

    it('plans a body under dryRun, writing nothing', async () => {
      const { files, result } = await run({
        mounts: responding,
        paths: ['/app/badge.svg'],
        notFound: false,
        dryRun: true,
        respond: answers.badge,
      });

      assert.equal(files.size, 0);
      assert.equal(result.pages[0]?.file, 'badge.svg');
    });
  });

  it('throws for a verdict kind it does not know instead of counting it', async () => {
    const kind: string = 'forbidden';

    const resolver: ServerRouter = {
      // SAFETY: a newer ui-router-server's verdict kind, which this Verdict union lacks.
      resolve: () => Promise.resolve({ kind, mount: '/app' } as Verdict),
    };

    await assert.rejects(
      run({
        mounts: undefined,
        resolver,
        paths: ['/app/admin'],
        notFound: false,
      }),
      /'\/app\/admin' resolved to verdict kind 'forbidden'/,
    );
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
      render: () => 'aé€😀',
    });

    assert.equal(files.size, 0);
    assert.equal(result.pages[0]?.bytes, 1 + 2 + 3 + 4);
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

  it('writes through a caller-supplied node:fs writer', async (t) => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'ui-router-server-'));
    t.after(() => rm(outDir, { recursive: true, force: true }));

    await prerender({
      mounts,
      outDir,
      paths: ['/sheet/7B', '/app/legacy'],
      notFound: false,
      render: () => '<p>7B</p>',
      write: async (file, body) => {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, body);
      },
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
