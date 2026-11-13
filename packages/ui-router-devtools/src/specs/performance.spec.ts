import { afterEach, expect, it } from 'vitest';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';

import { record } from '../index.ts';
import { reportToPerformance } from '../performance.ts';
import { settled } from '../testing.ts';

interface TrackEntry {
  dataType: string;
  track: string;
  trackGroup: string;
  color: string;
  properties: [string, string][];
  tooltipText: string;
}

const measures = () =>
  performance.getEntriesByType('measure').flatMap((entry) => {
    // SAFETY: reportToPerformance writes every measure with a devtools detail
    const detail = (entry as PerformanceMeasure).detail as
      | { devtools?: TrackEntry }
      | undefined;

    return detail?.devtools ? [{ name: entry.name, ...detail.devtools }] : [];
  });

afterEach(() => {
  performance.clearMeasures();
  performance.clearMarks();
});

it('writes one track entry per transition, phase and resolve', async () => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => {});
  router.stateRegistry.register({
    name: 'a',
    url: '/a',
    resolve: [{ token: 'data', resolveFn: () => Promise.resolve(1) }],
  });
  router.stateRegistry.register({
    name: 'broken',
    url: '/broken',
    resolve: [
      { token: 'fails', resolveFn: () => Promise.reject(new Error('no')) },
    ],
  });
  const recorder = record(router, { timeResolves: true });
  const stop = reportToPerformance(recorder);
  await router.stateService.go('a');
  await router.stateService.go('broken').catch(() => undefined);
  await router.stateService.go('missing').catch(() => undefined);
  await settled(recorder);
  stop();
  recorder.stop();
  router.dispose();

  const entries = measures();
  expect(
    entries.every(
      (entry) =>
        entry.dataType === 'track-entry' && entry.trackGroup === 'UI-Router',
    ),
  ).toBe(true);
  expect(
    entries
      .filter((entry) => entry.track === 'Transitions')
      .map(({ name, color }) => ({ name, color })),
  ).toEqual([
    { name: '000 a', color: 'primary' },
    { name: '001 broken', color: 'error' },
    { name: 'missing', color: 'error' },
  ]);
  expect(
    entries
      .filter((entry) => entry.track === 'Resolves')
      .map(({ name, color }) => ({ name, color })),
  ).toEqual([
    { name: 'data', color: 'tertiary' },
    { name: 'fails', color: 'error' },
  ]);
  expect(
    entries
      .filter((entry) => entry.track === 'Phases' && entry.name === 'enter a')
      .map(({ properties }) => properties),
  ).toEqual([[['transition', '000']]]);
  expect(
    performance
      .getEntriesByType('mark')
      .filter((mark) => mark.name.startsWith('ui-router 000'))
      .map((mark) => mark.name),
  ).toEqual(['ui-router 000 start', 'ui-router 000 success']);
});
