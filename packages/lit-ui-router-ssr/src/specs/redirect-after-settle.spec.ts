// The docs example for "Page, response state or redirect" in www/lit-ui-router.dev/packages/lit-ui-router-ssr.md.
import '../register.js';
import { html } from 'lit';
import { UIRouterLit } from 'lit-ui-router/pure';
import type { MountConfig } from 'ui-router-server';
import { installServerLocation } from 'ui-router-server/location';
import { describe, expect, it } from 'vitest';

import { prerender, redirectedTo, settle } from '../index.js';
import type { FileWriter } from '../index.js';

// A reversed pair is the same url pattern as a forward one, so only the redirectTo function tells them apart.
const compare = {
  name: 'compare',
  url: '/diff/:from/:to',
  redirectStatusCode: 308,
  redirectTo: (trans) => {
    const { from, to } = trans.params();

    return Number(from) > Number(to)
      ? trans.targetState().withParams({ from: to, to: from })
      : undefined;
  },
} satisfies Parameters<UIRouterLit['stateRegistry']['register']>[0];

const pageRouter = (baseHref?: string): UIRouterLit => {
  const router = installServerLocation(new UIRouterLit(), {
    urlConfig: { strict: false },
    baseHref,
  });

  router.stateRegistry.register(compare);
  router.stateRegistry.register({ name: 'about', url: '/about' });

  return router;
};

const mounts = {
  '/releases': {
    routes: [
      { name: 'compare', url: '/diff/:from/:to' },
      { name: 'about', url: '/about' },
    ],
    config: { strict: false },
    ignoreDiagnostics: ['bareBaseNotFound'],
  },
} satisfies Record<string, MountConfig>;

// A live host's answer for a shell verdict under /releases.
const answer = async (subpath: string): Promise<Response> => {
  const router = pageRouter();
  const redirect = redirectedTo(router, await settle(router, subpath));

  if (redirect)
    return new Response(null, {
      status: redirect.status,
      headers: { Location: `/releases${redirect.url}` },
    });

  return new Response(`<p>${router.globals.current.name}</p>`);
};

const memoryWriter = () => {
  const files = new Map<string, string>();

  const write: FileWriter = (file, body) => void files.set(file, body);

  return { files, write };
};

