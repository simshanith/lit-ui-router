import type {
  RawParams,
  StateObject,
  TransitionOptions,
  UIRouter,
} from '@uirouter/core';
import { delay } from './states.ts';

export const goQuietly = (
  router: UIRouter,
  state: string,
  params?: RawParams,
  options?: TransitionOptions,
): Promise<StateObject | undefined> =>
  router.stateService.go(state, params, options).catch(() => undefined);

// Changes the URL and waits for the transition the URL sync starts.
export const goByUrl = (router: UIRouter, url: string): Promise<void> =>
  new Promise((resolve) => {
    // SAFETY: core types every hook deregistration as Function; each takes no arguments
    const offs: (() => void)[] = [
      router.transitionService.onSuccess({}, () => done()),
      router.transitionService.onError({}, () => done()),
    ].map((off) => off as () => void);

    const done = () => {
      offs.forEach((off) => off());
      resolve();
    };

    router.urlService.url(url);
  });

// The fixed `?demo=1` sequence; transition ids 001 to 013 follow the initial 000, and the invalid target takes none.
export const demoSequence = async (router: UIRouter): Promise<void> => {
  const go = (state: string, params?: RawParams, options?: TransitionOptions) =>
    goQuietly(router, state, params, options);

  await go('galaxy.stars');
  await go('galaxy.stars.star', { starId: 'vega' });
  await go('galaxy');
  const superseded = go('galaxy.astronaut');
  await delay(60, null);
  await go('galaxy.stars.star', { starId: 'sirius' });
  await superseded;
  await go('galaxy.stars.star', { starId: 'sirius' });
  await go('galaxy.stars.star', { starId: 'sirius' });
  await go('galaxy.blackhole');
  await goByUrl(router, '/galaxy/astronaut');
  await go(
    'galaxy.stars.star',
    { starId: 'arcturus' },
    { location: 'replace' },
  );
  await go('galaxy.stars.star', { starId: 'arcturus' }, { reload: true });
  await go('galaxy.planets');
  await go('galaxy.stars.star', {}, { inherit: false });
};
