import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html } from 'lit';

import { UIRouterLitElement } from '../ui-router.js';
import type { UiRouterContextEvent } from '../events.js';
import { UiView } from '../ui-view.js';
import '../ui-view.register.js';
import { UIRouterLit } from '../core.js';
import { createTestRouter, tick, waitForUpdate } from './test-utils.js';

describe('UIRouterLitElement', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('initialization', () => {
    it('should be defined as a custom element', () => {
      expect(customElements.get('ui-router')).toBe(UIRouterLitElement);
    });

    it('should create router instance if not provided', async () => {
      const element = document.createElement('ui-router');
      container.appendChild(element);
      await waitForUpdate(element);

      expect(element.uiRouter).toBeInstanceOf(UIRouterLit);
    });

    it('should use provided router instance', async () => {
      const router = createTestRouter();
      const element = document.createElement('ui-router');
      element.uiRouter = router;
      container.appendChild(element);
      await waitForUpdate(element);

      expect(element.uiRouter).toBe(router);
    });

    it('should render slot content', async () => {
      const element = document.createElement('ui-router');
      element.innerHTML = '<div id="test-content">Hello</div>';
      container.appendChild(element);
      await waitForUpdate(element);

      const slot = element.shadowRoot?.querySelector('slot');
      expect(slot).toBeDefined();
    });
  });

  describe('ui-router-context event', () => {
    it('should dispatch ui-router-context event on connect', async () => {
      const router = createTestRouter();
      const element = document.createElement('ui-router');
      element.uiRouter = router;

      const eventSpy = vi.fn();
      element.addEventListener('ui-router-context', eventSpy);

      container.appendChild(element);
      await waitForUpdate(element);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should provide router in event detail', async () => {
      const router = createTestRouter();
      const element = document.createElement('ui-router');
      element.uiRouter = router;

      let receivedRouter: UIRouterLit | undefined;
      element.addEventListener('ui-router-context', ((
        event: UiRouterContextEvent,
      ) => {
        receivedRouter = event.detail.uiRouter;
      }) as EventListener);

      container.appendChild(element);
      await waitForUpdate(element);

      expect(receivedRouter).toBe(router);
    });

    it('should stop propagation and provide router to child events', async () => {
      const router = createTestRouter();
      const element = document.createElement('ui-router');
      element.uiRouter = router;
      container.appendChild(element);
      await waitForUpdate(element);

      // Create a child element that seeks router
      const child = document.createElement('div');
      element.appendChild(child);

      const seekEvent = UIRouterLitElement.uiRouterContextEvent();
      seekEvent.detail.uiRouter = undefined;

      child.dispatchEvent(seekEvent);

      expect(seekEvent.detail.uiRouter).toBe(router);
    });
  });

  describe('seekRouter static method', () => {
    it('should find router from descendant element', async () => {
      const router = createTestRouter();
      const element = document.createElement('ui-router');
      element.uiRouter = router;
      container.appendChild(element);
      await waitForUpdate(element);

      const child = document.createElement('div');
      element.appendChild(child);
      await tick();

      const foundRouter = UIRouterLitElement.seekRouter(child);
      expect(foundRouter).toBe(router);
    });

    it('should return undefined when no router ancestor exists', () => {
      const orphan = document.createElement('div');
      container.appendChild(orphan);

      const foundRouter = UIRouterLitElement.seekRouter(orphan);
      expect(foundRouter).toBeUndefined();
    });
  });

  describe('uiRouterContextEvent static method', () => {
    it('should create a custom event with correct name', () => {
      const event = UIRouterLitElement.uiRouterContextEvent();
      expect(event.type).toBe('ui-router-context');
    });

    it('should create event that bubbles', () => {
      const event = UIRouterLitElement.uiRouterContextEvent();
      expect(event.bubbles).toBe(true);
    });

    it('should create event that is composed', () => {
      const event = UIRouterLitElement.uiRouterContextEvent();
      expect(event.composed).toBe(true);
    });

    it('should include router in detail when provided', () => {
      const router = createTestRouter();
      const event = UIRouterLitElement.uiRouterContextEvent(router);
      expect(event.detail.uiRouter).toBe(router);
    });

    it('should have undefined router in detail when not provided', () => {
      const event = UIRouterLitElement.uiRouterContextEvent();
      expect(event.detail.uiRouter).toBeUndefined();
    });
  });

  describe('onUiRouterContextEvent static method', () => {
    it('should return handler that stops propagation', () => {
      const router = createTestRouter();
      const handler = UIRouterLitElement.onUiRouterContextEvent(router);
      const event = UIRouterLitElement.uiRouterContextEvent();

      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');
      handler(event);

      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('should return handler that sets router in event detail', () => {
      const router = createTestRouter();
      const handler = UIRouterLitElement.onUiRouterContextEvent(router);
      const event = UIRouterLitElement.uiRouterContextEvent();

      handler(event);

      expect(event.detail.uiRouter).toBe(router);
    });
  });

  describe('nested router handling', () => {
    it('should allow nested ui-router elements with different routers', async () => {
      const outerRouter = createTestRouter();
      const innerRouter = createTestRouter();

      const outerElement = document.createElement('ui-router');
      outerElement.uiRouter = outerRouter;

      const innerElement = document.createElement('ui-router');
      innerElement.uiRouter = innerRouter;

      outerElement.appendChild(innerElement);
      container.appendChild(outerElement);

      await waitForUpdate(outerElement);
      await waitForUpdate(innerElement);

      // Child inside inner should get inner router
      const innerChild = document.createElement('div');
      innerElement.appendChild(innerChild);

      const foundRouter = UIRouterLitElement.seekRouter(innerChild);
      expect(foundRouter).toBe(innerRouter);
    });

    it('should find outer router from element between nested routers', async () => {
      const outerRouter = createTestRouter();
      const innerRouter = createTestRouter();

      const outerElement = document.createElement('ui-router');
      outerElement.uiRouter = outerRouter;

      const middleDiv = document.createElement('div');
      outerElement.appendChild(middleDiv);

      const innerElement = document.createElement('ui-router');
      innerElement.uiRouter = innerRouter;
      middleDiv.appendChild(innerElement);

      container.appendChild(outerElement);

      await waitForUpdate(outerElement);
      await waitForUpdate(innerElement);

      // Middle div should find outer router
      const foundRouter = UIRouterLitElement.seekRouter(middleDiv);
      expect(foundRouter).toBe(outerRouter);
    });

    // A nested <ui-router> is a view boundary: the parent-view seek must stop
    // at it, or the inner view takes the outer tree's fqn and context and never
    // matches a config of the router it actually registered with.
    it('should root a fresh view tree for a <ui-view> inside it', async () => {
      const innerRouter = createTestRouter([
        {
          name: 'inner',
          url: '/inner',
          component: () => html`<div class="inner">Inner</div>`,
        },
      ]);
      const outerRouter = createTestRouter([
        {
          name: 'outer',
          url: '/outer',
          component: () =>
            html`<ui-router .uiRouter=${innerRouter}
              ><ui-view></ui-view
            ></ui-router>`,
        },
      ]);

      const outerElement = document.createElement('ui-router');
      outerElement.uiRouter = outerRouter;
      const outerView = document.createElement('ui-view');
      outerElement.appendChild(outerView);
      container.appendChild(outerElement);

      outerRouter.start();
      innerRouter.start();
      await tick();
      await outerRouter.stateService.go('outer');
      await tick(50);

      const innerView = outerView.querySelector('ui-view')!;
      expect(innerView).toBeInstanceOf(UiView);
      expect(innerView['_uiViewData'].fqn).toBe('$default');
      expect(innerView['parentView']).toBeNull();

      await innerRouter.stateService.go('inner');
      await tick(50);

      expect(innerView.querySelector('.inner')).not.toBeNull();
    });
  });

  describe('uiRouter swapped after the first update', () => {
    it('should warn that the page is split', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const element = document.createElement('ui-router');
        element.uiRouter = createTestRouter();
        container.appendChild(element);
        await waitForUpdate(element);

        expect(warn).not.toHaveBeenCalled();

        element.uiRouter = createTestRouter();
        await waitForUpdate(element);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toContain(
          'given a different uiRouter after its first update',
        );
      } finally {
        warn.mockRestore();
      }
    });

    it('should stay silent when the placeholder it minted is replaced', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        // The prerender path: the element provides a placeholder, the app hands it the real router.
        const element = document.createElement('ui-router');
        container.appendChild(element);
        await waitForUpdate(element);

        element.uiRouter = createTestRouter();
        await waitForUpdate(element);

        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it('should stay silent when the same router survives a re-attach', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const element = document.createElement('ui-router');
        element.uiRouter = createTestRouter();
        container.appendChild(element);
        await waitForUpdate(element);

        element.remove();
        container.appendChild(element);
        await waitForUpdate(element);

        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });
  });
});