describe('a redirectTo function found at settle', () => {
  it('answers live with the state’s redirectStatusCode and the landed url', async () => {
    const redirected = await answer('/diff/2/1');
    expect(redirected.status).toBe(308);
    expect(redirected.headers.get('Location')).toBe('/releases/diff/1/2');

    const page = await answer('/diff/1/2');
    expect(page.status).toBe(200);
    expect(await page.text()).toBe('<p>compare</p>');
  });

  it('prerenders as a rules line and no page at the original path', async () => {
    const router = pageRouter();
    const { files, write } = memoryWriter();

    const result = await prerender({
      mounts,
      router,
      outDir: 'dist',
      // The target follows its redirect, so the router already stands on it.
      paths: ['/releases/diff/2/1', '/releases/diff/1/2'],
      notFound: false,
      write,
      renderShell: async (_verdict, { subpath }) => {
        await settle(router, subpath);

        return `<p>${router.globals.params.from}...${router.globals.params.to}</p>`;
      },
    });

    expect([...files.keys()]).toEqual([
      'dist/diff/1/2/index.html',
      'dist/_redirects',
    ]);
    expect(files.has('dist/diff/2/1/index.html')).toBe(false);
    expect(files.get('dist/diff/1/2/index.html')).toBe('<p>1...2</p>');
    expect(files.get('dist/_redirects')).toBe(
      '/releases/diff/2/1 /releases/diff/1/2 308\n' +
        '/releases/diff/2/1/ /releases/diff/1/2 308\n',
    );
    expect(result.tally).toMatchObject({ shell: 1, redirect: 1 });
  });

  it('answers live from one router that already stands on the target', async () => {
    const router = pageRouter();
    await settle(router, '/diff/1/2');

    expect(redirectedTo(router, await settle(router, '/diff/2/1'))).toEqual({
      url: '/diff/1/2',
      status: 308,
    });
  });

  it('prerenders the same rules line when the target is rendered first', async () => {
    const router = pageRouter('/releases/');
    const { files, write } = memoryWriter();

    const result = await prerender({
      mounts,
      router,
      outDir: 'dist',
      paths: ['/releases/diff/1/2', '/releases/diff/2/1'],
      notFound: false,
      write,
      renderShell: async (_verdict, { subpath }) => {
        await settle(router, subpath);

        return `<p>${router.globals.params.from}...${router.globals.params.to}</p>`;
      },
    });

    expect([...files.keys()]).toEqual([
      'dist/diff/1/2/index.html',
      'dist/_redirects',
    ]);
    expect(files.get('dist/diff/1/2/index.html')).toBe('<p>1...2</p>');
    expect(files.get('dist/_redirects')).toBe(
      '/releases/diff/2/1 /releases/diff/1/2 308\n' +
        '/releases/diff/2/1/ /releases/diff/1/2 308\n',
    );
    expect(result.tally).toMatchObject({ shell: 1, redirect: 1 });
  });

  it.each([{ paths: ['/', '/old'] }, { paths: ['/old', '/'] }])(
    'prerenders a `template` redirect onto $paths as a rules line',
    async ({ paths }) => {
      const router = installServerLocation(new UIRouterLit(), {
        urlConfig: { strict: false },
      });

      router.stateRegistry.register({ name: 'home', url: '/' });
      router.stateRegistry.register({
        name: 'old',
        url: '/old',
        redirectTo: () => 'home',
      });
      const { files, write } = memoryWriter();

      const result = await prerender({
        mounts: {
          '/': {
            routes: [
              { name: 'home', url: '/' },
              { name: 'old', url: '/old' },
            ],
            config: { strict: false },
          },
        },
        router,
        outDir: 'dist',
        paths,
        notFound: false,
        write,
        template: (r) => html`<p>${r.globals.current.name}</p>`,
      });

      expect([...files.keys()].sort()).toEqual([
        'dist/_redirects',
        'dist/index.html',
      ]);
      expect(files.get('dist/_redirects')).toBe('/old / 302\n/old/ / 302\n');
      expect(result.tally).toMatchObject({ shell: 1, redirect: 1 });
    },
  );

  it('prerenders a page for a redirect onto the current state that leaves the url in place', async () => {
    const router = installServerLocation(new UIRouterLit(), {
      urlConfig: { strict: false },
    });

    router.stateRegistry.register({ name: 'home', url: '/' });
    router.stateRegistry.register({
      name: 'quiet',
      url: '/quiet',
      redirectTo: (trans) =>
        trans.router.stateService.target('home', {}, { location: false }),
    });
    const { files, write } = memoryWriter();

    const result = await prerender({
      mounts: {
        '/': {
          routes: [
            { name: 'home', url: '/' },
            { name: 'quiet', url: '/quiet' },
          ],
          config: { strict: false },
        },
      },
      router,
      outDir: 'dist',
      paths: ['/', '/quiet'],
      notFound: false,
      write,
      template: (r) => html`<p>${r.globals.current.name}</p>`,
    });

    expect([...files.keys()].sort()).toEqual([
      'dist/index.html',
      'dist/quiet/index.html',
    ]);
    expect(result.tally).toMatchObject({ shell: 2, redirect: 0 });
  });

  it('writes the base once on the rules line under a base', async () => {
    const router = pageRouter('/solar/');
    const { files, write } = memoryWriter();

    await prerender({
      mounts,
      router,
      base: '/solar/',
      outDir: 'dist',
      paths: ['/releases/diff/2/1'],
      notFound: false,
      write,
      renderShell: async (_verdict, { subpath }) => {
        await settle(router, subpath);

        return '';
      },
    });

    expect(files.get('dist/_redirects')).toBe(
      '/solar/releases/diff/2/1 /solar/releases/diff/1/2 308\n' +
        '/solar/releases/diff/2/1/ /solar/releases/diff/1/2 308\n',
    );
  });

  it('writes the page of a render that lands no transition of its own', async () => {
    const router = pageRouter();
    const { files, write } = memoryWriter();

    await prerender({
      mounts,
      router,
      outDir: 'dist',
      paths: ['/releases/diff/2/1', '/releases/about'],
      notFound: false,
      write,
      renderShell: async (_verdict, { subpath }) => {
        if (subpath !== '/about') await settle(router, subpath);

        return '<p>page</p>';
      },
    });

    expect(files.get('dist/about/index.html')).toBe('<p>page</p>');
    expect(files.get('dist/_redirects')).toBe(
      '/releases/diff/2/1 /releases/diff/1/2 308\n' +
        '/releases/diff/2/1/ /releases/diff/1/2 308\n',
    );
  });

  it('answers 302 for a redirecting state that declares no status', async () => {
    const router = installServerLocation(new UIRouterLit(), {
      urlConfig: { strict: false },
    });

    router.stateRegistry.register({
      ...compare,
      redirectStatusCode: undefined,
    });

    expect(redirectedTo(router, await settle(router, '/diff/2/1'))).toEqual({
      url: '/diff/1/2',
      status: 302,
    });
  });
});
