import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import type { TestContext } from 'node:test';

import { createFetchHandler } from '../src/fetch.ts';
import { createServerRouter } from '../src/index.ts';
import type {
  MountConfig,
  ServerRouter,
  TrailingSlashPolicy,
  Verdict,
} from '../src/index.ts';
import {
  prerender,
  redirectPage,
  redirectPages,
  withBase,
} from '../src/prerender.ts';
import type {
  FileWriter,
  PathReport,
  PrerenderOptions,
  RedirectLine,
  RenderContext,
} from '../src/prerender.ts';
import { fileFor } from '../src/site-paths.ts';
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

  it('puts the base once on every generated line, leaving extraRules and page files as written', async () => {
    const legacy: RedirectLine = { from: '/old', to: '/', status: 301 };
    const away = { location: 'https://example.com/', status: 302 };

    const { files, result } = await run({
      base: '/solar/',
      paths: ['/', '/sheet/7B', '/app/legacy'],
      notFound: false,
      extraRules: [legacy],
      render: (_verdict, { path }) => (path === '/sheet/7B' ? away : 'page'),
    });

    assert.deepEqual(result.rules, [
      legacy,
      { from: '/solar/sheet/7B', to: 'https://example.com/', status: 302 },
      { from: '/solar/sheet/7B/', to: 'https://example.com/', status: 302 },
      { from: '/solar/app/legacy', to: '/solar/app/welcome', status: 302 },
      { from: '/solar/app/legacy/', to: '/solar/app/welcome', status: 302 },
    ]);
    assert.deepEqual([...files.keys()], ['dist/index.html', 'dist/_redirects']);
  });

  it('hands the base to a rules function, and rejects a relative or full-URL base', async () => {
    let base = '';

    await run({
      base: '/solar',
      paths: [],
      notFound: false,
      rules: (_lines, context) => {
        base = context.base;
      },
    });
    assert.equal(base, '/solar/');
    await assert.rejects(
      run({ base: './' }),
      /prerender: base '.\/' is relative/,
    );
    await assert.rejects(
      run({ base: 'https://cdn.example.com/' }),
      /prerender: base 'https:\/\/cdn.example.com\/' is a full URL/,
    );
  });

  it('hands lines to a rules function and writes no rules file', async () => {
    let received: RedirectLine[] = [];

    const { files, result } = await run({
      paths: ['/app/legacy'],
      notFound: false,
      rules: (lines) => {
        received = lines;
      },
    });

    assert.equal(result.rules.length, 2);
    assert.deepEqual(received, result.rules);
    assert.equal(files.has('dist/_redirects'), false);
  });

  describe("the mount's trailing-slash policy", () => {
    const respelling = (trailingSlash: TrailingSlashPolicy) =>
      ({
        ...mounts,
        '/app': {
          ...appMount,
          routes: [
            ...appMount.routes,
            { name: 'badge', url: '/badge.svg', response: true },
          ],
          config: { strict: false, trailingSlash },
        },
      }) satisfies Record<string, MountConfig>;

    const badge = () => new Response('<svg/>', { status: 200 });

    it("writes a 308 from a page's other spelling under 'always'", async () => {
      const { files, result } = await run({
        mounts: respelling({ pages: 'always' }),
        paths: ['/app/welcome/', '/app/legacy'],
        notFound: false,
      });

      assert.deepEqual(
        [...files.keys()],
        ['dist/welcome/index.html', 'dist/_redirects'],
      );
      assert.deepEqual(result.rules, [
        { from: '/app/welcome', to: '/app/welcome/', status: 308 },
        { from: '/app/legacy', to: '/app/welcome/', status: 302 },
        { from: '/app/legacy/', to: '/app/welcome/', status: 302 },
      ]);
    });

    it("writes a 308 from a page's other spelling under 'never'", async (t) => {
      const warn = silenceWarn(t);

      const { result } = await run({
        mounts: respelling({ pages: 'never' }),
        paths: ['/app/welcome'],
        notFound: false,
      });

      assert.deepEqual(result.rules, [
        { from: '/app/welcome/', to: '/app/welcome', status: 308 },
      ]);
      assert.equal(warn.mock.callCount(), 0);
    });

    it('respells a response state by its own policy, not the pages one', async () => {
      const { files, result } = await run({
        mounts: respelling({ pages: 'always', responses: 'never' }),
        paths: ['/app/badge.svg'],
        notFound: false,
        respond: badge,
      });

      assert.equal(files.get('dist/badge.svg'), '<svg/>');
      assert.deepEqual(result.rules, [
        { from: '/app/badge.svg/', to: '/app/badge.svg', status: 308 },
      ]);
    });

    it('writes one line for a listed other spelling, never a loop', async () => {
      const { files, result } = await run({
        mounts: respelling({ pages: 'always' }),
        paths: ['/app/welcome', '/app/welcome/'],
        notFound: false,
      });

      assert.deepEqual(
        [...files.keys()],
        ['dist/welcome/index.html', 'dist/_redirects'],
      );
      assert.deepEqual(result.rules, [
        { from: '/app/welcome', to: '/app/welcome/', status: 308 },
      ]);
      assert.equal(result.tally.redirect, 1);
    });

    it("writes no line from either spelling under 'as-requested'", async () => {
      const { result } = await run({
        mounts: respelling({ responses: 'as-requested' }),
        paths: ['/app/welcome', '/app/badge.svg'],
        notFound: false,
        respond: badge,
      });

      assert.deepEqual(result.rules, []);
    });

    it('reads the policy from a compiled resolver', async () => {
      const { result } = await run({
        mounts: undefined,
        resolver: createServerRouter({
          mounts: respelling({ pages: 'always' }),
        }),
        paths: ['/app/welcome/'],
        notFound: false,
      });

      assert.deepEqual(result.rules, [
        { from: '/app/welcome', to: '/app/welcome/', status: 308 },
      ]);
    });
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

    it("reports each page's status as the fetch adapter answers its path", async () => {
      // A 203 badge proves the page keeps the answer's own 2xx.
      const respond = (verdict: Verdict & { kind: 'response' }) =>
        verdict.state === 'badge'
          ? new Response('<svg/>', { status: 203 })
          : answers.latest();

      const { result } = await run({
        mounts: responding,
        paths: ['/', '/sheet/7B', '/app/badge.svg', '/app/latest'],
        respond,
      });

      const handler = createFetchHandler(
        createServerRouter({ mounts: responding }),
        {
          serveShell: () => new Response('shell'),
          serveResponse: respond,
        },
      );

      const answered = await Promise.all(
        result.pages.map(async ({ path, status }) => {
          const res = await handler(
            new Request(`https://example.test${path}`, {
              headers: { accept: 'text/html' },
            }),
          );

          return [path, status, res?.status];
        }),
      );

      assert.deepEqual(answered, [
        ['/', 200, 200],
        ['/sheet/7B', 200, 200],
        ['/app/badge.svg', 203, 203],
        [result.pages[3]?.path, 404, 404],
      ]);
      assert.equal(result.pages[3]?.file, '404.html');
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

  it('writes a render that answers a redirect as a rules line and no page, counted as a redirect', async () => {
    const { files, result } = await run({
      paths: ['/', '/sheet/7B'],
      notFound: false,
      render: (_verdict, { path }) =>
        path === '/sheet/7B' ? { location: '/sheet/7', status: 308 } : '<p/>',
    });

    assert.deepEqual([...files.keys()], ['dist/index.html', 'dist/_redirects']);
    assert.equal(
      files.get('dist/_redirects'),
      '/sheet/7B /sheet/7 308\n/sheet/7B/ /sheet/7 308\n',
    );
    assert.deepEqual(
      result.pages.map((page) => page.path),
      ['/'],
    );
    assert.equal(result.tally.shell, 1);
    assert.equal(result.tally.redirect, 1);
  });

  it('reports each listed path once, in order, with its page or redirect', async (t) => {
    silenceWarn(t);
    const reports: PathReport[] = [];

    await run({
      paths: ['/', '/sheet/7B', '/app/legacy', '/app/nope'],
      render: (_verdict, { path }) =>
        path === '/sheet/7B' ? { location: '/sheet/7', status: 308 } : '<p/>',
      onPath: (report) => reports.push(report),
    });

    assert.deepEqual(
      reports.map(({ path, verdict, page, redirect }) => [
        path,
        verdict.kind,
        page?.file,
        redirect,
      ]),
      [
        ['/', 'shell', 'index.html', undefined],
        [
          '/sheet/7B',
          'shell',
          undefined,
          { location: '/sheet/7', status: 308 },
        ],
        [
          '/app/legacy',
          'redirect',
          undefined,
          { location: '/app/welcome', status: 302 },
        ],
        ['/app/nope', 'notFound', undefined, undefined],
      ],
    );
  });

  it('throws when the 404 document’s render answers a redirect', async () => {
    await assert.rejects(
      run({
        paths: [],
        render: () => ({ location: '/', status: 302 }),
      }),
      /the 404 document's render for '\/__ui-router-server-probe__' answered a redirect/,
    );
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

describe('redirectPages', () => {
  // Runs a redirect page's script against a request url; answers where location.replace went.
  const replaceTarget = (page: string, href: string): string => {
    const script = /<script>([\s\S]*)<\/script>/.exec(page)?.[1] ?? '';
    const url = new URL(href);
    let replaced = '';

    runInNewContext(script, {
      URL,
      location: {
        href,
        search: url.search,
        hash: url.hash,
        replace: (to: string) => {
          replaced = to;
        },
      },
    });

    return replaced;
  };

  it('writes one page per redirect, shared by both spellings, and no rules file', async () => {
    const { files, result } = await run({
      paths: ['/app/legacy'],
      notFound: false,
      rules: redirectPages(),
    });

    assert.equal(result.rules.length, 2);
    assert.deepEqual([...files.keys()], ['dist/app/legacy/index.html']);
    const page = files.get('dist/app/legacy/index.html') ?? '';

    assert.match(
      page,
      /<meta http-equiv="refresh" content="0; url=\/app\/welcome">/,
    );
    assert.match(page, /<link rel="canonical" href="\/app\/welcome">/);
    assert.match(page, /<meta name="robots" content="noindex">/);
    assert.match(page, /<a href="\/app\/welcome">/);
  });

  it("takes prerender's base by default, writing pages under outDir", async () => {
    const { files } = await run({
      base: '/solar/',
      paths: ['/app/legacy'],
      notFound: false,
      rules: redirectPages(),
    });

    assert.deepEqual([...files.keys()], ['dist/app/legacy/index.html']);
    assert.match(
      files.get('dist/app/legacy/index.html') ?? '',
      /<link rel="canonical" href="\/solar\/app\/welcome">/,
    );
  });

  it('carries the query and fragment into a target that has none', async () => {
    const { files } = await run({
      paths: [],
      notFound: false,
      extraRules: [
        { from: '/old', to: '/new', status: 301 },
        { from: '/kept', to: '/new?tab=a#top', status: 301 },
      ],
      rules: redirectPages(),
    });

    assert.equal(
      replaceTarget(
        files.get('dist/old/index.html') ?? '',
        'https://example.com/old/?q=1#x',
      ),
      'https://example.com/new?q=1#x',
    );
    assert.equal(
      replaceTarget(
        files.get('dist/kept/index.html') ?? '',
        'https://example.com/kept?q=1#x',
      ),
      'https://example.com/new?tab=a#top',
    );
  });

  it('escapes the target in markup and script', async () => {
    const to = 'https://example.com/a?x="</script><b>"&y=\'1\'';

    const { files } = await run({
      paths: [],
      notFound: false,
      extraRules: [{ from: '/out', to, status: 302 }],
      rules: redirectPages(),
    });

    const page = files.get('dist/out/index.html') ?? '';

    assert.doesNotMatch(page, /<b>/);
    assert.equal(page.match(/<\/script>/g)?.length, 1);
    assert.match(
      page,
      /href="https:\/\/example.com\/a\?x=&quot;&lt;\/script&gt;&lt;b&gt;&quot;&amp;y=&#39;1&#39;"/,
    );
    assert.equal(
      replaceTarget(page, 'https://example.com/out'),
      new URL(to).href,
    );
  });

  it('escapes & < > " \' in the refresh url and canonical href, and keeps the script closed', () => {
    const to = '/a?b=1&c=<x>"\'</script>';
    const page = redirectPage({ from: '/from', to, status: 301 });
    const escaped = '/a?b=1&amp;c=&lt;x&gt;&quot;&#39;&lt;/script&gt;';

    assert.ok(
      page.includes(`<meta http-equiv="refresh" content="0; url=${escaped}">`),
    );
    assert.ok(page.includes(`<link rel="canonical" href="${escaped}">`));
    assert.equal(page.match(/<\/script>/g)?.length, 1);
    assert.equal(
      replaceTarget(page, 'https://example.com/from'),
      new URL(to, 'https://example.com/from').href,
    );
  });

  it('writes a page for a render that answered a redirect and a response state’s 3xx', async () => {
    const { files } = await run({
      mounts: {
        '/': {
          routes: [
            { name: 'sheet', url: '/sheet/:num' },
            { name: 'go', url: '/go', response: true },
          ],
        },
      },
      paths: ['/sheet/7B', '/go'],
      notFound: false,
      render: () => ({ location: '/sheet/7', status: 308 }),
      respond: () =>
        new Response(null, { status: 303, headers: { Location: '/sheet/1' } }),
      rules: redirectPages(),
    });

    assert.deepEqual(
      [...files.keys()],
      ['dist/sheet/7B/index.html', 'dist/go/index.html'],
    );
    assert.match(files.get('dist/go/index.html') ?? '', /url=\/sheet\/1"/);
  });

  it('keeps the first line for a page, as _redirects does', async () => {
    const { files } = await run({
      paths: ['/app/legacy'],
      notFound: false,
      extraRules: [{ from: '/app/legacy/', to: '/', status: 301 }],
      rules: redirectPages(),
    });

    assert.match(files.get('dist/app/legacy/index.html') ?? '', /url=\/"/);
  });

  it('throws for a redirect whose page would replace a prerendered one', async () => {
    await assert.rejects(
      run({
        extraRules: [{ from: '/sheet/7B/', to: '/', status: 301 }],
        rules: redirectPages(),
      }),
      /redirectPages: '\/sheet\/7B\/' redirects, but prerender wrote a page at 'sheet\/7B\/index.html'/,
    );
  });

  it('throws for a pattern line', async () => {
    await assert.rejects(
      run({
        paths: [],
        notFound: false,
        extraRules: [{ from: '/blog/*', to: '/', status: 301 }],
        rules: redirectPages(),
      }),
      /'\/blog\/\*' is a pattern, not a path/,
    );
  });

  it('writes the base itself as index.html, and into an empty outDir', async () => {
    const { files } = await run({
      paths: [],
      notFound: false,
      outDir: '',
      extraRules: [{ from: '/app', to: '/app/home', status: 301 }],
      rules: redirectPages({ base: '/app/' }),
    });

    assert.deepEqual([...files.keys()], ['index.html']);
  });

  it('places pages under base, and throws for a line outside it', async () => {
    const { files } = await run({
      paths: ['/app/legacy'],
      notFound: false,
      rules: redirectPages({ base: '/app/' }),
    });

    assert.deepEqual([...files.keys()], ['dist/legacy/index.html']);

    await assert.rejects(
      run({
        paths: [],
        notFound: false,
        extraRules: [{ from: '/old', to: '/', status: 301 }],
        rules: redirectPages({ base: '/app' }),
      }),
      /'\/old' lies outside base '\/app'/,
    );
  });

  it('writes the _redirects file too under redirectsFile', async () => {
    const { files } = await run({
      paths: ['/app/legacy'],
      notFound: false,
      rules: redirectPages({ redirectsFile: true }),
    });

    assert.deepEqual(
      [...files.keys()],
      ['dist/app/legacy/index.html', 'dist/_redirects'],
    );
    assert.equal(
      files.get('dist/_redirects'),
      '/app/legacy /app/welcome 302\n/app/legacy/ /app/welcome 302\n',
    );
  });

  it("writes no page for a line between a path's two spellings", async () => {
    const { files, result } = await run({
      mounts: {
        ...mounts,
        '/app': {
          ...appMount,
          config: { strict: false, trailingSlash: { pages: 'always' } },
        },
      },
      paths: ['/app/welcome/', '/app/legacy'],
      notFound: false,
      rules: redirectPages({ base: '/app/' }),
    });

    assert.deepEqual(result.rules[0], {
      from: '/app/welcome',
      to: '/app/welcome/',
      status: 308,
    });
    assert.deepEqual(
      [...files.keys()],
      ['dist/welcome/index.html', 'dist/legacy/index.html'],
    );
    assert.match(
      files.get('dist/legacy/index.html') ?? '',
      /url=\/app\/welcome\/"/,
    );
  });

  it('writes nothing under dryRun', async () => {
    const { files } = await run({
      paths: ['/app/legacy'],
      notFound: false,
      dryRun: true,
      rules: redirectPages({ redirectsFile: true }),
    });

    assert.equal(files.size, 0);
  });

  // A template that spells out the whole line, so a test sees which line built each page.
  const linePage = (line: RedirectLine): string =>
    `${line.from} ${line.to} ${line.status}`;

  it('builds every page through a custom page, which receives the whole line', async () => {
    const received: RedirectLine[] = [];

    const { files } = await run({
      paths: ['/app/legacy'],
      notFound: false,
      extraRules: [{ from: '/old', to: '/new', status: 308 }],
      rules: redirectPages({
        page: (line) => {
          received.push(line);

          return linePage(line);
        },
      }),
    });

    assert.deepEqual(Object.fromEntries(files), {
      'dist/old/index.html': '/old /new 308',
      'dist/app/legacy/index.html': '/app/legacy /app/welcome 302',
    });
    assert.deepEqual(
      received.map((line) => line.status),
      [308, 302],
    );
  });

  it('awaits an async page', async () => {
    const { files } = await run({
      paths: ['/app/legacy'],
      notFound: false,
      rules: redirectPages({
        page: async (line) => {
          await Promise.resolve();

          return linePage(line);
        },
      }),
    });

    assert.equal(
      files.get('dist/app/legacy/index.html'),
      '/app/legacy /app/welcome 302',
    );
  });

  it('exports the default page as redirectPage', async () => {
    const options: Partial<PrerenderOptions> = {
      paths: ['/app/legacy'],
      notFound: false,
    };

    const builtIn = await run({ ...options, rules: redirectPages() });

    const wrapped = await run({
      ...options,
      rules: redirectPages({ page: (line) => redirectPage(line) }),
    });

    assert.deepEqual(wrapped.files, builtIn.files);
    assert.equal(
      builtIn.files.get('dist/app/legacy/index.html'),
      redirectPage({ from: '/app/legacy', to: '/app/welcome', status: 302 }),
    );
  });

  it('keeps first-wins, overlap, pattern and base rules under a custom page', async () => {
    const first = await run({
      paths: ['/app/legacy'],
      notFound: false,
      extraRules: [{ from: '/app/legacy/', to: '/', status: 301 }],
      rules: redirectPages({ page: linePage, base: '/app/' }),
    });

    assert.deepEqual(Object.fromEntries(first.files), {
      'dist/legacy/index.html': '/app/legacy/ / 301',
    });

    await assert.rejects(
      run({
        extraRules: [{ from: '/sheet/7B/', to: '/', status: 301 }],
        rules: redirectPages({ page: linePage }),
      }),
      /prerender wrote a page at 'sheet\/7B\/index.html'/,
    );
    await assert.rejects(
      run({
        paths: [],
        notFound: false,
        extraRules: [{ from: '/blog/*', to: '/', status: 301 }],
        rules: redirectPages({ page: linePage }),
      }),
      /'\/blog\/\*' is a pattern, not a path/,
    );
    await assert.rejects(
      run({
        paths: [],
        notFound: false,
        extraRules: [{ from: '/old', to: '/', status: 301 }],
        rules: redirectPages({ page: linePage, base: '/app' }),
      }),
      /'\/old' lies outside base '\/app'/,
    );
  });
});

describe('withBase', () => {
  it('puts a base, with or without its trailing slash, in front of a host-absolute path', () => {
    assert.equal(withBase('/solar/', '/contacts'), '/solar/contacts');
    assert.equal(withBase('/solar', '/contacts'), '/solar/contacts');
    assert.equal(withBase('/solar/', '/'), '/solar/');
    assert.equal(
      withBase('/a/b/', '/contacts?q=1#top'),
      '/a/b/contacts?q=1#top',
    );
  });

  it('leaves the path as written under the root base', () => {
    assert.equal(withBase('/', '/contacts'), '/contacts');
  });

  it('leaves a full url, a protocol-relative url and a relative path as written', () => {
    for (const target of [
      'https://example.test/contacts',
      '//example.test/contacts',
      'contacts',
      './contacts',
      '?q=1',
    ])
      assert.equal(withBase('/solar/', target), target);
  });

  it('adds the base to a path that already carries it', () => {
    assert.equal(
      withBase('/solar/', '/solar/contacts'),
      '/solar/solar/contacts',
    );
  });

  it('spells a reported redirect as the run’s rules line does', async (t) => {
    silenceWarn(t);
    const reports: PathReport[] = [];

    const { result } = await run({
      base: '/solar/',
      rules: 'none',
      paths: ['/app/legacy'],
      notFound: false,
      onPath: (report) => reports.push(report),
    });

    const [report] = reports;
    assert.equal(report?.redirect?.location, '/app/welcome');
    assert.equal(
      withBase('/solar/', report?.redirect?.location ?? ''),
      result.rules[0]?.to,
    );
  });
});

describe('prerender path encoding', () => {
  const tagMounts = {
    '/': {
      routes: [
        { name: 'tag', url: '/tags/:tag' },
        { name: 'short', url: '/t/:tag', redirectTo: 'tag' },
        { name: 'feed', url: '/feeds/:tag', response: true },
      ],
      config: { strict: false },
    },
  } satisfies Record<string, MountConfig>;

  const tags = (paths: string[], overrides: Partial<PrerenderOptions> = {}) =>
    run({ mounts: tagMounts, paths, notFound: false, ...overrides });

  for (const [spelling, page, short] of [
    ['encoded', '/tags/a%20b', '/t/a%20b'],
    ['decoded', '/tags/a b', '/t/a b'],
  ] as const)
    it(`writes a decoded file name and encoded rules lines for a space listed ${spelling}`, async () => {
      const { files, result, contexts } = await tags([page, short]);

      assert.deepEqual(
        [...files.keys()],
        ['dist/tags/a b/index.html', 'dist/_redirects'],
      );
      assert.equal(result.pages[0]?.file, 'tags/a b/index.html');
      assert.equal(result.pages[0]?.path, page);
      assert.equal(contexts[0]?.file, 'tags/a b/index.html');
      assert.equal(
        files.get('dist/_redirects'),
        '/t/a%20b /tags/a%20b 302\n/t/a%20b/ /tags/a%20b 302\n',
      );
    });

  for (const [spelling, page, short] of [
    ['encoded', '/tags/caf%C3%A9', '/t/caf%C3%A9'],
    ['decoded', '/tags/café', '/t/café'],
  ] as const)
    it(`writes a decoded file name and encoded rules lines for a non-ASCII path listed ${spelling}`, async () => {
      const { files } = await tags([page, short]);

      assert.deepEqual(
        [...files.keys()],
        ['dist/tags/café/index.html', 'dist/_redirects'],
      );
      assert.equal(
        files.get('dist/_redirects'),
        '/t/caf%C3%A9 /tags/caf%C3%A9 302\n/t/caf%C3%A9/ /tags/caf%C3%A9 302\n',
      );
    });

  it('writes one set of lines for a redirect listed in both spellings', async () => {
    const { result } = await tags(['/t/a b', '/t/a%20b']);

    assert.deepEqual(
      result.rules.map((line) => line.from),
      ['/t/a%20b', '/t/a%20b/'],
    );
  });

  it('keeps an encoded slash or backslash inside its segment', async () => {
    const { files } = await tags(['/tags/a%2Fb%20c', '/tags/a%5Cb']);

    assert.deepEqual(
      [...files.keys()],
      ['dist/tags/a%2Fb c/index.html', 'dist/tags/a%5Cb/index.html'],
    );
  });

  it('keeps an encoded dot segment as listed, inside outDir', async () => {
    const { files } = await tags(['/tags/%2E%2E', '/tags/%2e']);

    assert.deepEqual(
      [...files.keys()],
      ['dist/tags/%2E%2E/index.html', 'dist/tags/%2e/index.html'],
    );
  });

  it('names the listed path when its route cannot decode a malformed escape', async () => {
    for (const path of ['/tags/100%', '/tags/%E0%A4%A'])
      await assert.rejects(tags([path]), (error: Error) => {
        assert.equal(
          error.message,
          `prerender: '${path}' holds a malformed percent-escape, which its route cannot decode`,
        );
        assert.ok(error.cause instanceof URIError);

        return true;
      });
  });

  it('keeps a segment with a malformed escape as listed', () => {
    assert.equal(fileFor('/tags/100%/a%20b'), 'tags/100%/a b/index.html');
    assert.equal(fileFor('/tags/%E0%A4%A'), 'tags/%E0%A4%A/index.html');
  });

  it('writes a response body at its decoded file name', async () => {
    const { files, result } = await tags(['/feeds/a%20b', '/feeds/café'], {
      respond: () => new Response('<feed/>'),
    });

    assert.deepEqual([...files.keys()], ['dist/feeds/a b', 'dist/feeds/café']);
    assert.equal(result.pages[0]?.file, 'feeds/a b');
  });

  it('encodes a space in an extraRules line, in the file and in the result', async () => {
    const { files, result } = await tags([], {
      extraRules: [{ from: '/old name/*', to: '/new/:splat', status: 301 }],
    });

    assert.deepEqual(result.rules, [
      { from: '/old%20name/*', to: '/new/:splat', status: 301 },
    ]);

    assert.equal(
      files.get('dist/_redirects'),
      '/old%20name/* /new/:splat 301\n',
    );
  });

  for (const [spelling, short] of [
    ['encoded', '/t/a%20b'],
    ['decoded', '/t/a b'],
  ] as const)
    it(`writes a redirect page at a decoded file name for a path listed ${spelling}`, async () => {
      const { files } = await tags([short], { rules: redirectPages() });

      assert.deepEqual([...files.keys()], ['dist/t/a b/index.html']);
      assert.match(
        files.get('dist/t/a b/index.html') ?? '',
        /<link rel="canonical" href="\/tags\/a%20b">/,
      );
    });

  it('throws for a redirect whose page would replace a prerendered one in another spelling', async () => {
    await assert.rejects(
      run({
        mounts: {
          '/': {
            routes: [{ name: 'tag', url: '/tags/:tag' }],
            config: { strict: false },
          },
        },
        paths: ['/tags/a b'],
        notFound: false,
        extraRules: [{ from: '/tags/a%20b', to: '/elsewhere', status: 302 }],
        rules: redirectPages(),
      }),
      /redirects, but prerender wrote a page at 'tags\/a b\/index.html'/,
    );
  });
});
