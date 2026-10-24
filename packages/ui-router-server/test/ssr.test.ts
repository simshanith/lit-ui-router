import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  Rejection,
  RejectType,
  servicesPlugin,
  UIRouter,
  type StateDeclaration,
} from '@uirouter/core';

import { installServerLocation } from '../src/location.ts';
import { settle } from '../src/ssr.ts';

const later = <T>(value: T, ms = 5): Promise<T> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });

const states = (): StateDeclaration[] => [
  { name: 'home', url: '/', resolve: { title: () => 'home' } },
  {
    name: 'sheet',
    url: '/sheet/:num',
    resolve: {
      title: [
        '$transition$',
        (trans: { params(): { num: string } }) =>
          later(`sheet ${trans.params().num}`),
      ],
    },
  },
  { name: 'a', url: '/a', redirectTo: 'b' },
  { name: 'b', url: '/b', resolve: { title: () => 'b' } },
  {
    name: 'broken',
    url: '/broken',
    resolve: { title: () => Promise.reject(new Error('no sheet')) },
  },
  {
    name: 'stuck',
    url: '/stuck',
    resolve: { title: () => new Promise<string>(() => {}) },
  },
  { name: 'notFound', resolve: { title: () => '404' } },
];

const makeRouter = (otherwise = false): UIRouter => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  installServerLocation(router, { urlConfig: { strict: false } });

  // The failing cases assert the rejection; keep core's logger quiet.
  router.stateService.defaultErrorHandler(() => {});

  for (const state of states()) router.stateRegistry.register(state);

  if (otherwise) router.urlService.rules.otherwise({ state: 'notFound' });

  return router;
};

const hookCount = (router: UIRouter): number =>
  router.transitionService.getHooks('onSuccess').length +
  router.transitionService.getHooks('onError').length;

describe('settle', () => {
  it('lands after an async resolve, its value readable at once', async () => {
    const router = makeRouter();
    const transition = await settle(router, '/sheet/7B');
    assert.equal(transition.to().name, 'sheet');
    assert.equal(transition.injector().get('title'), 'sheet 7B');
    assert.equal(router.globals.current.name, 'sheet');
  });

  it('settles a redirectTo chain on its final state', async () => {
    const router = makeRouter();
    const transition = await settle(router, '/a');
    assert.equal(transition.to().name, 'b');
    assert.equal(router.globals.current.name, 'b');
    assert.equal(router.urlService.url(), '/b');
  });

  it('rejects with an error whose cause is the transition’s rejection when a resolve fails', async () => {
    const router = makeRouter();

    await assert.rejects(
      settle(router, '/broken'),
      (error: Error) =>
        error.cause instanceof Rejection &&
        error.cause.type === RejectType.ERROR &&
        error.cause.detail instanceof Error &&
        error.cause.detail.message === 'no sheet',
    );
  });

  it('rejects an unknown url when the router declares no otherwise', async () => {
    const router = makeRouter();
    await assert.rejects(settle(router, '/nowhere'), {
      message: /no url rule matches \/nowhere/,
    });
  });

  it('settles an unknown url on the otherwise state', async () => {
    const router = makeRouter(true);
    const transition = await settle(router, '/nowhere');
    assert.equal(transition.to().name, 'notFound');
    assert.equal(transition.injector().get('title'), '404');
    const again = await settle(router, '/elsewhere');
    assert.equal(again.to().name, 'notFound');
  });

  it('follows a url rule that rewrites the url', async () => {
    const router = makeRouter();
    router.urlService.rules.when('/old', '/sheet/1');
    const transition = await settle(router, '/old');
    assert.equal(transition.params().num, '1');
  });

  it('rejects a url rule loop rather than spinning', async () => {
    const router = makeRouter();
    router.urlService.rules.when('/ping', '/pong');
    router.urlService.rules.when('/pong', '/ping');
    await assert.rejects(settle(router, '/ping'), {
      message: /rewrote its url more than 10 times/,
    });
  });

  it('resolves at once on the path the router already stands on', async () => {
    const router = makeRouter();
    const first = await settle(router, '/sheet/7B');
    const second = await settle(router, '/sheet/7B');
    assert.equal(second, first);
  });

  it('settles a router the app already started, path after path', async () => {
    const router = makeRouter();
    router.urlService.url('/');
    router.urlService.listen();
    router.urlService.sync();
    const sheet = await settle(router, '/sheet/7B');
    assert.equal(sheet.to().name, 'sheet');
    assert.equal(sheet.injector().get('title'), 'sheet 7B');
    const redirected = await settle(router, '/a');
    assert.equal(redirected.to().name, 'b');
    assert.equal(router.urlService.url(), '/b');
  });

  it('removes its hooks on every exit', async () => {
    const router = makeRouter();
    const before = hookCount(router);
    await settle(router, '/sheet/7B');
    await settle(router, '/sheet/7B');
    await settle(router, '/broken').catch(() => {});
    await settle(router, '/nowhere').catch(() => {});
    await settle(router, '/stuck', { timeout: 20 }).catch(() => {});
    assert.equal(hookCount(router), before);
  });

  it('rejects when nothing lands within the timeout', async () => {
    const router = makeRouter();
    await assert.rejects(settle(router, '/stuck', { timeout: 20 }), {
      message: 'settle: /stuck did not land within 20ms',
    });
  });
});
