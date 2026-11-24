import { afterEach, expect, it } from 'vitest';
import { getByRole, waitFor } from '@testing-library/dom';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';

import { LazyDevtoolsPlugin } from '../lazy.ts';
import type { DevtoolsPanel } from '../element/panel.ts';
import type { UIRouterDevtools } from '../ui-router-devtools.ts';

const routers: UIRouter[] = [];

const makeRouter = (): UIRouter => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateRegistry.register({ name: 'home', url: '/home' });
  router.stateRegistry.register({ name: 'about', url: '/about' });
  routers.push(router);

  return router;
};

// SAFETY: testing-library types its container as HTMLElement and only calls querySelectorAll on it
const shadow = (element: UIRouterDevtools): HTMLElement =>
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- a ShadowRoot is a DocumentFragment, never an HTMLElement
  element.renderRoot as unknown as HTMLElement;

// SAFETY: the registered class is DevtoolsPanel; the public type hides its render state
const panelOf = (element: UIRouterDevtools) => element as DevtoolsPanel;

afterEach(() => {
  for (const router of routers.splice(0)) router.dispose();
  document.body.replaceChildren();
});

it('shows the transitions recorded before activate(), then follows the router', async () => {
  const router = makeRouter();

  const devtools = router.plugin(LazyDevtoolsPlugin, {
    timeResolves: true,
    redaction: { params: ['id'] },
  });

  await router.stateService.go('home');

  expect(document.querySelector('ui-router-devtools')).toBeNull();
  expect(devtools.element).toBeUndefined();

  const element = await devtools.activate();
  await element.updateComplete;

  expect(await devtools.activate()).toBe(element);
  expect(element.recorder).toBe(devtools.recorder);
  expect(element.timeResolves).toBe(true);
  expect(element.redaction.params).toEqual(['id']);
  expect(panelOf(element)._model.txs.map((tx) => tx.to)).toEqual(['home']);
  getByRole(shadow(element), 'button', { name: /Router .*home/ });

  await router.stateService.go('about');
  await waitFor(() =>
    expect(panelOf(element)._model.txs.map((tx) => tx.to)).toEqual([
      'home',
      'about',
    ]),
  );
});

it('leaves the recorder running when the element is removed, and stops it on dispose', async () => {
  const router = makeRouter();
  const devtools = router.plugin(LazyDevtoolsPlugin);
  const element = await devtools.activate();

  element.remove();
  await router.stateService.go('home');
  expect(
    devtools.recorder.events.some((event) => event.type === 'result'),
  ).toBe(true);

  document.body.append(element);
  await element.updateComplete;
  expect(panelOf(element)._model.txs.map((tx) => tx.to)).toEqual(['home']);

  router.dispose(devtools);
  expect(document.body.contains(element)).toBe(false);

  const recorded = devtools.recorder.events.length;
  await router.stateService.go('about');
  expect(devtools.recorder.events).toHaveLength(recorded);
});

it('does not append the element when disposed before activate() settles', async () => {
  const router = makeRouter();
  const devtools = router.plugin(LazyDevtoolsPlugin);
  const activating = devtools.activate();
  router.dispose(devtools);

  await expect(activating).rejects.toThrow('disposed');
  expect(document.querySelector('ui-router-devtools')).toBeNull();
});
