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
  type LazyLoadResult,
  type StateDeclaration,
} from '@uirouter/core';

import { observe } from '@repo/router-events';
import type { RouterEvent } from '@repo/router-events/schema';

import {
  DevtoolsSpanProcessor,
  OtelPlugin,
  type OtelPluginOptions,
  type SpanRecord,
} from '../index.ts';
import { activateLazyLoadSpans } from '../lazy-load-context.ts';
import { reportToTracer } from '../reporter.ts';

const routers: UIRouter[] = [];

afterEach(() => {
  routers.splice(0).forEach((router) => router.dispose());
  context.disable();
});

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// A future state whose lazy load fetches its code and registers the states it stood for.
const lazyStates = (
  tracer: () => Tracer,
  load: () => Promise<void> = () => sleep(2),
): StateDeclaration[] => [
  { name: 'home', url: '/home' },
  {
    name: 'users.**',
    url: '/users',
    lazyLoad: async (): Promise<LazyLoadResult> => {
      tracer().startSpan('GET before await').end();
      await load();
      tracer().startSpan('GET after await').end();

      return {
        states: [
          {
            name: 'users',
            url: '/users',
            onEnter: () => {
              tracer().startSpan('users onEnter').end();
            },
          },
        ],
      };
    },
  },
];

const setup = (
  manager: ContextManager | null,
  options: Omit<OtelPluginOptions, 'tracer'>,
  states: (tracer: () => Tracer) => StateDeclaration[] = lazyStates,
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

const lazyLoadOf = (router: UIRouter, name: string) =>
  router.stateRegistry.get(name)?.$$state?.().lazyLoad;

describe('activateLazyLoadSpans', () => {
  it('runs the lazy load with its own span active for the whole load under a context manager that follows async work', async () => {
    const { router, plugin, spans } = setup(
      new AsyncLocalStorageContextManager(),
      { activateLazyLoadSpans: true, activateHookSpans: true },
    );

    plugin();

    const landed = await router.stateService.go('users');

    const all = await spans();
    const load = named(all, 'lazy load users.**');

    expect(landed.name).toBe('users');
    expect(load.attributes).toEqual({ 'uirouter.state': 'users.**' });
    expect(load.status.code).toBe(0);
    // The transition that ran the load is the one the retry redirected.
    expect(parentOf(load)).toBe(idOf(named(all, 'users.**')));
    expect(named(all, 'users.**').attributes['uirouter.outcome']).toBe(
      'redirected',
    );
    expect(parentOf(named(all, 'GET before await'))).toBe(idOf(load));
    expect(parentOf(named(all, 'GET after await'))).toBe(idOf(load));
    // A state the load registered has its own hooks covered too.
    expect(parentOf(named(all, 'users onEnter'))).toBe(
      idOf(named(all, 'enter users')),
    );
  });

  it('covers only the work before the first await under a context manager that tracks synchronous code', async () => {
    const { router, plugin, spans } = setup(new StackContextManager(), {
      activateLazyLoadSpans: true,
    });

    plugin();
    await router.stateService.go('users');

    const all = await spans();

    expect(parentOf(named(all, 'GET before await'))).toBe(
      idOf(named(all, 'lazy load users.**')),
    );
    expect(parentOf(named(all, 'GET after await'))).toBeUndefined();
  });

  it('parents nothing with no context manager installed', async () => {
    const { router, plugin, spans } = setup(null, {
      activateLazyLoadSpans: true,
    });

    plugin();
    await router.stateService.go('users');

    const all = await spans();

    expect(named(all, 'lazy load users.**')).toBeTruthy();
    expect(parentOf(named(all, 'GET before await'))).toBeUndefined();
  });

  it('adds no span and parents nothing when it is off, hook spans or not', async () => {
    const { router, plugin, spans } = setup(
      new AsyncLocalStorageContextManager(),
      { activateHookSpans: true },
    );

    plugin();
    await router.stateService.go('users');

    const all = await spans();

    expect(all.some((span) => span.name.startsWith('lazy load'))).toBe(false);
    expect(parentOf(named(all, 'GET before await'))).toBeUndefined();
  });

  it('fails the span when the load rejects, and runs the load again on the next try', async () => {
    let fail = true;

    const { router, plugin, spans } = setup(
      new StackContextManager(),
      { activateLazyLoadSpans: true },
      (tracer) =>
        lazyStates(tracer, () =>
          fail ? Promise.reject(new TypeError('offline')) : sleep(1),
        ),
    );

    plugin();

    await expect(router.stateService.go('users')).rejects.toMatchObject({
      detail: new TypeError('offline'),
    });
    fail = false;

    const second = await router.stateService.go('users');

    const loads = (await spans()).filter(
      (span) => span.name === 'lazy load users.**',
    );

    expect(second.name).toBe('users');
    expect(loads.map((span) => span.status)).toEqual([
      { code: 2, message: 'offline' },
      { code: 0 },
    ]);
    expect(loads[0].attributes['error.type']).toBe('TypeError');
  });

  it('spans a load once when a second transition awaits the load the first started', async () => {
    let calls = 0;

    const { router, plugin, spans } = setup(
      new StackContextManager(),
      { activateLazyLoadSpans: true },
      (tracer) =>
        lazyStates(tracer, async () => {
          calls += 1;
          await sleep(5);
        }),
    );

    plugin();

    const first = router.stateService.go('users').catch(() => null);

    await sleep(1);

    const landed = await router.stateService.go('users', {}, { reload: true });

    await first;

    const all = await spans();

    expect(landed.name).toBe('users');
    expect(calls).toBe(1);
    expect(
      all.filter((span) => span.name === 'lazy load users.**'),
    ).toHaveLength(1);
  });

  it('restores a state’s lazy load on dispose', async () => {
    const { router, plugin } = setup(
      new StackContextManager(),
      {
        activateLazyLoadSpans: true,
      },
      () => [
        { name: 'fails', lazyLoad: () => Promise.reject(new Error('no')) },
      ],
    );

    const declared = router.stateRegistry.get('fails')?.lazyLoad;
    const otel = plugin();

    await router.stateService.go('fails').catch(() => null);

    // A failed load leaves the wrapper in place for the next try.
    expect(lazyLoadOf(router, 'fails')).not.toBe(declared);
    otel.dispose();
    expect(lazyLoadOf(router, 'fails')).toBe(declared);
  });

  it('keeps the wrapper of a load in flight at dispose, passing it through', async () => {
    const { router, plugin } = setup(new StackContextManager(), {
      activateLazyLoadSpans: true,
    });

    const declared = lazyLoadOf(router, 'users.**');
    const otel = plugin();
    const loading = router.stateService.go('users').catch(() => null);
    const wrapper = lazyLoadOf(router, 'users.**');

    expect(wrapper).not.toBe(declared);
    otel.dispose();
    expect(lazyLoadOf(router, 'users.**')).toBe(wrapper);
    expect(await loading).toMatchObject({ name: 'users' });
  });

  it('runs the load as it is when the reporter has no transition for it', async () => {
    const { router, tracer, spans } = setup(new StackContextManager(), {});

    // No adapter feeds this reporter, so it knows no transition to parent a lazy load span to.
    const reporter = reportToTracer(tracer);

    activateLazyLoadSpans(router, reporter);
    await router.stateService.go('users');

    const all = await spans();

    expect(reporter.startLazyLoad(0, 'users.**')).toBeUndefined();
    expect(all.map((span) => span.name).sort()).toEqual([
      'GET after await',
      'GET before await',
      'users onEnter',
    ]);
  });

  // The devtools recorder observes the same router through this adapter; either may attach first.
  it.each(['before', 'after'] as const)(
    'works beside the devtools recorder attached %s it',
    async (order) => {
      const { router, plugin, spans } = setup(new StackContextManager(), {
        activateLazyLoadSpans: true,
        activateHookSpans: true,
        activateResolveSpans: true,
      });

      const events: RouterEvent[] = [];
      const record = () => observe(router, (event) => events.push(event));

      if (order === 'before') record();

      plugin();

      if (order === 'after') record();

      await router.stateService.go('users');

      const all = await spans();

      expect(parentOf(named(all, 'GET before await'))).toBe(
        idOf(named(all, 'lazy load users.**')),
      );
      expect(
        events.flatMap((event) =>
          event.type === 'result' ? [event.outcome] : [],
        ),
      ).toEqual(['redirected', 'success']);
    },
  );

  it('sends the devtools panel an app span whose parent is the lazy load span of the transition', async () => {
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

    for (const state of lazyStates(() => tracer))
      router.stateRegistry.register(state);
    router.plugin(OtelPlugin, { tracer, activateLazyLoadSpans: true });
    await router.stateService.go('users');
    await sleep(1);

    const ended = records.filter((record) => record.endTime !== undefined);
    const find = (name: string) => ended.find((record) => record.name === name);
    const transition = find('users.**');
    const load = find('lazy load users.**');

    // The shape the Timeline joins as `child`: a router transition span, a router span under it, an app span under that.
    expect(transition?.attributes?.['uirouter.transition_id']).toBe(0);
    expect(load?.parentSpanId).toBe(transition?.spanId);
    expect(load?.attributes?.['uirouter.state']).toBe('users.**');
    expect(find('GET before await')?.parentSpanId).toBe(load?.spanId);
  });
});
