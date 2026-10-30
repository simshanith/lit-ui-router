import '../register.js';
import { UIRouterLit } from 'lit-ui-router/pure';
import type { LitStateDeclaration } from 'lit-ui-router/pure';
import type { Verdict } from 'ui-router-server';
import { installServerLocation } from 'ui-router-server/location';
import type { ResponseHandlers } from 'ui-router-server/ssr';
import { describe, expect, it, vi } from 'vitest';

import { prerender } from '../prerender.js';
import { responder } from '../respond.js';

const routes = [
  { name: 'home', url: '' },
  { name: 'pkg', url: '/{pkg}' },
  { name: 'pkg.badge', url: '/badge.svg', response: true },
  { name: 'pkg.latest', url: '/latest', response: true },
  { name: 'broken', url: '/broken', response: true },
] as const;

const resolves: Partial<
  Record<(typeof routes)[number]['name'], LitStateDeclaration['resolve']>
> = {
  pkg: {
    version: [
      '$transition$',
      (trans: { params(): { pkg: string } }) => `${trans.params().pkg}@1.0.0`,
    ],
  },
  'pkg.badge': {
    svg: ['version', (version: string) => `<svg>${version}</svg>`],
  },
  broken: { svg: () => Promise.reject(new Error('no badge')) },
};

const responses = {
  'pkg.badge': ({ resolves: { svg } }) =>
    new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } }),
  'pkg.latest': ({ resolves: { version }, request }) =>
    new Response(null, {
      status: 302,
      headers: {
        Location: `/v/${version}${new URL(request.url).search}`,
      },
    }),
  broken: () => new Response('unreachable'),
} satisfies ResponseHandlers<
  (typeof routes)[number],
  {
    'pkg.badge': { svg: string };
    'pkg.latest': { version: string };
  }
>;

const serverRouter = () => {
  const router = installServerLocation(new UIRouterLit(), {
    urlConfig: { strict: false },
  });

  for (const route of routes)
    router.stateRegistry.register({ ...route, resolve: resolves[route.name] });
  router.stateService.defaultErrorHandler(() => {});

  return router;
};

const verdictOf = (subpath: string, state: string): Verdict => ({
  kind: 'response',
  mount: '/',
  subpath,
  state,
  params: {},
});

const respond = (
  subpath: string,
  state: string,
  init: RequestInit = {},
  search = '',
) => {
  const verdict = verdictOf(subpath, state);

  if (verdict.kind !== 'response') throw new Error('unreachable');

  return responder(serverRouter(), responses)(
    verdict,
    new Request(`https://example.test${subpath}${search}`, init),
  );
};

describe('responder', () => {
  it("runs the landed state's handler with its resolves, inherited ones included", async () => {
    const response = await respond('/lit/badge.svg', 'pkg.badge');

    expect(response.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(await response.text()).toBe('<svg>lit@1.0.0</svg>');
  });

  it('hands the handler the request, query included', async () => {
    const response = await respond('/lit/latest', 'pkg.latest', {}, '?ref=nav');

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/v/lit@1.0.0?ref=nav');
  });

  it('drops the body for a HEAD', async () => {
    const response = await respond('/lit/badge.svg', 'pkg.badge', {
      method: 'HEAD',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(response.body).toBeNull();
  });

  it('fails the request when a resolve throws, before any handler runs', async () => {
    const broken = vi.spyOn(responses, 'broken');

    await expect(respond('/broken', 'broken')).rejects.toMatchObject({
      cause: { detail: new Error('no badge') },
    });
    expect(broken).not.toHaveBeenCalled();
  });

  it('throws when the landed state has no handler', async () => {
    const verdict = verdictOf('/lit', 'pkg');

    if (verdict.kind !== 'response') throw new Error('unreachable');

    await expect(
      responder(serverRouter(), responses)(
        verdict,
        new Request('https://example.test/lit'),
      ),
    ).rejects.toThrow(/the landed state 'pkg' has no handler in responses/);
  });
});

describe('prerender responses', () => {
  it('writes a body at its url and a redirect as a rules line', async () => {
    const files = new Map<string, string>();

    const result = await prerender({
      mounts: { '/': { routes, config: { strict: false } } },
      router: serverRouter(),
      outDir: 'dist',
      paths: ['/lit/badge.svg', '/lit/latest'],
      notFound: false,
      elementRenderers: [],
      renderShell: () => '',
      responses,
      write: (file, body) => {
        files.set(file, body);
      },
    });

    expect(result.tally.response).toBe(2);
    expect(files.get('dist/lit/badge.svg')).toBe('<svg>lit@1.0.0</svg>');
    expect(result.rules).toEqual([
      { from: '/lit/latest', to: '/v/lit@1.0.0', status: 302 },
      { from: '/lit/latest/', to: '/v/lit@1.0.0', status: 302 },
    ]);
  });

  it("hands the handler a request at the site's origin", async () => {
    const badge = vi.spyOn(responses, 'pkg.badge');

    await prerender({
      mounts: { '/': { routes, config: { strict: false } } },
      router: serverRouter(),
      outDir: 'dist',
      paths: ['/lit/badge.svg'],
      notFound: false,
      elementRenderers: [],
      renderShell: () => '',
      responses,
      origin: 'https://lit-ui-router.dev',
      write: () => {},
    });

    expect(badge.mock.calls[0]?.[0].request.url).toBe(
      'https://lit-ui-router.dev/lit/badge.svg',
    );
  });

  it('throws for a response state without responses', async () => {
    await expect(
      prerender({
        mounts: { '/': { routes } },
        router: serverRouter(),
        outDir: 'dist',
        paths: ['/lit/badge.svg'],
        notFound: false,
        renderShell: () => '',
        write: () => {},
      }),
    ).rejects.toThrow(/matched response state 'pkg.badge'; pass `responses`/);
  });
});
