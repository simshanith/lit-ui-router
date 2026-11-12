import { describe, expect, it } from 'vitest';
import {
  memoryLocationPlugin,
  Rejection,
  servicesPlugin,
  UIRouter,
  type StateDeclaration,
} from '@uirouter/core';

import type { RouterEvent } from '../event-schema.ts';
import { observe } from '../router-events.ts';
import { messageOf, reasonFor } from '../transition-reasons.ts';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const states: StateDeclaration[] = [
  { name: 'a', url: '/a' },
  { name: 'b', url: '/b' },
  { name: 'r', url: '/r', redirectTo: 'b' },
  {
    name: 'boom',
    url: '/boom',
    onEnter: () => {
      throw new Error('boom failed');
    },
  },
  {
    name: 'slow',
    url: '/slow',
    resolve: [{ token: 'wait', resolveFn: () => sleep(5) }],
  },
  {
    name: 'p',
    url: '/p',
    resolve: [{ token: 'P', resolveFn: () => 'P' }],
  },
  {
    name: 'p.ok',
    url: '/ok',
    resolve: [{ token: 'C', resolveFn: () => 'C' }],
  },
  {
    name: 'p.fail',
    url: '/fail',
    resolve: [
      { token: 'F', resolveFn: () => Promise.reject(new Error('no data')) },
      {
        token: 'T',
        resolveFn: () => {
          throw new Error('threw');
        },
      },
    ],
  },
];

const run = async (script: (router: UIRouter) => Promise<void>) => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => {});

  for (const state of states) router.stateRegistry.register(state);
  router.stateRegistry.register({ name: 'guarded', url: '/guarded' });
  router.transitionService.onStart({ to: 'guarded' }, () => false);

  const events: RouterEvent[] = [];

  const stop = observe(router, (event) => events.push(event), {
    timeResolves: true,
    redact: (key, value) => (key === 'secret' ? '***' : value),
  });

  await script(router);
  await sleep(10);
  stop();
  router.dispose();

  const of = <T extends RouterEvent['type']>(type: T) =>
    events.filter(
      (e): e is Extract<RouterEvent, { type: T }> => e.type === type,
    );

  return {
    transitions: of('transition'),
    results: of('result').map(({ outcome, reason, message }) => ({
      outcome,
      reason,
      message,
    })),
    resolves: of('resolve'),
  };
};

const go = (
  router: UIRouter,
  ...args: Parameters<UIRouter['stateService']['go']>
) =>
  router.stateService.go(...args).then(
    () => {},
    () => {},
  );

describe('results', () => {
  it('give each outcome its reason and message', async () => {
    const { results } = await run(async (router) => {
      await go(router, 'a');
      await go(router, 'a');
      await go(router, 'r');
      await go(router, 'boom');
      void go(router, 'slow');
      await go(router, 'a', {}, { reload: true });
      await go(router, 'guarded');
    });

    expect(results).toEqual([
      { outcome: 'success', reason: null, message: undefined },
      {
        outcome: 'ignored',
        reason: 'Same state and params; pass reload: true to run it again',
        message: undefined,
      },
      {
        outcome: 'redirected',
        reason: 'Redirected to 003',
        message: undefined,
      },
      { outcome: 'success', reason: null, message: undefined },
      { outcome: 'error', reason: 'boom failed', message: 'boom failed' },
      {
        outcome: 'superseded',
        reason: 'Superseded by 006',
        message: undefined,
      },
      { outcome: 'success', reason: null, message: undefined },
      { outcome: 'aborted', reason: 'Aborted by a hook', message: undefined },
    ]);
  });

  it('records options, params and the redirect origin', async () => {
    const { transitions } = await run(async (router) => {
      await go(router, 'a');
      await go(
        router,
        'r',
        { secret: 's' },
        { location: 'replace', reload: 'a' },
      );
    });

    const [, origin, successor] = transitions;
    expect(origin?.options).toMatchObject({
      location: 'replace',
      reload: 'a',
      source: 'unknown',
    });
    expect(successor?.redirectedFrom).toBe(origin?.id);
    expect(successor?.options.source).toBe('redirect');
  });
});

describe('resolve timing', () => {
  it('reports failures and cached values', async () => {
    const { resolves } = await run(async (router) => {
      await go(router, 'p.ok');
      await go(router, 'p.fail');
    });

    expect(
      resolves.map(({ token, ok, cached, message }) => ({
        token,
        ok,
        cached,
        message,
      })),
    ).toEqual(
      expect.arrayContaining([
        { token: 'P', ok: true, cached: false, message: undefined },
        { token: 'C', ok: true, cached: false, message: undefined },
        { token: 'P', ok: true, cached: true, message: undefined },
        { token: 'F', ok: false, cached: false, message: 'no data' },
      ]),
    );
  });
});

describe('reasons', () => {
  it('fall back when no transition is named', () => {
    const base = { message: '', successor: null, supersededBy: null };
    expect(reasonFor({ ...base, outcome: 'redirected' })).toBe('Redirected');
    expect(reasonFor({ ...base, outcome: 'superseded' })).toBe(
      'Superseded by a newer transition',
    );
    expect(reasonFor({ ...base, outcome: 'aborted' })).toBe(
      'Aborted by a hook',
    );
    expect(reasonFor({ ...base, outcome: 'invalid', message: 'x' })).toBe(
      'Invalid transition: x',
    );
    expect(reasonFor({ ...base, outcome: 'error' })).toBe(
      'A hook or resolve threw',
    );
  });

  it('read the message from an error, a string or a rejection', () => {
    expect(messageOf(new Error('e'))).toBe('e');
    expect(messageOf(Rejection.errored('s'))).toBe('s');
    expect(messageOf(Rejection.aborted())).toBe(
      'The transition has been aborted',
    );
    expect(messageOf(42)).toBe('42');
  });
});
