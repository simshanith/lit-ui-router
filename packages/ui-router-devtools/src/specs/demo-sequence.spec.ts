// Drives the demo router headlessly through the `?demo=1` sequence and asserts the normalised log.
import { expect, it } from 'vitest';
import { UIRouter, memoryLocationPlugin, servicesPlugin } from '@uirouter/core';

import { demoSequence } from '../../demo/sequence.ts';
import { demoStates } from '../../demo/states.ts';
import { record } from '../index.ts';
import { settled, transitions } from '../testing.ts';

it('records the demo sequence as the normalised log', async () => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => {});
  demoStates().forEach((state) => router.stateRegistry.register(state));

  const recorder = record(router, {
    redact: (key, value) =>
      key === 'starId' && value === 'vega' ? '[redacted]' : value,
  });

  router.urlService.rules.initial({
    state: 'galaxy.stars.star',
    params: { starId: 'sun' },
  });
  router.urlService.listen();
  router.urlService.sync();
  await settled(recorder);
  await demoSequence(router);
  await settled(recorder);

  const log = transitions(recorder).map(
    ({ id, to, outcome, reason, redirectedFrom }) => ({
      id,
      to,
      outcome,
      reason,
      redirectedFrom,
    }),
  );

  expect(log).toEqual([
    {
      id: 0,
      to: 'galaxy.stars.star',
      outcome: 'success',
      reason: null,
      redirectedFrom: null,
    },
    {
      id: 1,
      to: 'galaxy.stars',
      outcome: 'success',
      reason: null,
      redirectedFrom: null,
    },
    {
      id: 2,
      to: 'galaxy.stars.star',
      outcome: 'success',
      reason: null,
      redirectedFrom: null,
    },
    {
      id: 3,
      to: 'galaxy',
      outcome: 'redirected',
      reason: 'Redirected to 004',
      redirectedFrom: null,
    },
    {
      id: 4,
      to: 'galaxy.stars',
      outcome: 'success',
      reason: null,
      redirectedFrom: 3,
    },
    {
      id: 5,
      to: 'galaxy.astronaut',
      outcome: 'superseded',
      reason: 'Superseded by 006',
      redirectedFrom: null,
    },
    {
      id: 6,
      to: 'galaxy.stars.star',
      outcome: 'success',
      reason: null,
      redirectedFrom: null,
    },
    {
      id: 7,
      to: 'galaxy.stars.star',
      outcome: 'ignored',
      reason: 'Same state and params; pass reload: true to run it again',
      redirectedFrom: null,
    },
    {
      id: 8,
      to: 'galaxy.stars.star',
      outcome: 'ignored',
      reason: 'Same state and params; pass reload: true to run it again',
      redirectedFrom: null,
    },
    {
      id: 9,
      to: 'galaxy.blackhole',
      outcome: 'error',
      reason: 'Resolve "horizon" rejected: no data escapes',
      redirectedFrom: null,
    },
    {
      id: 10,
      to: 'galaxy.astronaut',
      outcome: 'success',
      reason: null,
      redirectedFrom: null,
    },
    {
      id: 11,
      to: 'galaxy.stars.star',
      outcome: 'success',
      reason: null,
      redirectedFrom: null,
    },
    {
      id: 12,
      to: 'galaxy.stars.star',
      outcome: 'success',
      reason: null,
      redirectedFrom: null,
    },
    {
      id: null,
      to: 'galaxy.planets',
      outcome: 'invalid',
      reason: "No state named 'galaxy.planets'",
      redirectedFrom: null,
    },
  ]);

  expect(transitions(recorder)[2]?.params).toEqual({ starId: '[redacted]' });

  const [url, replace, reload] = recorder.events.filter(
    (event) => event.type === 'transition' && event.id >= 10,
  );

  expect(url?.type === 'transition' && url.options.source).toBe('url');
  expect(replace?.type === 'transition' && replace.options.location).toBe(
    'replace',
  );
  expect(reload?.type === 'transition' && reload.options.reload).toBe(true);
  expect(recorder.session().events.every((event) => event.v === 1)).toBe(true);
  expect(recorder.events.some((event) => event.type === 'resolve')).toBe(false);
  recorder.stop();
  router.dispose();
});
