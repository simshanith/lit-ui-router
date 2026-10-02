import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  expectTypeOf,
} from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import {
  consume,
  Context,
  ContextConsumer,
  ContextProvider,
  createContext,
} from '@lit/context';

import { routerContext, type RouterContextKey } from '../context.js';
import { UIRouterLit } from '../core.js';
import { UIRouterLitElement } from '../ui-router.js';
import '../ui-router.register.js';
import '../ui-view.register.js';
import { LitStateDeclaration } from '../interface.js';
import {
  createTestRouter,
  routerGo,
  tick,
  waitForUpdate,
} from './test-utils.js';

// Imports @lit/context itself; runs under test:lit2-compat too since it accepts @lit/reactive-element ^1.6.2 || ^2.1.0.

/** what a subscribing consumer was handed, call by call */
type SubscriptionCall = [UIRouterLit, (() => void) | undefined];

/** the decorator path: `@consume` on a plain field */
@customElement('test-lit-context-consumer')
class LitContextConsumer extends LitElement {
  @consume({ context: routerContext })
  uiRouter?: UIRouterLit;

  createRenderRoot() {
    return this;
  }

  render() {
    return html`<span class="router"
      >${this.uiRouter ? 'found' : 'missing'}</span
    >`;
  }
}

/** the controller path, asking for updates */
@customElement('test-lit-context-subscriber')
class LitContextSubscriber extends LitElement {
  readonly calls: SubscriptionCall[] = [];

  readonly consumer = new ContextConsumer(this, {
    context: routerContext,
    subscribe: true,
    callback: (value: UIRouterLit, unsubscribe?: () => void) => {
      this.calls.push([value, unsubscribe]);
    },
  });

  createRenderRoot() {
    return this;
  }

