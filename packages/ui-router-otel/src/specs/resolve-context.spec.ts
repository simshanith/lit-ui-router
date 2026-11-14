import { afterEach, describe, expect, it } from 'vitest';
import { context, type ContextManager, type Tracer } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  StackContextManager,
  TracerProvider,
  type ReadableSpan,
} from '@opentelemetry/sdk-trace';
import {
  memoryLocationPlugin,
  servicesPlugin,
  UIRouter,
  type StateDeclaration,
} from '@uirouter/core';

import { observe } from '@repo/router-events';
import type { ResolveEvent, RouterEvent } from '@repo/router-events/schema';

import {
  DevtoolsSpanProcessor,
  OtelPlugin,
  type OtelPluginOptions,
  type SpanRecord,
} from '../index.ts';
import { reportToTracer } from '../reporter.ts';
import { activateResolveSpans } from '../resolve-context.ts';

const routers: UIRouter[] = [];

afterEach(() => {
  routers.splice(0).forEach((router) => router.dispose());
  context.disable();
});

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// A resolve that starts one span before its first await and one after, as an app's fetch would.
const fetching = (tracer: () => Tracer): StateDeclaration[] => [
  {
    name: 'users',
    url: '/users',
    resolve: [
      {
        token: 'users',
        resolveFn: async () => {
          tracer().startSpan('GET before await').end();
          await sleep(2);
          tracer().startSpan('GET after await').end();

          return ['ada'];
        },
      },
    ],
  },
  { name: 'users.user', url: '/:id' },
];

const setup = (
  manager: ContextManager | null,
  options: Omit<OtelPluginOptions, 'tracer'>,
  states: (tracer: () => Tracer) => StateDeclaration[] = fetching,
) => {
  if (manager) context.setGlobalContextManager(manager.enable());

  const exporter = new InMemorySpanExporter();

  const provider = new TracerProvider({
    spanProcessors: [new SimpleSpanProcessor({ exporter })],
  });

  const tracer = provider.getTracer('spec');
  const router = new UIRouter();

  routers.push(router);
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => {});

  for (const state of states(() => tracer))
    router.stateRegistry.register(state);

  return {
    router,
    tracer,
    plugin: () => router.plugin(OtelPlugin, { tracer, ...options }),
    spans: async () => {
      await provider.forceFlush();

      return exporter.getFinishedSpans();
    },
  };
};

const named = (spans: ReadableSpan[], name: string): ReadableSpan => {
  const span = spans.find((each) => each.name === name);

  if (!span) throw new Error(`no span named ${name}`);

  return span;
};

const parentOf = (span: ReadableSpan): string | undefined =>
  span.parentSpanContext?.spanId;

const idOf = (span: ReadableSpan): string => span.spanContext().spanId;

