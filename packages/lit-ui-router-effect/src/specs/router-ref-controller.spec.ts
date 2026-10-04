import { describe, it, expect, afterEach, vi } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import {
  Context,
  Data,
  Effect,
  Equal,
  Exit,
  Fiber,
  Layer,
  ManagedRuntime,
} from 'effect';
import { UIRouterLit, UIRouterLitElement } from 'lit-ui-router';
import { withRouterSync } from 'lit-ui-router/context';

import { RefRuntime } from '../ref-controller.js';
import { RouterRefController } from '../router-ref-controller.js';
import { appendParentFirst } from '@tools/happy-dom/append.ts';
import {
  createTestRouter,
  routerGo,
  testStates,
  waitForUpdate,
} from './test-utils.js';

@customElement('router-ref-host')
class RouterRefHost extends LitElement {
  renderCount = 0;

  render() {
    this.renderCount++;
    return html`<span>${this.renderCount}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'router-ref-host': RouterRefHost;
  }
}

class Router extends Context.Tag('Router')<Router, UIRouterLit>() {}

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.shift()?.();
});

function createHost(): RouterRefHost {
  return document.createElement('router-ref-host');
}

/** Mounts the host inside a <ui-router> providing the given router. */
/** A default runtime that keeps every fiber it forks. */
function recordingRuntime(): RefRuntime & {
  readonly fibers: Fiber.RuntimeFiber<unknown, unknown>[];
} {
  const fibers: Fiber.RuntimeFiber<unknown, unknown>[] = [];
  return {
    fibers,
    runFork: (effect) => {
      const fiber = Effect.runFork(effect);
      fibers.push(fiber);
      return fiber;
    },
    runSync: (effect) => Effect.runSync(effect),
  };
}

async function interrupted(
  fiber: Fiber.RuntimeFiber<unknown, unknown>,
): Promise<boolean> {
  return Exit.isInterrupted(await Effect.runPromise(Fiber.await(fiber)));
}

async function mountInRouter(
  host: RouterRefHost,
  router: UIRouterLit,
): Promise<UIRouterLitElement> {
  const uiRouterEl = document.createElement('ui-router');
  uiRouterEl.uiRouter = router;
  appendParentFirst(document.body, uiRouterEl, host);
  cleanups.push(() => uiRouterEl.remove());
  await waitForUpdate(host);
  return uiRouterEl;
}

describe('RouterRefController', () => {
  it('discovers the router from the <ui-router> context', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'a');

    const host = createHost();
    const controller = new RouterRefController(
      host,
      (route) => route.current?.name,
    );
    expect(controller.value).toBeUndefined();

    await mountInRouter(host, router);

    expect(controller.value).toBe('a');
  });

  it('reads an explicit router at construction, before connect', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'a');

    const host = createHost();
    const controller = new RouterRefController(
      host,
      (route) => route.current?.name,
      { router },
    );

    expect(controller.value).toBe('a');

    document.body.appendChild(host);
    cleanups.push(() => host.remove());
    await waitForUpdate(host);

    expect(controller.value).toBe('a');
  });

  it('reads the router withRouterSync scoped at construction', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    cleanups.push(() => warn.mockRestore());
    const router = createTestRouter(testStates);
    await routerGo(router, 'a');

    const host = createHost();
    const controller = withRouterSync(
      router,
      () =>
        new RouterRefController(host, (route) => route.current?.name, {
          initialValue: 'INIT',
        }),
    );

    expect(controller.value).toBe('a');

    document.body.appendChild(host);
    cleanups.push(() => host.remove());
    await waitForUpdate(host);
    await routerGo(router, 'b', { id: '1' });

    expect(controller.value).toBe('b');
    expect(warn).not.toHaveBeenCalled();
  });

  it('prefers an explicit router over the scoped one', async () => {
    const scoped = createTestRouter(testStates);
    await routerGo(scoped, 'a');
    const explicit = createTestRouter(testStates);
    await routerGo(explicit, 'b', { id: '1' });

    const controller = withRouterSync(
      scoped,
      () =>
        new RouterRefController(createHost(), (route) => route.current?.name, {
          router: explicit,
        }),
    );

    expect(controller.value).toBe('b');
  });

  it('warns once per host and no-ops without a router context', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    cleanups.push(() => warn.mockRestore());

    const host = createHost();
    const controller = new RouterRefController(
      host,
      (route) => route.current?.name,
    );
    document.body.appendChild(host);
    cleanups.push(() => host.remove());
    await waitForUpdate(host);

    expect(controller.value).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe(
      'lit-ui-router-effect: RouterRefController found no <ui-router> ' +
        'ancestor, so it will not observe the router. Wrap this subtree in ' +
        '<ui-router>, or pass a router explicitly.',
    );
    expect(warn.mock.calls[0]?.[1]).toBe(host);

    // reconnecting the same host repeats the failed seek, not the message
    host.remove();
    document.body.appendChild(host);
    await waitForUpdate(host);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('falls back to initialValue before connect and without a context', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    cleanups.push(() => warn.mockRestore());

    const host = createHost();
    const controller = new RouterRefController(
      host,
      (route) => route.current?.name,
      { initialValue: 'none' },
    );

    expect(controller.value).toBe('none');

    document.body.appendChild(host);
    cleanups.push(() => host.remove());
    await waitForUpdate(host);

    expect(controller.value).toBe('none');
  });

  it('updates the host when the selected value changes', async () => {
    const router = createTestRouter(testStates);
    const host = createHost();
    const controller = new RouterRefController(
      host,
      (route) => route.current?.name,
    );
    await mountInRouter(host, router);
    const rendersBefore = host.renderCount;

    await routerGo(router, 'a');
    await waitForUpdate(host);

    expect(controller.value).toBe('a');
    expect(host.renderCount).toBeGreaterThan(rendersBefore);
  });

  it('shares one ref per router across hosts', async () => {
    const router = createTestRouter(testStates);
    const first = createHost();
    const second = createHost();
    const a = new RouterRefController(first, (route) => route);
    const b = new RouterRefController(second, (route) => route);
    await mountInRouter(first, router);
    await mountInRouter(second, router);

    await routerGo(router, 'a');
    await waitForUpdate(first);
    await waitForUpdate(second);

    expect(a.value).toBe(b.value);
    expect(a.value.current?.name).toBe('a');
  });

  it('supports value equality and onChange for params selectors', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'b', { id: '1' });
    const host = createHost();
    const onChange = vi.fn();
    const controller = new RouterRefController(
      host,
      (route) => Data.struct({ id: route.params.id as string | undefined }),
      { equals: Equal.equals, onChange },
    );
    await mountInRouter(host, router);
    expect(onChange).toHaveBeenCalledTimes(1);

    // a child transition keeps the same id: same value, no change
    await routerGo(router, 'b.child', { id: '1' });
    await waitForUpdate(host);
    expect(onChange).toHaveBeenCalledTimes(1);

    await routerGo(router, 'b', { id: '2' });
    await waitForUpdate(host);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(controller.value.id).toBe('2');
  });

  it('stops following on disconnect and resynchronizes on reconnect', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'a');
    const host = createHost();
    const controller = new RouterRefController(
      host,
      (route) => route.current?.name,
    );
    const uiRouterEl = await mountInRouter(host, router);

    host.remove();
    await routerGo(router, 'b', { id: '1' });
    expect(controller.value).toBe('a');

    uiRouterEl.appendChild(host);
    await waitForUpdate(host);
    expect(controller.value).toBe('b');
  });

  it('forks the subscription on the runtime it is given', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'a');
    const runtime = ManagedRuntime.make(Layer.succeed(Router, router));
    cleanups.push(() => void runtime.dispose());
    const runFork = vi.spyOn(runtime, 'runFork');
    const host = createHost();
    const controller = new RouterRefController(
      host,
      (route) => route.current?.name,
      { router: runtime.runSync(Router), runtime },
    );
    document.body.appendChild(host);
    cleanups.push(() => host.remove());
    await waitForUpdate(host);

    expect(runFork).toHaveBeenCalledTimes(1);

    await routerGo(router, 'b', { id: '1' });
    await waitForUpdate(host);
    expect(controller.value).toBe('b');
    expect(runFork).toHaveBeenCalledTimes(1);

    host.remove();
    expect(runFork).toHaveBeenCalledTimes(1);
    const fiber = runFork.mock.results[0].value;
    expect(
      Exit.isInterrupted(await Effect.runPromise(Fiber.await(fiber))),
    ).toBe(true);
  });

  describe('setRouter', () => {
    it('re-forks on the new router while connected and updates the host', async () => {
      const first = createTestRouter(testStates);
      await routerGo(first, 'a');
      const second = createTestRouter(testStates);
      await routerGo(second, 'b', { id: '1' });
      const runtime = recordingRuntime();
      const onChange = vi.fn();
      const host = createHost();
      const controller = new RouterRefController(
        host,
        (route) => route.current?.name,
        { runtime, onChange },
      );
      await mountInRouter(host, first);
      expect(runtime.fibers).toHaveLength(1);
      const rendersBefore = host.renderCount;

      controller.setRouter(second);
      expect(controller.value).toBe('b');
      expect(onChange).toHaveBeenLastCalledWith('b');
      expect(runtime.fibers).toHaveLength(2);
      expect(await interrupted(runtime.fibers[0])).toBe(true);
      await waitForUpdate(host);
      expect(host.renderCount).toBeGreaterThan(rendersBefore);

      await routerGo(first, 'b', { id: '2' });
      await routerGo(second, 'b.child', { id: '1' });
      expect(controller.value).toBe('b.child');
      await routerGo(second, 'a');
      expect(controller.value).toBe('a');
    });

    it('starts following after a failed seek while connected', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      cleanups.push(() => warn.mockRestore());
      const router = createTestRouter(testStates);
      await routerGo(router, 'a');
      const host = createHost();
      const controller = new RouterRefController(
        host,
        (route) => route.current?.name,
        { initialValue: 'none' },
      );
      document.body.appendChild(host);
      cleanups.push(() => host.remove());
      await waitForUpdate(host);
      expect(controller.value).toBe('none');

      controller.setRouter(router);
      expect(controller.value).toBe('a');
      await routerGo(router, 'b', { id: '1' });
      expect(controller.value).toBe('b');
    });

    it('records the router for the next hostConnected while disconnected', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      cleanups.push(() => warn.mockRestore());
      const router = createTestRouter(testStates);
      await routerGo(router, 'a');
      const runtime = recordingRuntime();
      const host = createHost();
      const controller = new RouterRefController(
        host,
        (route) => route.current?.name,
        { initialValue: 'none', runtime },
      );

      controller.setRouter(router);
      expect(controller.value).toBe('none');
      expect(runtime.fibers).toHaveLength(0);

      document.body.appendChild(host);
      cleanups.push(() => host.remove());
      await waitForUpdate(host);
      expect(controller.value).toBe('a');
      expect(runtime.fibers).toHaveLength(1);
      expect(warn).not.toHaveBeenCalled();

      await routerGo(router, 'b', { id: '1' });
      expect(controller.value).toBe('b');
    });

    it('is a no-op for the router it already follows', async () => {
      const router = createTestRouter(testStates);
      await routerGo(router, 'a');
      const runtime = recordingRuntime();
      const onChange = vi.fn();
      const explicitHost = createHost();
      const explicit = new RouterRefController(
        explicitHost,
        (route) => route.current?.name,
        { router, runtime, onChange },
      );
      const soughtHost = createHost();
      const sought = new RouterRefController(
        soughtHost,
        (route) => route.current?.name,
        { runtime, onChange },
      );
      await mountInRouter(explicitHost, router);
      await mountInRouter(soughtHost, router);
      expect(runtime.fibers).toHaveLength(2);
      expect(onChange).toHaveBeenCalledTimes(2);

      explicit.setRouter(router);
      sought.setRouter(router);

      expect(runtime.fibers).toHaveLength(2);
      expect(onChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('router thunk', () => {
    it('resolves at construction, before connect', async () => {
      const router = createTestRouter(testStates);
      await routerGo(router, 'a');

      const controller = new RouterRefController(
        createHost(),
        (route) => route.current?.name,
        { router: () => router },
      );

      expect(controller.value).toBe('a');
    });

    it('resolves again on each hostConnected', async () => {
      const first = createTestRouter(testStates);
      await routerGo(first, 'a');
      const second = createTestRouter(testStates);
      await routerGo(second, 'b', { id: '1' });
      let current: UIRouterLit | undefined;
      const runtime = recordingRuntime();
      const host = createHost();
      const controller = new RouterRefController(
        host,
        (route) => route.current?.name,
        { router: () => current, initialValue: 'none', runtime },
      );
      expect(controller.value).toBe('none');

      current = first;
      document.body.appendChild(host);
      cleanups.push(() => host.remove());
      await waitForUpdate(host);
      expect(controller.value).toBe('a');

      host.remove();
      current = second;
      document.body.appendChild(host);
      await waitForUpdate(host);
      expect(controller.value).toBe('b');
      expect(runtime.fibers).toHaveLength(2);
      expect(await interrupted(runtime.fibers[0])).toBe(true);

      await routerGo(second, 'a');
      expect(controller.value).toBe('a');
    });

    it('keeps the router it follows when a later resolution is undefined', async () => {
      const router = createTestRouter(testStates);
      await routerGo(router, 'a');
      let current: UIRouterLit | undefined = router;
      const host = createHost();
      const controller = new RouterRefController(
        host,
        (route) => route.current?.name,
        { router: () => current },
      );
      document.body.appendChild(host);
      cleanups.push(() => host.remove());
      await waitForUpdate(host);

      host.remove();
      current = undefined;
      document.body.appendChild(host);
      await waitForUpdate(host);
      await routerGo(router, 'b', { id: '1' });

      expect(controller.value).toBe('b');
    });

    it('falls back to the <ui-router> context when it returns undefined', async () => {
      const router = createTestRouter(testStates);
      await routerGo(router, 'a');
      const host = createHost();
      const controller = new RouterRefController(
        host,
        (route) => route.current?.name,
        { router: () => undefined },
      );
      expect(controller.value).toBeUndefined();

      await mountInRouter(host, router);

      expect(controller.value).toBe('a');
    });

    it('warns and no-ops when it returns undefined without a context', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      cleanups.push(() => warn.mockRestore());
      const host = createHost();
      const controller = new RouterRefController(
        host,
        (route) => route.current?.name,
        { router: () => undefined, initialValue: 'none' },
      );
      document.body.appendChild(host);
      cleanups.push(() => host.remove());
      await waitForUpdate(host);

      expect(controller.value).toBe('none');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[1]).toBe(host);
    });
  });
});
