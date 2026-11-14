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

  const recorder = record(router);

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
    ({ id, to, outcome, by, message, redirectedFrom }) => ({
      id,
      to,
      outcome,
      by,
      message,
      redirectedFrom,
    }),
  );

  expect(log).toEqual([
    {
      id: 0,
      to: 'galaxy.stars.star',
      outcome: 'success',
      by: null,
      message: null,
      redirectedFrom: null,
    },
    {
      id: 1,
      to: 'galaxy.stars',
      outcome: 'success',
      by: null,
      message: null,
      redirectedFrom: null,
    },
    {
      id: 2,
      to: 'galaxy.stars.star',
      outcome: 'success',
      by: null,
      message: null,
      redirectedFrom: null,
    },
    {
      id: 3,
      to: 'galaxy',
      outcome: 'redirected',
      by: 4,
      message: null,
      redirectedFrom: null,
    },
    {
      id: 4,
      to: 'galaxy.stars',
      outcome: 'success',
      by: null,
      message: null,
      redirectedFrom: 3,
    },
    {
      id: 5,
      to: 'galaxy.astronaut',
      outcome: 'superseded',
      by: 6,
      message: null,
      redirectedFrom: null,
    },
    {
      id: 6,
      to: 'galaxy.stars.star',
      outcome: 'success',
      by: null,
      message: null,
      redirectedFrom: null,
    },
    {
      id: 7,
      to: 'galaxy.stars.star',
      outcome: 'ignored',
      by: null,
      message: null,
      redirectedFrom: null,
    },
    {
      id: 8,
      to: 'galaxy.stars.star',
      outcome: 'ignored',
      by: null,
      message: null,
      redirectedFrom: null,
    },
    {
      id: 9,
      to: 'galaxy.blackhole',
      outcome: 'error',
      by: null,
      message: 'Resolve "horizon" rejected: no data escapes',
      redirectedFrom: null,
    },
    {
      id: 10,
      to: 'galaxy.astronaut',
      outcome: 'success',
      by: null,
      message: null,
      redirectedFrom: null,
    },
    {
      id: 11,
      to: 'galaxy.stars.star',
      outcome: 'success',
      by: null,
      message: null,
      redirectedFrom: null,
    },
    {
      id: 12,
      to: 'galaxy.stars.star',
      outcome: 'success',
      by: null,
      message: null,
      redirectedFrom: null,
    },
    {
      id: null,
      to: 'galaxy.planets',
      outcome: 'invalid',
      by: null,
      message: null,
      redirectedFrom: null,
    },
    {
      id: 13,
      to: 'galaxy.stars.star',
      outcome: 'invalid',
      by: null,
      message:
        "The following parameter values are not valid for state 'galaxy.stars.star': [starId:undefined]",
      redirectedFrom: null,
    },
  ]);

  expect(transitions(recorder)[2]?.params).toEqual({ starId: 'vega' });

  const exported = recorder.session();

  const second = exported.events.find(
    (event) => event.type === 'transition' && event.id === 2,
  );

  expect(second?.type === 'transition' && second.toParams).toEqual({
    starId: '[redacted]',
  });
  expect(exported.redaction).toEqual({ params: [], messages: true });
  expect(exported).toMatchObject({
    format: 'ui-router-session',
    v: 1,
    generator: { name: 'ui-router-devtools' },
    dropped: 0,
    timeResolves: false,
  });

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
