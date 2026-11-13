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
import { messageOf } from '../thrown.ts';

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
    name: 'n',
    url: '/n/:num',
    params: { num: { type: 'int' } },
  },
  { name: 'abstract', url: '/abstract', abstract: true },
  { name: 'toAbstract', url: '/to-abstract', redirectTo: 'abstract' },
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
    results: of('result').map(({ outcome, by, message }) => ({
      outcome,
      by,
      message,
    })),
    resolves: of('resolve'),
    raw: of('result'),
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
  it('give each outcome its successor and message', async () => {
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
      { outcome: 'success', by: undefined, message: undefined },
      { outcome: 'ignored', by: undefined, message: undefined },
      { outcome: 'redirected', by: 3, message: undefined },
      { outcome: 'success', by: undefined, message: undefined },
      { outcome: 'error', by: undefined, message: 'boom failed' },
      { outcome: 'superseded', by: 6, message: undefined },
      { outcome: 'success', by: undefined, message: undefined },
      {
        outcome: 'aborted',
        by: undefined,
        message: 'Hook aborted transition',
      },
    ]);
  });

  it('name the error a hook threw', async () => {
    const { raw } = await run(async (router) => {
      await go(router, 'boom');
    });

    expect(raw[0]).toMatchObject({ outcome: 'error', errorName: 'Error' });
    expect(raw[0]).not.toHaveProperty('reason');
  });

  it('leave an abort() without a message', async () => {
    const { raw } = await run(async (router) => {
      router.transitionService.onStart({ to: 'slow' }, (trans) => {
        trans.abort();
      });
      await go(router, 'slow');
    });

    expect(raw[0]?.outcome).toBe('aborted');
    expect(raw[0]).not.toHaveProperty('message');
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

describe('core rejections', () => {
  it('record invalid param values as an invalid outcome naming the params', async () => {
    const { raw } = await run(async (router) => {
      await go(router, 'n', { num: 'x' });
    });

    expect(raw).toHaveLength(1);
    expect(raw[0]).toMatchObject({
      outcome: 'invalid',
      invalidParams: ['num'],
      message:
        "The following parameter values are not valid for state 'n': [num:null]",
    });
    expect(raw[0]?.message).not.toContain('Transition Rejection');
  });

  it('record a redirect to an abstract state as invalid', async () => {
    const { raw } = await run(async (router) => {
      await go(router, 'toAbstract');
    });

    expect(raw.map(({ outcome }) => outcome)).toEqual([
      'redirected',
      'invalid',
    ]);
    expect(raw[1]).toMatchObject({
      message: "Cannot transition to abstract state 'abstract'",
    });
    expect(raw[1]).not.toHaveProperty('invalidParams');
  });

  it('name the transition that superseded one, not an ignored one started before it', async () => {
    const { transitions, raw } = await run(async (router) => {
      const slow = go(router, 'slow');
      // Same as the pending transition, so core ignores it without aborting the pending one.
      void go(router, 'slow');
      await go(router, 'a');
      await slow;
    });

    const [slow, ignored, a] = transitions.map(({ id }) => id);
    const byId = new Map(raw.map((result) => [result.id, result]));
    expect(byId.get(ignored)?.outcome).toBe('ignored');
    expect(byId.get(slow)).toMatchObject({ outcome: 'superseded', by: a });
  });

  it('name no superseder once the superseded transition has left the window', async () => {
    let release = () => {};

    const held = new Promise<void>((resolve) => (release = resolve));

    const { transitions, raw } = await run(async (router) => {
      router.stateRegistry.register({ name: 'held', url: '/held' });
      router.transitionService.onStart({ to: 'held' }, () => held);
      const pending = go(router, 'held');
      await sleep(1);

      // More transitions than the window keeps begin before the held one notices.
      for (let i = 0; i < 257; i++) await go(router, i % 2 ? 'a' : 'b');
      release();
      await pending;
    });

    const result = raw.find((r) => r.id === transitions[0]?.id);
    expect(result).toMatchObject({ outcome: 'superseded' });
    expect(result).not.toHaveProperty('by');
  });

  it('name the successor of a redirect', async () => {
    const { transitions, raw } = await run(async (router) => {
      await go(router, 'r');
    });

    const [origin, successor] = transitions.map(({ id }) => id);
    expect(raw.find((result) => result.id === origin)).toMatchObject({
      outcome: 'redirected',
      by: successor,
    });
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

describe('messages', () => {
  it('read the message from an error, a string or a rejection', () => {
    expect(messageOf(new Error('e'))).toBe('e');
    expect(messageOf(Rejection.errored('s'))).toBe('s');
    expect(messageOf(Rejection.aborted())).toBe(
      'The transition has been aborted',
    );
    expect(messageOf(42)).toBe('42');
  });
});

describe('sequence numbers', () => {
  it('number every event from 1 without a gap', async () => {
    const router = new UIRouter();
    router.plugin(servicesPlugin);
    router.plugin(memoryLocationPlugin);
    router.stateRegistry.register({ name: 'a', url: '/a' });
    const events: RouterEvent[] = [];
    const stop = observe(router, (event) => events.push(event));
    await router.stateService.go('a');
    await router.stateService.go('typo').catch(() => {});
    stop();
    router.dispose();

    expect(events.map(({ seq }) => seq)).toEqual(
      events.map((_, index) => index + 1),
    );
  });
});
