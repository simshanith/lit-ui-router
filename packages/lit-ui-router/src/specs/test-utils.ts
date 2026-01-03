import { html, LitElement, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import {
  memoryLocationPlugin,
  // StateDeclaration,
  pushStateLocationPlugin,
} from '@uirouter/core';

import { UIRouterLit } from '../core.js';
import { UIRouterLitElement } from '../ui-router.js';
import { LitStateDeclaration } from '../interface.js';

/**
 * Creates a test router instance with memory location plugin.
 * This allows testing without affecting browser URL.
 */
export function createTestRouter(
  states: LitStateDeclaration[] = [],
  options: { useHash?: boolean; usePushState?: boolean } = {},
): UIRouterLit {
  const router = new UIRouterLit();

  if (options.usePushState) {
    router.plugin(pushStateLocationPlugin);
  } else {
    router.plugin(memoryLocationPlugin);
  }

  states.forEach((state) => router.stateRegistry.register(state));

  return router;
}

/**
 * Navigates to a state and waits for the transition to complete.
 */
export async function routerGo(
  router: UIRouterLit,
  state: string,
  params?: Record<string, unknown>,
): Promise<void> {
  await router.stateService.go(state, params);
  await tick();
}

/**
 * Wait for microtasks and pending promises to flush.
 */
export function tick(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulates a mouse click on an element.
 */
export function clickElement(
  element: Element,
  options: Partial<MouseEventInit> = {},
): void {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
    view: window,
    ...options,
  });
  element.dispatchEvent(event);
}

/**
 * Waits for a LitElement to complete its update cycle.
 */
export async function waitForUpdate(element: LitElement): Promise<void> {
  await element.updateComplete;
  await tick();
}

/**
 * Test container element that wraps content in a ui-router context.
 */
@customElement('test-router-container')
export class TestRouterContainer extends LitElement {
  router: UIRouterLit | undefined;

  createRenderRoot() {
    return this;
  }

  render() {
    return html`<ui-router .uiRouter=${this.router}><slot></slot></ui-router>`;
  }
}

/**
 * Creates a test fixture with a router and container element.
 */
export interface TestFixture {
  container: HTMLElement;
  router: UIRouterLit;
  cleanup: () => void;
}

export async function createTestFixture(
  states: LitStateDeclaration[] = [],
  template?: TemplateResult,
): Promise<TestFixture> {
  const router = createTestRouter(states);
  const container = document.createElement('div');
  document.body.appendChild(container);

  if (template) {
    const wrapper = document.createElement('test-router-container');
    (wrapper as TestRouterContainer).router = router;
    container.appendChild(wrapper);

    // Create a temporary element to render the template into
    const tempContainer = document.createElement('div');
    const { render } = await import('lit');
    render(template, tempContainer);

    // Move rendered content into the wrapper's slot
    while (tempContainer.firstChild) {
      wrapper.appendChild(tempContainer.firstChild);
    }

    await waitForUpdate(wrapper as LitElement);
  } else {
    const uiRouterEl = document.createElement(
      'ui-router',
    ) as UIRouterLitElement;
    uiRouterEl.uiRouter = router;
    container.appendChild(uiRouterEl);
    await waitForUpdate(uiRouterEl);
  }

  return {
    container,
    router,
    cleanup: () => {
      container.remove();
    },
  };
}

/**
 * Mounts an element inside a ui-router context and returns it.
 */
export async function mountInRouter<T extends HTMLElement>(
  tagName: string,
  router: UIRouterLit,
  attributes: Record<string, string> = {},
): Promise<{ element: T; container: HTMLElement; cleanup: () => void }> {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const uiRouterEl = document.createElement('ui-router') as UIRouterLitElement;
  uiRouterEl.uiRouter = router;

  const element = document.createElement(tagName) as T;
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  uiRouterEl.appendChild(element);
  container.appendChild(uiRouterEl);

  await waitForUpdate(uiRouterEl);
  if (element instanceof LitElement) {
    await waitForUpdate(element);
  }

  return {
    element,
    container,
    cleanup: () => {
      container.remove();
    },
  };
}

/**
 * Creates a simple test component for use in state declarations.
 */
export function createTestComponent(
  name: string,
  content: string = name,
): typeof LitElement {
  @customElement(name)
  class TestComponent extends LitElement {
    createRenderRoot() {
      return this;
    }
    render() {
      return html`<div class="test-component">${content}</div>`;
    }
  }
  return TestComponent;
}

/**
 * Wait for a specific condition to be true.
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 1000,
  interval = 10,
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('waitFor timeout');
    }
    await tick(interval);
  }
}

/**
 * Creates a deferred promise that can be resolved/rejected externally.
 */
export function defer<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Suppress console errors during a test.
 */
export function suppressConsoleErrors(): () => void {
  const originalError = console.error;
  console.error = () => {};
  return () => {
    console.error = originalError;
  };
}
