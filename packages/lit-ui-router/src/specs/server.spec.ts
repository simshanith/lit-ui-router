import { describe, it, expect } from 'vitest';
import { memoryLocationPlugin } from '@uirouter/core';

import {
  configureServerRouter,
  currentServerRouter,
  provideRouter,
  serverLocationPlugin,
  withServerRouter,
} from '../server.js';
import { requestRouter } from '../context.js';
import { UIRouterLit } from '../core.js';

const sheetRouter = (plugin: typeof memoryLocationPlugin): UIRouterLit => {
  const router = new UIRouterLit();
  router.plugin(plugin);
  router.stateRegistry.register({ name: 'sheet', url: '/sheet/:num' });
  return router;
};

describe('provideRouter', () => {
  it('answers a context request that reaches the root', () => {
    const root = new EventTarget();
    const router = new UIRouterLit();
    const uninstall = provideRouter(root, router);

    expect(requestRouter(root)).toBe(router);

    uninstall();
    expect(requestRouter(root)).toBeUndefined();
  });

  it('answers a request that bubbles up from a descendant element', () => {
    const router = new UIRouterLit();
    const uninstall = provideRouter(document.body, router);
    const child = document.createElement('span');
    document.body.append(child);

    expect(requestRouter(child)).toBe(router);

    uninstall();
    child.remove();
  });

  it('hands a subscriber a no-op unsubscribe, and a one-shot caller none', () => {
    const root = new EventTarget();
    const router = new UIRouterLit();
    const uninstall = provideRouter(root, router);
    const answers: (string | undefined)[] = [];

    requestRouter(root, {
      subscribe: true,
      callback: (_router, unsubscribe) => answers.push(typeof unsubscribe),
    });
    requestRouter(root, {
      callback: (_router, unsubscribe) => answers.push(typeof unsubscribe),
    });

    expect(answers).toEqual(['function', 'undefined']);
    uninstall();
  });

  it('answers exactly once when two providers share a root', () => {
    const root = new EventTarget();
    const outer = new UIRouterLit();
    const inner = new UIRouterLit();
    const uninstallOuter = provideRouter(root, outer);
    const uninstallInner = provideRouter(root, inner);
    const seen: UIRouterLit[] = [];

    requestRouter(root, { callback: (router) => seen.push(router) });

    // stopImmediatePropagation: the first listener on the target is the only one
    expect(seen).toEqual([outer]);
    uninstallOuter();
    uninstallInner();
  });

  it('uninstalls only the listener its own call installed', () => {
    const root = new EventTarget();
    const first = new UIRouterLit();
    const second = new UIRouterLit();
    const uninstallFirst = provideRouter(root, first);
    provideRouter(root, second);

    uninstallFirst();
    expect(requestRouter(root)).toBe(second);
  });
});

describe('withServerRouter', () => {
  it('is undefined outside any call', () => {
    expect(currentServerRouter()).toBeUndefined();
  });

  it('publishes the router for the duration of run and returns its value', () => {
    const router = new UIRouterLit();

    const seen = withServerRouter(router, () => currentServerRouter());

    expect(seen).toBe(router);
    expect(currentServerRouter()).toBeUndefined();
  });

  it('nests, restoring the outer router on the way out', () => {
    const outer = new UIRouterLit();
    const inner = new UIRouterLit();
    const trace: (UIRouterLit | undefined)[] = [];

    withServerRouter(outer, () => {
      trace.push(currentServerRouter());
      withServerRouter(inner, () => trace.push(currentServerRouter()));
      trace.push(currentServerRouter());
    });

    expect(trace).toEqual([outer, inner, outer]);
    expect(currentServerRouter()).toBeUndefined();
  });

  it('restores the slot when run throws', () => {
    const router = new UIRouterLit();

    expect(() =>
      withServerRouter(router, () => {
        throw new Error('render failed');
      }),
    ).toThrow('render failed');
    expect(currentServerRouter()).toBeUndefined();
  });

  it('throws on a thenable, with the slot already restored', () => {
    const router = new UIRouterLit();
    const pending = Promise.resolve('markup');

    expect(() => withServerRouter(router, () => pending)).toThrow(TypeError);
    expect(() => withServerRouter(router, () => pending)).toThrow(
      /collectResultSync/,
    );
    expect(currentServerRouter()).toBeUndefined();
    return pending;
  });
});

describe('serverLocationPlugin', () => {
  it('builds path hrefs where the shipped memory plugin builds hash ones', () => {
    expect(
      sheetRouter(serverLocationPlugin).stateService.href('sheet', {
        num: '7B',
      }),
    ).toBe('/sheet/7B');
    expect(
      sheetRouter(memoryLocationPlugin).stateService.href('sheet', {
        num: '7B',
      }),
    ).toBe('#/sheet/7B');
  });
});

describe('configureServerRouter', () => {
  it('returns the same router, on the path-shaped plugin, at the requested url', () => {
    const router = new UIRouterLit();

    const configured = configureServerRouter(router, { url: '/sheet/7B' });

    expect(configured).toBe(router);
    expect(router.urlService.path()).toBe('/sheet/7B');
    expect(router.locationConfig.html5Mode()).toBe(true);
  });

  it('routes the requested url once the router starts', async () => {
    const router = configureServerRouter(new UIRouterLit(), {
      url: '/sheet/7B',
      strictMode: false,
    });
    router.stateRegistry.register({ name: 'sheet', url: '/sheet/:num' });
    const settled = new Promise<void>((resolve) =>
      router.transitionService.onSuccess({}, () => {
        resolve();
      }),
    );

    router.start();
    await settled;

    expect(router.globals.current.name).toBe('sheet');
    expect(router.globals.params.num).toBe('7B');
  });

  it('prefixes hrefs with the mount, and matches urls without it', async () => {
    const router = configureServerRouter(new UIRouterLit(), {
      url: '/sheet/7B',
      baseHref: '/app/',
    });
    router.stateRegistry.register({ name: 'sheet', url: '/sheet/:num' });
    const settled = new Promise<void>((resolve) =>
      router.transitionService.onSuccess({}, () => {
        resolve();
      }),
    );

    router.start();
    await settled;

    expect(router.globals.current.name).toBe('sheet');
    expect(router.stateService.href('sheet', { num: '7B' })).toBe(
      '/app/sheet/7B',
    );
  });

  it('leaves the url alone when none was requested', () => {
    const router = configureServerRouter(new UIRouterLit());

    expect(router.urlService.path()).toBe('');
  });
});
