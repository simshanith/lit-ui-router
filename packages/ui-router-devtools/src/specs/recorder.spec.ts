import { expect, it, vi } from 'vitest';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';

import { record } from '../index.ts';
import { settled } from '../testing.ts';

const makeRouter = () => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => {});

  for (const name of ['a', 'b']) router.stateRegistry.register({ name });

  return router;
};

it('drops whole transitions from a full buffer and counts what it dropped', async () => {
  const router = makeRouter();
  const recorder = record(router, { limit: 40 });

  for (let i = 0; i < 12; i++) await router.stateService.go(i % 2 ? 'a' : 'b');
  await settled(recorder);

  const ids = new Set(
    recorder.events.flatMap((event) => ('id' in event ? [event.id] : [])),
  );

  // Every kept transition still has its start and its result.
  for (const id of ids) {
    const kinds = recorder.events
      .filter((event) => 'id' in event && event.id === id)
      .map((event) => event.type);

    expect(kinds[0]).toBe('transition');
    expect(kinds.at(-1)).toBe('result');
  }

  const session = recorder.session();
  expect(recorder.events.length).toBeLessThanOrEqual(40);
  expect(recorder.dropped).toBeGreaterThan(0);
  expect(session.dropped).toBe(recorder.dropped);
  expect(Math.min(...ids)).toBeGreaterThan(0);
  recorder.stop();
  router.dispose();
});

it('counts cleared events as dropped and writes the envelope', async () => {
  const router = makeRouter();
  const recorder = record(router, { timeResolves: true });
  await router.stateService.go('a');
  const before = recorder.events.length;
  recorder.clear();

  const session = recorder.session();
  expect(session).toMatchObject({
    format: 'ui-router-session',
    v: 1,
    routerId: recorder.routerId,
    dropped: before,
    timeResolves: true,
    redaction: { params: [], messages: true },
    generator: { name: 'ui-router-devtools', version: expect.any(String) },
  });
  expect(session.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-/);
  expect(session.events.map((event) => event.type)).toEqual([
    'config',
    'states',
    'current',
  ]);
  recorder.stop();
  router.dispose();
});

it('mints a version 4 session id where randomUUID is missing, as outside a secure context', () => {
  const router = makeRouter();
  const real = crypto;
  vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });

  try {
    const recorder = record(router);

    expect(recorder.session().id).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
    );
    recorder.stop();
  } finally {
    vi.unstubAllGlobals();
    router.dispose();
  }
});

it('drops and counts the later events of a transition trimmed while it ran', async () => {
  const router = makeRouter();
  let release = () => {};

  const held = new Promise<void>((resolve) => (release = resolve));

  router.stateRegistry.register({ name: 'held' });
  router.transitionService.onStart({ to: 'held' }, () => held);

  const recorder = record(router, { limit: 40 });
  const pending = router.stateService.go('held').catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 1));
  const first = recorder.events.find((event) => event.type === 'transition');

  for (let i = 0; i < 12; i++) await router.stateService.go(i % 2 ? 'a' : 'b');
  const dropped = recorder.dropped;
  expect(
    recorder.events.some((event) => 'id' in event && event.id === first?.id),
  ).toBe(false);

  release();
  await pending;
  await settled(recorder);

  // Its result arrives after it was trimmed, and is counted, not kept.
  expect(recorder.dropped).toBeGreaterThan(dropped);
  expect(
    recorder.events.some((event) => 'id' in event && event.id === first?.id),
  ).toBe(false);
  recorder.stop();
  router.dispose();
});