describe('activateResolveSpans', () => {
  it('makes a span the app starts before its first await a child of the resolve span, with no async context manager', async () => {
    const { router, plugin, spans } = setup(new StackContextManager(), {
      activateResolveSpans: true,
    });

    plugin();
    await router.stateService.go('users');

    const all = await spans();
    const resolve = named(all, 'resolve users');

    expect(parentOf(resolve)).toBe(idOf(named(all, 'users')));
    expect(parentOf(named(all, 'GET before await'))).toBe(idOf(resolve));
    // The stack manager restores the outer context when the resolve's function returns its promise.
    expect(parentOf(named(all, 'GET after await'))).toBeUndefined();
  });

  it('makes no span a child with no context manager installed, since the API default keeps no context', async () => {
    const { router, plugin, spans } = setup(null, {
      activateResolveSpans: true,
    });

    plugin();
    await router.stateService.go('users');

    const all = await spans();

    expect(named(all, 'resolve users')).toBeTruthy();
    expect(parentOf(named(all, 'GET before await'))).toBeUndefined();
  });

  it('keeps the resolve span active past an await under a context manager that follows async work', async () => {
    const { router, plugin, spans } = setup(
      new AsyncLocalStorageContextManager(),
      { activateResolveSpans: true },
    );

    plugin();
    await router.stateService.go('users');

    const all = await spans();
    const resolve = idOf(named(all, 'resolve users'));

    expect(parentOf(named(all, 'GET before await'))).toBe(resolve);
    expect(parentOf(named(all, 'GET after await'))).toBe(resolve);
  });

  it('leaves every app span outside the router’s when it is off, whatever the context manager', async () => {
    const { router, plugin, spans } = setup(
      new AsyncLocalStorageContextManager(),
      { timeResolves: true },
    );

    plugin();
    await router.stateService.go('users');

    const all = await spans();

    expect(parentOf(named(all, 'GET before await'))).toBeUndefined();
    expect(parentOf(named(all, 'GET after await'))).toBeUndefined();
  });

  it('spans each resolve once, with timeResolves on too and for a retained state', async () => {
    const { router, plugin, spans } = setup(new StackContextManager(), {
      activateResolveSpans: true,
      timeResolves: true,
    });

    plugin();
    await router.stateService.go('users');
    await router.stateService.go('users.user', { id: '1' });

    const all = await spans();

    expect(all.filter((span) => span.name === 'resolve users')).toHaveLength(1);
    expect(named(all, 'resolve users').attributes).toEqual({
      'uirouter.resolve': 'users',
      'uirouter.state': 'users',
    });
  });

  it('fails the resolve span when the resolve rejects, and still rejects', async () => {
    const { router, plugin, spans } = setup(
      new StackContextManager(),
      { activateResolveSpans: true },
      () => [
        {
          name: 'broken',
          resolve: [
            {
              token: 'user',
              resolveFn: () => Promise.reject(new TypeError('no user')),
            },
          ],
        },
      ],
    );

    plugin();

    const result = await router.stateService.go('broken').then(
      () => 'resolved',
      () => 'rejected',
    );

    const resolve = named(await spans(), 'resolve user');

    expect(result).toBe('rejected');
    expect(resolve.status).toMatchObject({ code: 2, message: 'no user' });
    expect(resolve.attributes['error.type']).toBe('TypeError');
  });

  it('fails the resolve span with no error type of its own when the resolve throws or rejects with no Error', async () => {
    const { router, plugin, spans } = setup(
      new StackContextManager(),
      { activateResolveSpans: true },
      () => [
        {
          name: 'throws',
          resolve: [
            {
              token: 'user',
              resolveFn: () => {
                throw new RangeError('no such user');
              },
            },
          ],
        },
        {
          name: 'empty',
          // oxlint-disable-next-line prefer-promise-reject-errors -- an app may reject with nothing, which is the case under test
          resolve: [{ token: 'roles', resolveFn: () => Promise.reject() }],
        },
      ],
    );

    plugin();

    const thrown = await router.stateService.go('throws').then(
      () => 'resolved',
      () => 'rejected',
    );

    await router.stateService.go('empty').catch(() => {});

    const all = await spans();
    const user = named(all, 'resolve user');
    const roles = named(all, 'resolve roles');

    expect(thrown).toBe('rejected');
    expect(user.status).toMatchObject({ code: 2, message: 'no such user' });
    expect(user.attributes['error.type']).toBe('RangeError');
    expect(roles.status).toMatchObject({ code: 2, message: 'rejected' });
    expect(roles.attributes['error.type']).toBe('_OTHER');
  });

  it('runs resolves as they are when the reporter has no transition for them, and never spans one without a string token', async () => {
    const UsersToken = class {};

    const { router, tracer, spans } = setup(
      new StackContextManager(),
      {},
      (current) => [
        {
          name: 'users',
          resolve: [
            {
              token: UsersToken,
              resolveFn: () => {
                current().startSpan('GET by class token').end();

                return ['ada'];
              },
            },
            {
              token: 'roles',
              resolveFn: () => {
                current().startSpan('GET roles').end();

                return ['admin'];
              },
            },
          ],
        },
      ],
    );

    // No adapter feeds this reporter, so it knows no transition to parent a resolve span to.
    const reporter = reportToTracer(tracer);

    activateResolveSpans(router, reporter);

    let resolved: unknown[] = [];

    router.transitionService.onSuccess({}, (trans) => {
      resolved = [
        trans.injector().get(UsersToken),
        trans.injector().get('roles'),
      ];
    });
    await router.stateService.go('users');

    const all = await spans();

    expect(resolved).toEqual([['ada'], ['admin']]);
    expect(reporter.startResolve(0, 'roles', 'users')).toBeUndefined();
    expect(all.map((span) => span.name).sort()).toEqual([
      'GET by class token',
      'GET roles',
    ]);
    expect(all.map(parentOf)).toEqual([undefined, undefined]);
  });

  it('wraps a resolve once when it is activated twice for one reporter', async () => {
    const { router, tracer, spans } = setup(new StackContextManager(), {});
    const reporter = reportToTracer(tracer);
    const stop = observe(router, reporter.report);

    activateResolveSpans(router, reporter);
    activateResolveSpans(router, reporter);
    await router.stateService.go('users');
    stop();

    const all = await spans();

    expect(all.filter((span) => span.name === 'resolve users')).toHaveLength(1);
    expect(parentOf(named(all, 'GET before await'))).toBe(
      idOf(named(all, 'resolve users')),
    );
  });

  // The devtools recorder wraps resolveFn through this same adapter; either may wrap first.
  it.each(['before', 'after'] as const)(
    'works beside the adapter’s resolve timing installed %s it',
    async (order) => {
      const { router, plugin, spans } = setup(new StackContextManager(), {
        activateResolveSpans: true,
      });

      const events: RouterEvent[] = [];

      const time = () =>
        observe(router, (event) => events.push(event), { timeResolves: true });

      if (order === 'before') time();

      plugin();

      if (order === 'after') time();

      let users: unknown;

      router.transitionService.onSuccess({}, (trans) => {
        users = trans.injector().get('users');
      });
      await router.stateService.go('users');

      const all = await spans();

      const timed = events.filter(
        (event): event is ResolveEvent => event.type === 'resolve',
      );

      expect(users).toEqual(['ada']);
      expect(timed).toMatchObject([
        { token: 'users', ok: true, cached: false },
      ]);
      expect(timed[0].end - timed[0].start).toBeGreaterThanOrEqual(1);
      expect(all.filter((span) => span.name === 'resolve users')).toHaveLength(
        1,
      );
      expect(parentOf(named(all, 'GET before await'))).toBe(
        idOf(named(all, 'resolve users')),
      );
    },
  );

  it('sends the devtools panel a fetch whose parent is a resolve span of the transition', async () => {
    context.setGlobalContextManager(new StackContextManager().enable());

    const records: SpanRecord[] = [];

    const provider = new TracerProvider({
      spanProcessors: [
        new DevtoolsSpanProcessor(() => ({
          addSpan: (span) => void records.push(span),
        })),
      ],
    });

    const tracer = provider.getTracer('spec');
    const router = new UIRouter();

    routers.push(router);
    router.plugin(servicesPlugin);
    router.plugin(memoryLocationPlugin);

    for (const state of fetching(() => tracer))
      router.stateRegistry.register(state);
    router.plugin(OtelPlugin, { tracer, activateResolveSpans: true });
    await router.stateService.go('users');

    const ended = records.filter((record) => record.endTime !== undefined);
    const find = (name: string) => ended.find((record) => record.name === name);
    const transition = find('users');
    const resolve = find('resolve users');

    // The shape the Timeline joins as `child`: a router transition span, a router span under it, an app span under that.
    expect(transition?.attributes?.['uirouter.transition_id']).toBe(0);
    expect(resolve?.parentSpanId).toBe(transition?.spanId);
    expect(resolve?.attributes?.['uirouter.resolve']).toBe('users');
    expect(find('GET before await')?.parentSpanId).toBe(resolve?.spanId);
  });
});
