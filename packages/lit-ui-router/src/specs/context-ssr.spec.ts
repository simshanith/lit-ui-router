import { describe, it, expect, expectTypeOf } from 'vitest';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { html } from 'lit';
import { Directive, directive } from 'lit/directive.js';

import {
  provideRouter,
  requestRouter,
  getScopedRouter,
  withRouterSync,
} from '../context.js';
import { UIRouterLit } from '../core.js';

// The @lit-labs/ssr DOM shim: no elements, so a provider on its root answers every request.
const litServerRoot = (globalThis as { litServerRoot?: EventTarget })
  .litServerRoot;

// memoryLocationPlugin is hash-shaped, so its hrefs carry the `#` prefix; the
// path-shaped server plugin lives in ui-router-server/location.
const sheetRouter = (): UIRouterLit => {
  const router = new UIRouterLit();
  router.plugin(memoryLocationPlugin);
  router.stateRegistry.register({ name: 'sheet', url: '/sheet/:num' });
  return router;
};

/** Reads the router the way the sref directives do: slot, then render root. */
class RouterProbeDirective extends Directive {
  render(): string {
    const router =
      getScopedRouter() ??
      (litServerRoot ? requestRouter(litServerRoot) : undefined);
    return router?.stateService.href('sheet', { num: '7B' }) ?? 'no-router';
  }
}

const routerProbe = directive(RouterProbeDirective);

const emit = (): string =>
  collectResultSync(render(html`<a href=${routerProbe()}>7B</a>`));

describe('requestRouter without a DOM', () => {
  it('answers from a provider on a plain EventTarget', () => {
    const root = new EventTarget();
    const router = new UIRouterLit();
    const remove = provideRouter(root, router);

    expect(requestRouter(root)).toBe(router);

    remove();
    expect(requestRouter(root)).toBeUndefined();
  });

  it('answers from a provider on globalThis.litServerRoot', () => {
    expect(litServerRoot).toBeDefined();
    const router = new UIRouterLit();
    const remove = provideRouter(litServerRoot!, router);

    // the exact call a server-side directive hand-off makes
    expect(requestRouter(litServerRoot!)).toBe(router);

    remove();
    expect(requestRouter(litServerRoot!)).toBeUndefined();
  });

  it('returns undefined when the server render installed no provider', () => {
    expect(requestRouter(new EventTarget())).toBeUndefined();
  });
});

describe('the router hand-off under @lit-labs/ssr', () => {
  it('emits nothing routed with neither slot nor provider', () => {
    expect(emit()).toContain('no-router');
  });

  it('is visible to a directive render() inside withRouterSync', () => {
    const router = sheetRouter();

    const out = withRouterSync(router, emit);

    expect(out).toContain('href="#/sheet/7B"');
    expect(getScopedRouter()).toBeUndefined();
  });

  it('is visible to a directive render() through a litServerRoot provider', () => {
    const router = sheetRouter();
    const uninstall = provideRouter(litServerRoot!, router);

    const out = emit();

    uninstall();
    expect(out).toContain('href="#/sheet/7B"');
  });

  it('renders from a plain @uirouter/core router in the slot', () => {
    const router = new UIRouter();
    router.plugin(servicesPlugin);
    router.plugin(memoryLocationPlugin);
    router.stateRegistry.register({ name: 'sheet', url: '/sheet/:num' });
    expectTypeOf(router).toEqualTypeOf<UIRouter>();

    const out = withRouterSync(router, emit);

    expect(out).toContain('href="#/sheet/7B"');
    expect(getScopedRouter()).toBeUndefined();
  });

  it('throws rather than let an unconsumed render outlive the slot', () => {
    const router = sheetRouter();

    expect(() =>
      withRouterSync(router, () =>
        Promise.resolve(collectResultSync(render(html`x`))),
      ),
    ).toThrow(TypeError);
    expect(getScopedRouter()).toBeUndefined();
  });
});