  render() {
    return html`<span class="subscriber"></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-lit-context-consumer': LitContextConsumer;
    'test-lit-context-subscriber': LitContextSubscriber;
  }
}

const states: LitStateDeclaration[] = [
  { name: 'home', url: '/home', component: () => html`<div>Home</div>` },
];

describe('lit-ui-router/context with @lit/context', () => {
  let container: HTMLElement;
  let router: UIRouterLit;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    router = createTestRouter(states);
  });

  afterEach(async () => {
    container.remove();
    await tick();
    router.dispose();
    await tick();
  });

  /** a `<ui-router>` holding the test router, connected and updated */
  async function mountRouterElement(): Promise<UIRouterLitElement> {
    const element = document.createElement('ui-router');
    element.uiRouter = router;
    container.appendChild(element);
    await waitForUpdate(element);
    return element;
  }

  describe('@consume', () => {
    it('gets the router from an ancestor <ui-router>', async () => {
      const uiRouter = await mountRouterElement();

      const consumer = document.createElement('test-lit-context-consumer');
      uiRouter.appendChild(consumer);
      await waitForUpdate(consumer);

      expect(consumer.uiRouter).toBe(router);
      expect(consumer.innerHTML).toContain('found');
    });

    it('leaves the field undefined when nothing provides the context', async () => {
      const consumer = document.createElement('test-lit-context-consumer');
      container.appendChild(consumer);
      await waitForUpdate(consumer);

      expect(consumer.uiRouter).toBeUndefined();
      expect(consumer.innerHTML).toContain('missing');
    });
  });

  describe('ContextConsumer with subscribe', () => {
    it('is called once with the router and an unsubscribe function', async () => {
      const uiRouter = await mountRouterElement();

      const subscriber = document.createElement('test-lit-context-subscriber');
      uiRouter.appendChild(subscriber);
      await waitForUpdate(subscriber);

      expect(subscriber.calls).toHaveLength(1);
      const [value, unsubscribe] = subscriber.calls[0];
      expect(value).toBe(router);
      expect(typeof unsubscribe).toBe('function');
      expect(subscriber.consumer.value).toBe(router);
    });

    it('survives the no-op unsubscribe the element hands back', async () => {
      const uiRouter = await mountRouterElement();

      const subscriber = document.createElement('test-lit-context-subscriber');
      uiRouter.appendChild(subscriber);
      await waitForUpdate(subscriber);

      // hostDisconnected calls it; nothing throws and no further call arrives
      subscriber.remove();
      await tick();

      expect(subscriber.calls).toHaveLength(1);
    });
  });

  describe('a ContextProvider with no <ui-router>', () => {
    /** the library's provider on a plain element, holding the test router */
    function provideFrom(
      host: HTMLElement,
      value: UIRouterLit = router,
    ): ContextProvider<typeof routerContext> {
      return new ContextProvider(host, {
        context: routerContext,
        initialValue: value,
      });
    }

    it('satisfies seekRouter', () => {
      const host = document.createElement('div');
      container.appendChild(host);
      const provider = provideFrom(host);

      const seeker = document.createElement('div');
      host.appendChild(seeker);

      expect(provider.value).toBe(router);
      expect(UIRouterLitElement.seekRouter(seeker)).toBe(router);
    });

    it('lets a <ui-view> find its router and render', async () => {
      const host = document.createElement('div');
      container.appendChild(host);
      provideFrom(host);

      const uiView = document.createElement('ui-view');
      host.appendChild(uiView);
      await waitForUpdate(uiView);

      router.start();
      await routerGo(router, 'home');
      await waitForUpdate(uiView);

      expect(uiView.uiRouter).toBe(router);
      expect(uiView.innerHTML).toContain('Home');
    });

    describe('precedence', () => {
      it('gives a consumer the nearest provider, not the outer <ui-router>', async () => {
        const uiRouter = await mountRouterElement();

        const inner = createTestRouter(states);
        const host = document.createElement('div');
        uiRouter.appendChild(host);
        const provider = provideFrom(host, inner);

        const consumer = document.createElement('test-lit-context-consumer');
        host.appendChild(consumer);
        await waitForUpdate(consumer);

        expect(provider.value).toBe(inner);
        expect(consumer.uiRouter).toBe(inner);
        expect(consumer.uiRouter).not.toBe(router);

        inner.dispose();
      });

      it('answers from <ui-router> when the provider sits above it', async () => {
        const outerHost = document.createElement('div');
        container.appendChild(outerHost);
        const outerRouter = createTestRouter(states);
        provideFrom(outerHost, outerRouter);

        const uiRouter = document.createElement('ui-router');
        uiRouter.uiRouter = router;
        outerHost.appendChild(uiRouter);
        await waitForUpdate(uiRouter);

        const consumer = document.createElement('test-lit-context-consumer');
        uiRouter.appendChild(consumer);
        await waitForUpdate(consumer);

        expect(consumer.uiRouter).toBe(router);

        outerRouter.dispose();
      });
    });
  });

  describe('types', () => {
    it('is a @lit/context Context key without a cast', () => {
      // the assignments are the assertion: this file is typechecked
      const key: Context<RouterContextKey, UIRouterLit> = routerContext;
      const loose: Context<unknown, UIRouterLit> = routerContext;

      expect(key).toBe(routerContext);
      expect(loose).toBe(routerContext);
      expectTypeOf(routerContext).toExtend<Context<unknown, UIRouterLit>>();
    });

    it('carries the brand createContext would have produced', () => {
      const made = createContext<UIRouterLit, RouterContextKey>(routerContext);

      expect(made).toBe(routerContext);
      expectTypeOf(made).toEqualTypeOf<
        Context<RouterContextKey, UIRouterLit>
      >();
      expectTypeOf(routerContext).toEqualTypeOf<
        Context<RouterContextKey, UIRouterLit>
      >();
    });

    it('infers the router through the library generics', async () => {
      const uiRouter = await mountRouterElement();
      const subscriber = document.createElement('test-lit-context-subscriber');
      uiRouter.appendChild(subscriber);
      await waitForUpdate(subscriber);

      expectTypeOf(subscriber.consumer.value).toEqualTypeOf<
        UIRouterLit | undefined
      >();
      expect(subscriber.consumer.value).toBe(router);
    });
  });
});
