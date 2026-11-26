import { afterEach, expect, it } from 'vitest';
import { getByRole, waitFor } from '@testing-library/dom';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';

import { LazyDevtoolsPlugin } from '../lazy.ts';
import { record } from '../recorder.ts';
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

// Mounts into `target` and returns the element mount() appended.
const mountInto = async (
  devtools: LazyDevtoolsPlugin,
  target: Element,
): Promise<UIRouterDevtools> => {
  await devtools.mount(target);

  const { element } = devtools;

  if (!element) throw new Error('mount() resolved without an element');
  await element.updateComplete;

  return element;
};

const container = (): HTMLElement => {
  const target = document.createElement('section');
  document.body.append(target);

  return target;
};

it('shows the transitions recorded before mount(), then follows the router', async () => {
  const router = makeRouter();

  const devtools = router.plugin(LazyDevtoolsPlugin, {
    timeResolves: true,
    redaction: { params: ['id'] },
  });

  await router.stateService.go('home');

  expect(document.querySelector('ui-router-devtools')).toBeNull();
  expect(devtools.element).toBeUndefined();

  const target = container();
  const element = await mountInto(devtools, target);

  expect(element.parentElement).toBe(target);
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

it('rejects a second mount() while mounting or mounted, and an unmount() while unmounted', async () => {
  const router = makeRouter();
  const devtools = router.plugin(LazyDevtoolsPlugin);
  const target = container();

  expect(() => devtools.unmount()).toThrow('not mounted');

  const mounting = devtools.mount(target);
  await expect(devtools.mount(target)).rejects.toThrow('already mounted');
  await mounting;
  await expect(devtools.mount(container())).rejects.toThrow('already mounted');
  expect(document.querySelectorAll('ui-router-devtools')).toHaveLength(1);
  expect(devtools.element?.parentElement).toBe(target);
});

it('keeps recording across unmount(), and a later mount() replays the buffer', async () => {
  const router = makeRouter();
  const devtools = router.plugin(LazyDevtoolsPlugin);

  await devtools.mount(container());
  await router.stateService.go('home');
  devtools.unmount();
  expect(devtools.element).toBeUndefined();
  expect(document.querySelector('ui-router-devtools')).toBeNull();

  await router.stateService.go('about');

  const target = container();
  const element = await mountInto(devtools, target);

  expect(element.parentElement).toBe(target);
  expect(panelOf(element)._model.txs.map((tx) => tx.to)).toEqual([
    'home',
    'about',
  ]);

  router.dispose(devtools);
  expect(document.querySelector('ui-router-devtools')).toBeNull();

  const recorded = devtools.recorder.events.length;
  await router.stateService.go('home');
  expect(devtools.recorder.events).toHaveLength(recorded);
  await expect(devtools.mount(target)).rejects.toThrow('disposed');
});

it('mounts once when unmount() and mount() run while the first mount() loads', async () => {
  const router = makeRouter();
  const devtools = router.plugin(LazyDevtoolsPlugin);
  const first = container();
  const second = container();

  const cancelled = devtools.mount(first);
  devtools.unmount();
  await Promise.all([cancelled, devtools.mount(second)]);

  expect(first.children).toHaveLength(0);
  expect(devtools.element?.parentElement).toBe(second);
  expect(document.querySelectorAll('ui-router-devtools')).toHaveLength(1);
});

it('stays unmounted when the append fails, so mount() can try again', async () => {
  const router = makeRouter();
  const devtools = router.plugin(LazyDevtoolsPlugin);
  const element = await mountInto(devtools, container());

  devtools.unmount();
  // An element cannot be appended to itself.
  await expect(devtools.mount(element)).rejects.toThrow();
  expect(() => devtools.unmount()).toThrow('not mounted');

  const target = container();

  await mountInto(devtools, target);
  expect(devtools.element?.parentElement).toBe(target);
});

it('appends nothing when unmounted or disposed before mount() settles', async () => {
  const router = makeRouter();
  const devtools = router.plugin(LazyDevtoolsPlugin);
  const target = container();

  const unmounted = devtools.mount(target);
  devtools.unmount();
  await unmounted;
  expect(target.children).toHaveLength(0);
  expect(devtools.element).toBeUndefined();

  const disposed = devtools.mount(target);
  router.dispose(devtools);
  await disposed;
  expect(target.children).toHaveLength(0);
  expect(devtools.element).toBeUndefined();
});

it('follows a recorder set on an attached panel, and records itself once it is cleared', async () => {
  const router = makeRouter();

  const first = router.plugin(LazyDevtoolsPlugin);
  const element = await mountInto(first, container());
  const panel = panelOf(element);

  await router.stateService.go('home');
  await element.updateComplete;
  expect(panel._model.txs.map((tx) => tx.to)).toEqual(['home']);

  const second = record(router);

  await router.stateService.go('about');
  element.recorder = second;
  await element.updateComplete;
  expect(element.recorder).toBe(second);
  expect(panel._model.txs.map((tx) => tx.to)).toEqual(['about']);

  element.recorder = undefined;
  await element.updateComplete;
  expect(element.recorder).not.toBe(second);
  expect(element.recorder).not.toBe(first.recorder);
  expect(panel._model.txs).toEqual([]);

  // A panel lets go of a recorder it was given without stopping it.
  await router.stateService.go('home');
  expect(second.events.at(-1)?.type).toBe('result');
  second.stop();
});
