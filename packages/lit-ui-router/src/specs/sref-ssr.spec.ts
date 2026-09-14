import { describe, it, expect, vi } from 'vitest';
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { memoryLocationPlugin } from '@uirouter/core';
import { html } from 'lit';
import type { TemplateResult } from 'lit';

import { UIRouterLit } from '../core.js';
import { provideRouter, withRouterSync } from '../context.js';
import { srefActiveClass, srefAriaCurrent } from '../sref-active.js';
import { srefHref } from '../sref-href.js';

// @lit-labs/ssr's root event target: what `provideRouter` serves elements from.
const litServerRoot = (globalThis as { litServerRoot?: EventTarget })
  .litServerRoot;

const emit = (template: TemplateResult): string =>
  collectResultSync(render(template));

// Core's memory location is hash-shaped; path-shaped hrefs are lit-ui-router-ssr's to assert.
const sheetRouter = (): UIRouterLit => {
  const router = new UIRouterLit();
  router.plugin(memoryLocationPlugin);
  router.stateRegistry.register({ name: 'sheet', url: '/sheet/:num' });
  router.stateRegistry.register({ name: 'index', url: '/' });
  router.urlService.url('/sheet/7B');
  return router;
};

/** A router settled on `/sheet/7B`, as a request handler hands one over. */
const startedRouter = async (): Promise<UIRouterLit> => {
  const router = sheetRouter();
  const settled = new Promise<void>((resolve) =>
    router.transitionService.onSuccess({}, () => {
      resolve();
    }),
  );
  router.start();
  await settled;
  return router;
};

const sheetLink = (): TemplateResult =>
  html`<a href=${srefHref('sheet', { num: '7B' })}>7B</a>`;

const navLink = (state: string, params: Record<string, string>) =>
  html`<a
    href=${srefHref(state, params)}
    class="nav ${srefActiveClass({
      state,
      params,
      activeClasses: ['active'],
      exactClasses: ['exact'],
    })}"
    aria-current=${srefAriaCurrent({ state, params })}
    >7B</a
  >`;

describe('srefHref on the server', () => {
  it('emits the href from the render-scoped router slot', () => {
    const out = withRouterSync(sheetRouter(), () => emit(sheetLink()));

    expect(out).toContain('href="#/sheet/7B"');
  });

  it('ignores a provider on the render root: the directive reads the scope, not the tree', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const uninstall = provideRouter(litServerRoot!, sheetRouter());

    const out = emit(sheetLink());
    uninstall();

    expect(out).not.toContain('href=');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('leaves the attribute off, and stays quiet, with no router in reach', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const out = emit(sheetLink());

    expect(out).not.toContain('href=');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('async resolves ahead of the sync render', () => {
  it('settle in the awaited transition, and the render reads them', async () => {
    const router = new UIRouterLit();
    router.plugin(memoryLocationPlugin);
    router.stateRegistry.register({
      name: 'sheet',
      url: '/sheet/:num',
      resolve: {
        title: () =>
          new Promise<string>((resolve) => {
            setTimeout(() => resolve('Sheet 7B'), 5);
          }),
      },
    });
    router.urlService.url('/sheet/7B');
    const settled = new Promise<void>((resolve) =>
      router.transitionService.onSuccess({}, () => {
        resolve();
      }),
    );
    router.start();
    await settled;

    const out = withRouterSync(router, () =>
      emit(
        html`<h1>
          ${router.globals.successfulTransitions
            .peekTail()
            .injector()
            .get('title')}
        </h1>`,
      ),
    );

    expect(router.globals.current.name).toBe('sheet');
    expect(out).toContain('Sheet 7B');
  });
});

describe('the sref status directives on the server', () => {
  it('marks the state the request settled on', async () => {
    const router = await startedRouter();

    const out = withRouterSync(router, () =>
      emit(navLink('sheet', { num: '7B' })),
    );

    expect(out).toContain('active');
    expect(out).toContain('exact');
    expect(out).toContain('aria-current="page"');
  });

  it('leaves an inactive state unmarked', async () => {
    const router = await startedRouter();

    const out = withRouterSync(router, () => emit(navLink('index', {})));

    expect(out).toContain('class="nav');
    expect(out).not.toContain('active');
    expect(out).not.toContain('aria-current');
  });

  it('ignores a provider on the render root: the directives read the scope, not the tree', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const uninstall = provideRouter(litServerRoot!, await startedRouter());

    const out = emit(navLink('sheet', { num: '7B' }));
    uninstall();

    expect(out).toContain('class="nav "');
    expect(out).not.toContain('aria-current');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('leaves the attributes as authored, and stays quiet, with no router', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const out = emit(navLink('sheet', { num: '7B' }));

    expect(out).toContain('class="nav "');
    expect(out).not.toContain('aria-current');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
