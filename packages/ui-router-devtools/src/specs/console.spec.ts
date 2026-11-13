import { afterEach, expect, it, vi } from 'vitest';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';

import { reportToConsole } from '../console.ts';
import { record } from '../recorder.ts';
import { settled } from '../testing.ts';

const makeRouter = () => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => {});
  router.stateRegistry.register({ name: 'item', url: '/item/:id' });
  router.stateRegistry.register({
    name: 'boom',
    onEnter: () => {
      throw new Error('boom failed');
    },
  });

  return router;
};

// The console's own output is the observable; each spy keeps it out of the test log.
const spies = () => ({
  group: vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {}),
  end: vi.spyOn(console, 'groupEnd').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  table: vi.spyOn(console, 'table').mockImplementation(() => {}),
});

afterEach(() => vi.restoreAllMocks());

it('reports each settled transition from a recorded list as one group', async () => {
  const router = makeRouter();
  const recorder = record(router);
  await router.stateService.go('item', { id: '1' });
  await router.stateService.go('item', { id: '2' });
  await router.stateService.go('boom').catch(() => {});
  await settled(recorder);

  const out = spies();
  reportToConsole(recorder.events)();

  expect(out.group.mock.calls.map(([header]) => header)).toEqual([
    expect.stringMatching(/^000 .*item/),
    expect.stringMatching(/^001 .*item/),
    expect.stringMatching(/^002 .*boom/),
  ]);
  expect(out.end).toHaveBeenCalledTimes(3);
  // Only the changed param is tabled, before and after.
  expect(out.table).toHaveBeenCalledWith({ id: { before: '1', after: '2' } });
  expect(out.error).toHaveBeenCalledWith(
    expect.stringContaining('boom failed'),
  );

  recorder.stop();
  router.dispose();
});

it('keeps reporting from a recorder until stopped, including invalid targets', async () => {
  const router = makeRouter();
  const recorder = record(router);
  const out = spies();
  const stop = reportToConsole(recorder);

  await router.stateService.go('typo').catch(() => {});
  await router.stateService.go('item', { id: '1' });
  await router.stateService.go('item', { id: '1' }).catch(() => {});
  await settled(recorder);

  expect(out.group.mock.calls.map(([header]) => header)).toEqual([
    expect.stringContaining('typo'),
    expect.stringMatching(/item/),
    expect.stringMatching(/item/),
  ]);
  expect(out.error).toHaveBeenCalledWith("No state named 'typo'");
  // An ignored repeat says why, dimmed.
  expect(out.log).toHaveBeenCalledWith(
    expect.stringContaining('pass reload: true'),
    expect.any(String),
  );

  stop();
  await router.stateService.go('item', { id: '3' });
  await settled(recorder);
  expect(out.group).toHaveBeenCalledTimes(3);

  recorder.stop();
  router.dispose();
});
