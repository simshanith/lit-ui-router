import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  memoryLocationPlugin,
  servicesPlugin,
  UIRouter,
  type UIRouterPlugin,
} from '@uirouter/core';

import {
  installServerLocation,
  serverLocationPlugin,
} from '../src/location.ts';

// A bare core router: services, whatever location the case is about, and one
// parameterised state to build hrefs from.
const sheetRouter = (
  plugin?: (uiRouter: UIRouter) => UIRouterPlugin,
): UIRouter => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  if (plugin) router.plugin(plugin);
  router.stateRegistry.register({ name: 'sheet', url: '/sheet/:num' });
  return router;
};

// Resolves on the first successful transition.
const onceSettled = (router: UIRouter): Promise<void> =>
  new Promise((resolve) =>
    router.transitionService.onSuccess({}, () => {
      resolve();
    }),
  );

describe('serverLocationPlugin', () => {
  it('builds path hrefs where the shipped memory plugin builds hash ones', () => {
    assert.equal(
      sheetRouter(serverLocationPlugin).stateService.href('sheet', {
        num: '7B',
      }),
      '/sheet/7B',
    );
    assert.equal(
      sheetRouter(memoryLocationPlugin).stateService.href('sheet', {
        num: '7B',
      }),
      '#/sheet/7B',
    );
  });

  it('builds hash hrefs under `{ html5Mode: false }`', () => {
    const router = new UIRouter();
    router.plugin(servicesPlugin);
    router.plugin(serverLocationPlugin, { html5Mode: false });
    router.stateRegistry.register({ name: 'sheet', url: '/sheet/:num' });

    assert.equal(
      router.stateService.href('sheet', { num: '7B' }),
      '#/sheet/7B',
    );
    assert.equal(router.locationConfig.html5Mode(), false);
  });
});

describe('installServerLocation', () => {
  it('returns the same router, on the path-shaped plugin, at the requested url', () => {
    const router = sheetRouter();

    const installed = installServerLocation(router, { url: '/sheet/7B' });

    assert.equal(installed, router);
    assert.equal(router.urlService.path(), '/sheet/7B');
    assert.equal(router.locationConfig.html5Mode(), true);
  });

  it('builds hash hrefs, and reports hash mode, under `{ html5Mode: false }`', () => {
    const router = installServerLocation(sheetRouter(), {
      html5Mode: false,
      url: '/sheet/7B',
    });

    assert.equal(
      router.stateService.href('sheet', { num: '7B' }),
      '#/sheet/7B',
    );
    assert.equal(router.locationConfig.html5Mode(), false);
    assert.equal(router.urlService.path(), '/sheet/7B');
  });

  it('routes the requested url once the router starts', async () => {
    const router = installServerLocation(sheetRouter(), {
      url: '/sheet/7B',
      strictMode: false,
    });
    const settled = onceSettled(router);

    // Plain core has no start(); syncing the url is what a router start does.
    router.urlService.sync();
    await settled;

    assert.equal(router.globals.current.name, 'sheet');
    assert.equal(router.globals.params.num, '7B');
  });

  it('prefixes hrefs with the mount, and matches urls without it', async () => {
    const router = installServerLocation(sheetRouter(), {
      url: '/sheet/7B',
      baseHref: '/app/',
    });
    const settled = onceSettled(router);

    // Plain core has no start(); syncing the url is what a router start does.
    router.urlService.sync();
    await settled;

    assert.equal(router.globals.current.name, 'sheet');
    assert.equal(
      router.stateService.href('sheet', { num: '7B' }),
      '/app/sheet/7B',
    );
  });

  it('leaves the url alone when none was requested', () => {
    const router = installServerLocation(sheetRouter());

    assert.equal(router.urlService.path(), '');
  });
});
