import { describe, expect, it } from 'vitest';
import {
  memoryLocationPlugin,
  Rejection,
  servicesPlugin,
  UIRouter,
  type StateDeclaration,
} from '@uirouter/core';

import { observe, type DevtoolsEvent } from '../index.ts';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const makeRouter = (states: StateDeclaration[]): UIRouter => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => {});

  for (const state of states) router.stateRegistry.register(state);

  return router;
};

describe('onInvalid', () => {
  type Placement = 'none' | 'first' | 'last';

  const run = async (placement: Placement) => {
    const router = makeRouter([{ name: 'a', url: '/a' }]);
    const seen: string[] = [];
    const events: DevtoolsEvent[] = [];
    const install = () => observe(router, (event) => events.push(event));

    if (placement === 'first') install();
    router.stateService.onInvalid((to) => {
      seen.push(`app1 ${to?.name()}`);

      return to?.name() === 'old' ? router.stateService.target('a') : undefined;
    });
    router.stateService.onInvalid((to) => {
      seen.push(`app2 ${to?.name()}`);
    });

    if (placement === 'last') install();

    const outcome = async (name: string) => {
      try {
        await router.stateService.go(name);

        return `ok ${router.globals.current.name}`;
      } catch (error) {
        return error instanceof Rejection
          ? `rejected ${error.type}`
          : 'rejected';
      }
    };

    const results = [await outcome('old'), await outcome('typo')];
    router.dispose();

    return {
      results,
      seen,
      invalid: events.flatMap((event) =>
        event.type === 'invalid' ? [event.to] : [],
      ),
    };
  };

  it('leaves the app handlers and the outcomes unchanged', async () => {
    const without = await run('none');
    const first = await run('first');
    const last = await run('last');
    expect(without.results).toEqual(['ok a', 'rejected 4']);
    expect(first.results).toEqual(without.results);
    expect(last.results).toEqual(without.results);
    expect(first.seen).toEqual(without.seen);
    expect(last.seen).toEqual(without.seen);
  });

  it('records a row for each invalid target it sees', async () => {
    // Callbacks run in registration order, so a later rescue still leaves a row.
    expect((await run('first')).invalid).toEqual(['old', 'typo']);
    expect((await run('last')).invalid).toEqual(['typo']);
  });
});

describe('phase brackets', () => {
  it('open before and close after the hooks core runs at the default priority', async () => {
    const log: string[] = [];

    const router = makeRouter([
      {
        name: 'a',
        url: '/a',
        onEnter: () => {
          log.push('core enter a');
        },
      },
    ]);

    router.transitionService.onStart({}, () => {
      log.push('core start');
    });
    router.transitionService.onSuccess({}, () => {
      log.push('core success');
    });

    const stop = observe(router, (event) => {
      if (event.type === 'phase' && event.phase !== 'finish')
        log.push(
          `${event.phase}:${event.edge}${event.state ? ` ${event.state}` : ''}`,
        );
    });

    await router.stateService.go('a');
    stop();
    router.dispose();
    expect(log).toEqual([
      'before:start',
      'before:end',
      'start:start',
      'core start',
      'start:end',
      'enter:start a',
      'core enter a',
      'enter:end a',
      'success:start',
      'core success',
      'success:end',
    ]);
  });
});

describe('resolve timing', () => {
  const states = (calls: string[]): StateDeclaration[] => [
    {
      name: 'a',
      url: '/a',
      resolve: [
        {
          token: 'A',
          resolveFn: async () => {
            calls.push('A');
            await sleep(5);

            return 'A';
          },
        },
      ],
    },
    {
      name: 'a.b',
      url: '/b',
      resolve: [
        {
          token: 'B',
          deps: ['A'],
          resolveFn: (a: string) => {
            calls.push(`B after ${a}`);

            return Promise.resolve('B');
          },
        },
      ],
    },
  ];

  const run = async (timeResolves: boolean | undefined) => {
    const calls: string[] = [];
    const router = makeRouter(states(calls));
    const events: DevtoolsEvent[] = [];

    const stop = observe(router, (event) => events.push(event), {
      timeResolves,
    });

    await router.stateService.go('a.b');
    stop();
    router.dispose();

    return {
      calls,
      resolves: events.flatMap((event) =>
        event.type === 'resolve' ? [event] : [],
      ),
    };
  };

  it('is off by default', async () => {
    const { calls, resolves } = await run(undefined);
    expect(calls).toEqual(['A', 'B after A']);
    expect(resolves).toEqual([]);
  });

  it('times each resolve without changing when it runs', async () => {
    const { calls, resolves } = await run(true);
    expect(calls).toEqual(['A', 'B after A']);
    expect(
      resolves.map(({ token, state, ok, cached }) => ({
        token,
        state,
        ok,
        cached,
      })),
    ).toEqual([
      { token: 'A', state: 'a', ok: true, cached: false },
      { token: 'B', state: 'a.b', ok: true, cached: false },
    ]);

    for (const resolve of resolves)
      expect(resolve.end).toBeGreaterThanOrEqual(resolve.start);
  });
});
