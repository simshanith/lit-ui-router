import '../register.js';
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { RejectType, Rejection } from '@uirouter/core';
import { html } from 'lit';
import { withRouterSync } from 'lit-ui-router/context';
import { UIRouterLit } from 'lit-ui-router/pure';
import type {
  LitStateDeclaration,
  RoutedLitTemplate,
} from 'lit-ui-router/pure';
import { installServerLocation } from 'ui-router-server/location';
import { describe, expect, it } from 'vitest';

import { prerender } from '../prerender.js';
import { settle } from '../settle.js';
import { UiViewRenderer } from '../ui-view-renderer.js';
import { rootTemplate } from './fixture.js';

const later = <T>(value: T, ms = 5): Promise<T> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });

const SheetView: RoutedLitTemplate = (props) =>
  html`<h1>${String(props.resolves.title)}</h1>`;

const states = (): LitStateDeclaration[] => [
  {
    name: 'home',
    url: '/',
    component: SheetView,
    resolve: { title: () => 'home' },
  },
  {
    name: 'sheet',
    url: '/sheet/:num',
    component: SheetView,
    resolve: {
      title: [
        '$transition$',
        (trans: { params(): { num: string } }) =>
          later(`sheet ${trans.params().num}`),
      ],
    },
  },
  { name: 'a', url: '/a', redirectTo: 'b' },
  { name: 'b', url: '/b', component: SheetView, resolve: { title: () => 'b' } },
  {
    name: 'broken',
    url: '/broken',
    component: SheetView,
    resolve: { title: () => Promise.reject(new Error('no sheet')) },
  },
  {
    name: 'stuck',
    url: '/stuck',
    component: SheetView,
    resolve: { title: () => new Promise<string>(() => {}) },
  },
  { name: 'notFound', component: SheetView, resolve: { title: () => '404' } },
];

const makeRouter = (otherwise = false): UIRouterLit => {
  const router = installServerLocation(new UIRouterLit(), {
    strictMode: false,
  });

  // The failing specs assert the rejection; keep core's logger quiet.
  router.stateService.defaultErrorHandler(() => {});

  for (const state of states()) router.stateRegistry.register(state);

  if (otherwise) router.urlService.rules.otherwise({ state: 'notFound' });

  return router;
};

const draw = (router: UIRouterLit): string =>
  withRouterSync(router, () =>
    collectResultSync(
      render(rootTemplate(router), { elementRenderers: [UiViewRenderer] }),
    ),
  );

const hookCount = (router: UIRouterLit): number =>
  router.transitionService.getHooks('onSuccess').length +
  router.transitionService.getHooks('onError').length;

describe('settle', () => {
  it('lands after an async resolve, readable in a sync render', async () => {
    const router = makeRouter();
    const transition = await settle(router, '/sheet/7B');
    expect(transition.to().name).toBe('sheet');
    expect(transition.injector().get('title')).toBe('sheet 7B');
    expect(draw(router)).toContain('sheet 7B');
  });

  it('settles a redirectTo chain on its final state', async () => {
    const router = makeRouter();
    const transition = await settle(router, '/a');
    expect(transition.to().name).toBe('b');
    expect(router.globals.current.name).toBe('b');
    expect(router.urlService.url()).toBe('/b');
  });

  it('rejects with an error whose cause is the transition’s rejection when a resolve fails', async () => {
    const router = makeRouter();
    const settling = settle(router, '/broken');
    await expect(settling).rejects.toBeInstanceOf(Error);
    await expect(settling).rejects.toHaveProperty(
      'cause',
      expect.any(Rejection),
    );
    await expect(settling).rejects.toMatchObject({
      cause: { type: RejectType.ERROR, detail: new Error('no sheet') },
    });
  });

  it('rejects an unknown url when the router declares no otherwise', async () => {
    const router = makeRouter();
    await expect(settle(router, '/nowhere')).rejects.toThrow(
      'no url rule matches /nowhere',
    );
  });

  it('settles an unknown url on the otherwise state', async () => {
    const router = makeRouter(true);
    const transition = await settle(router, '/nowhere');
    expect(transition.to().name).toBe('notFound');
    expect(draw(router)).toContain('404');
    const again = await settle(router, '/elsewhere');
    expect(again.to().name).toBe('notFound');
  });

  it('follows a url rule that rewrites the url', async () => {
    const router = makeRouter();
    router.urlService.rules.when('/old', '/sheet/1');
    const transition = await settle(router, '/old');
    expect(transition.params().num).toBe('1');
  });

  it('rejects a url rule loop rather than spinning', async () => {
    const router = makeRouter();
    router.urlService.rules.when('/ping', '/pong');
    router.urlService.rules.when('/pong', '/ping');
    await expect(settle(router, '/ping')).rejects.toThrow(
      'rewrote its url more than 10 times',
    );
  });

  it('resolves at once on the path the router already stands on', async () => {
    const router = makeRouter();
    const first = await settle(router, '/sheet/7B');
    const second = await settle(router, '/sheet/7B');
    expect(second).toBe(first);
  });

  it('settles a router the app already started, path after path', async () => {
    const router = makeRouter();
    router.urlService.url('/');
    router.start();
    const sheet = await settle(router, '/sheet/7B');
    expect(sheet.to().name).toBe('sheet');
    expect(draw(router)).toContain('sheet 7B');
    const redirected = await settle(router, '/a');
    expect(redirected.to().name).toBe('b');
    expect(router.urlService.url()).toBe('/b');
  });

  it('removes its hooks on every exit', async () => {
    const router = makeRouter();
    const before = hookCount(router);
    await settle(router, '/sheet/7B');
    await settle(router, '/sheet/7B');
    await settle(router, '/broken').catch(() => {});
    await settle(router, '/nowhere').catch(() => {});
    await settle(router, '/stuck', { timeout: 20 }).catch(() => {});
    expect(hookCount(router)).toBe(before);
  });

  it('rejects when nothing lands within the timeout', async () => {
    const router = makeRouter();
    await expect(settle(router, '/stuck', { timeout: 20 })).rejects.toThrow(
      '/stuck did not land within 20ms',
    );
  });

  it('settles each path of a prerender before its render', async () => {
    const router = makeRouter();
    const files = new Map<string, string>();
    await prerender({
      mounts: {
        '/': {
          routes: [
            { name: 'home', url: '/' },
            { name: 'sheet', url: '/sheet/:num' },
          ],
          config: { strict: false },
        },
      },
      router,
      outDir: 'dist',
      paths: ['/', '/sheet/7B'],
      renderShell: async (_verdict, { path }) => {
        await settle(router, path);

        return rootTemplate(router);
      },
      write: (file, body) => void files.set(file, body),
    });
    expect(files.get('dist/index.html')).toMatch(/<h1>(<!--[^>]*-->)*home/);
    expect(files.get('dist/sheet/7B/index.html')).toMatch(
      /<h1>(<!--[^>]*-->)*sheet 7B/,
    );
  });
});
