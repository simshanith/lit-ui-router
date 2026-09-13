import { describe, it, expect } from 'vitest';
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { html } from 'lit';
import { Directive, directive } from 'lit/directive.js';

import { requestRouter } from '../context.js';
import { UIRouterLit } from '../core.js';
import {
  configureServerRouter,
  currentServerRouter,
  provideRouter,
  withServerRouter,
} from '../server.js';

// @lit-labs/ssr's root event target: what a server-side request reaches when
// there is no element to dispatch from.
const litServerRoot = (globalThis as { litServerRoot?: EventTarget })
  .litServerRoot;

const sheetRouter = (): UIRouterLit => {
  const router = configureServerRouter(new UIRouterLit(), { url: '/sheet/7B' });
  router.stateRegistry.register({ name: 'sheet', url: '/sheet/:num' });
  return router;
};

/** Reads the router the way step 3's directives will: slot, then render root. */
class RouterProbeDirective extends Directive {
  render(): string {
    const router =
      currentServerRouter() ??
      (litServerRoot ? requestRouter(litServerRoot) : undefined);
    return router?.stateService.href('sheet', { num: '7B' }) ?? 'no-router';
  }
}

const routerProbe = directive(RouterProbeDirective);

const emit = (): string =>
  collectResultSync(render(html`<a href=${routerProbe()}>7B</a>`));

describe('the server router under @lit-labs/ssr', () => {
  it('puts litServerRoot within reach of provideRouter', () => {
    expect(litServerRoot).toBeDefined();
    const router = sheetRouter();
    const uninstall = provideRouter(litServerRoot!, router);

    expect(requestRouter(litServerRoot!)).toBe(router);

    uninstall();
    expect(requestRouter(litServerRoot!)).toBeUndefined();
  });

  it('emits nothing routed with neither slot nor provider', () => {
    expect(emit()).toContain('no-router');
  });

  it('is visible to a directive render() inside withServerRouter', () => {
    const router = sheetRouter();

    const out = withServerRouter(router, emit);

    expect(out).toContain('href="/sheet/7B"');
    expect(currentServerRouter()).toBeUndefined();
  });

  it('is visible to a directive render() through a litServerRoot provider', () => {
    const router = sheetRouter();
    const uninstall = provideRouter(litServerRoot!, router);

    const out = emit();

    uninstall();
    expect(out).toContain('href="/sheet/7B"');
  });

  it('throws rather than let an unconsumed render outlive the slot', () => {
    const router = sheetRouter();

    expect(() =>
      withServerRouter(router, () =>
        Promise.resolve(collectResultSync(render(html`x`))),
      ),
    ).toThrow(TypeError);
    expect(currentServerRouter()).toBeUndefined();
  });
});
