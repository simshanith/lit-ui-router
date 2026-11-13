import { afterEach, expect, it } from 'vitest';
import { getByRole, waitFor } from '@testing-library/dom';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';

import '../define.ts';
import { DevtoolsPlugin } from '../plugin.ts';
import { UIRouterDevtools } from '../ui-router-devtools.ts';

const routers: UIRouter[] = [];

const makeRouter = (): UIRouter => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateRegistry.register({ name: 'home', url: '/home' });
  routers.push(router);

  return router;
};

// SAFETY: testing-library types its container as HTMLElement and only calls querySelectorAll on it
const shadow = (element: UIRouterDevtools): HTMLElement =>
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- a ShadowRoot is a DocumentFragment, never an HTMLElement
  element.renderRoot as unknown as HTMLElement;

afterEach(() => {
  for (const router of routers.splice(0)) router.dispose();
  document.body.replaceChildren();
});

it('defines <ui-router-devtools>', () => {
  expect(customElements.get('ui-router-devtools')).toBe(UIRouterDevtools);
});

it('shows the pill with the current state and opens the panel', async () => {
  const router = makeRouter();
  const devtools = router.plugin(DevtoolsPlugin);
  const element = devtools.element;
  await router.stateService.go('home');
  await element.updateComplete;

  const pill = await waitFor(() =>
    getByRole(shadow(element), 'button', { name: /Router .*home/ }),
  );

  expect(pill.matches(':popover-open')).toBe(true);

  pill.click();
  await element.updateComplete;

  const panel = getByRole(shadow(element), 'region', {
    name: 'Router devtools',
  });

  expect(panel.matches(':popover-open')).toBe(true);
  expect(pill.matches(':popover-open')).toBe(false);
  await waitFor(() =>
    expect(
      getByRole(shadow(element), 'button', { name: 'Collapse devtools' }),
    ).toBe(element.shadowRoot?.activeElement),
  );
});

it('removes the element when the plugin is disposed', () => {
  const router = makeRouter();
  const devtools = router.plugin(DevtoolsPlugin);
  expect(document.body.contains(devtools.element)).toBe(true);
  router.dispose(devtools);
  expect(document.body.contains(devtools.element)).toBe(false);
});

const pending = (router: UIRouter) => {
  router.stateRegistry.register({
    name: 'slow',
    url: '/slow',
    resolve: [{ token: 'never', resolveFn: () => new Promise(() => {}) }],
  });
  void router.stateService.go('slow').catch(() => {});
};

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

it('stops ticking when removed mid-transition', async () => {
  const router = makeRouter();
  const devtools = router.plugin(DevtoolsPlugin);
  const element = devtools.element;
  pending(router);
  await waitFor(() => expect(element._runningTx?.to).toBe('slow'));

  const ticking = element._now;
  await waitFor(() => expect(element._now).not.toBe(ticking));

  element.remove();
  await element.updateComplete;
  const removed = element._now;
  await tick(350);

  expect(element._now).toBe(removed);
});
