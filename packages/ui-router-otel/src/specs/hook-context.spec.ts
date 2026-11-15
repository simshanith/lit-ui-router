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
  RejectType,
  servicesPlugin,
  UIRouter,
  type StateDeclaration,
  type Transition,
} from '@uirouter/core';

import { observe } from '@repo/router-events';
import type { RouterEvent } from '@repo/router-events/schema';

import {
  DevtoolsSpanProcessor,
  OtelPlugin,
  type OtelPluginOptions,
  type SpanRecord,
} from '../index.ts';
import { activateHookSpans } from '../hook-context.ts';
import { reportToTracer } from '../reporter.ts';

const routers: UIRouter[] = [];

afterEach(() => {
  routers.splice(0).forEach((router) => router.dispose());
  context.disable();
});

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

type Work = (label: string) => Promise<void>;

// An app hook's work: one span before its first await and one after, as a fetch would.
const working =
  (tracer: () => Tracer): Work =>
  async (label) => {
    tracer().startSpan(`${label} before await`).end();
    await sleep(1);
    tracer().startSpan(`${label} after await`).end();
  };

// `app` is retained, `app.home` exited and `app.other` entered on the way from one to the other.
const states = (work: Work): StateDeclaration[] => [
  { name: 'app', url: '/app', onRetain: () => work('state onRetain') },
  { name: 'app.home', url: '/home', onExit: () => work('state onExit') },
  { name: 'app.other', url: '/other', onEnter: () => work('state onEnter') },
];

const setup = (
  manager: ContextManager | null,
  options: Omit<OtelPluginOptions, 'tracer'>,
  declare: (work: Work) => StateDeclaration[] = states,
) => {
  if (manager) context.setGlobalContextManager(manager.enable());

  const exporter = new InMemorySpanExporter();

  const provider = new TracerProvider({
    spanProcessors: [new SimpleSpanProcessor({ exporter })],
  });

  const tracer = provider.getTracer('spec');
  const router = new UIRouter();
  const work = working(() => tracer);

  routers.push(router);
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => {});

  for (const state of declare(work)) router.stateRegistry.register(state);

  return {
    router,
    tracer,
    work,
    plugin: () => router.plugin(OtelPlugin, { tracer, ...options }),
    spans: async () => {
      // An onSuccess hook's work outlives the transition, which does not wait for it.
      await sleep(5);
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

const parentName = (
  spans: ReadableSpan[],
  name: string,
): string | undefined => {
  const parent = parentOf(named(spans, name));

  return spans.find((span) => idOf(span) === parent)?.name;
};

// Registers one transition-service hook of each kind that runs in the app.home -> app.other transition.
const registerHooks = (router: UIRouter, work: Work) => {
  const service = router.transitionService;

  service.onBefore({ to: 'app.other' }, () => work('onBefore'));
  service.onStart({ to: 'app.other' }, () => work('onStart'));
  service.onExit({ exiting: 'app.home' }, () => work('onExit'));
  service.onRetain({ retained: 'app' }, () => work('onRetain'));
  service.onEnter({ entering: 'app.other' }, () => work('onEnter'));
  service.onFinish({ to: 'app.other' }, () => work('onFinish'));
  service.onSuccess({ to: 'app.other' }, () => void work('onSuccess'));
};

// Each hook and the phase span it runs in.
const PHASE_OF = [
  ['onBefore', 'before'],
  ['onStart', 'start'],
  ['onExit', 'exit app.home'],
  ['onRetain', 'retain app'],
  ['onEnter', 'enter app.other'],
  ['onFinish', 'finish'],
  ['onSuccess', 'success'],
  ['state onExit', 'exit app.home'],
  ['state onRetain', 'retain app'],
  ['state onEnter', 'enter app.other'],
] as const;

const travel = async (router: UIRouter) => {
  await router.stateService.go('app.home');
  await router.stateService.go('app.other');
};

describe('activateHookSpans', () => {
  it('runs each app hook with its phase span active for the whole hook under a context manager that follows async work', async () => {
    const { router, work, plugin, spans } = setup(
      new AsyncLocalStorageContextManager(),
      { activateHookSpans: true },
    );

    // Hooks registered before the plugin and after it are both covered.
    router.transitionService.onBefore({ to: 'app.other' }, () =>
      work('early onBefore'),
    );
    plugin();
    registerHooks(router, work);
    await travel(router);

    const all = await spans();

    for (const [hook, phase] of [
      ...PHASE_OF,
      ['early onBefore', 'before'] as const,
    ]) {
      expect(parentName(all, `${hook} before await`), hook).toBe(phase);
      expect(parentName(all, `${hook} after await`), hook).toBe(phase);
    }

    // The phase spans keep their own parent and attributes.
    expect(parentName(all, 'enter app.other')).toBe('app.other');
    expect(named(all, 'enter app.other').attributes).toEqual({
      'uirouter.phase': 'enter',
      'uirouter.state': 'app.other',
    });
  });

  it('covers only the work before the first await under a context manager that tracks synchronous code', async () => {
    const { router, work, plugin, spans } = setup(new StackContextManager(), {
      activateHookSpans: true,
    });

    plugin();
    registerHooks(router, work);
    await travel(router);

    const all = await spans();

    for (const [hook, phase] of PHASE_OF) {
      expect(parentName(all, `${hook} before await`), hook).toBe(phase);
      expect(parentOf(named(all, `${hook} after await`)), hook).toBeUndefined();
    }
  });

  it('parents nothing with no context manager installed', async () => {
    const { router, work, plugin, spans } = setup(null, {
      activateHookSpans: true,
    });

    plugin();
    registerHooks(router, work);
    await travel(router);

    const all = await spans();

    for (const [hook] of PHASE_OF)
      expect(
        parentOf(named(all, `${hook} before await`)),
        hook,
      ).toBeUndefined();
  });

  it('leaves every app span outside the router’s when it is off', async () => {
    const { router, work, plugin, spans } = setup(
      new AsyncLocalStorageContextManager(),
      {},
    );

    plugin();
    registerHooks(router, work);
    await travel(router);

    const all = await spans();

    for (const [hook] of PHASE_OF)
      expect(
        parentOf(named(all, `${hook} before await`)),
        hook,
      ).toBeUndefined();
  });

  it('covers a hook the app registers on the transition itself, and an onError hook', async () => {
    const { router, tracer, work, plugin, spans } = setup(
      new StackContextManager(),
      { activateHookSpans: true },
    );

    plugin();
    router.transitionService.onStart({ to: 'app.home' }, (trans) => {
      trans.onSuccess({}, () => void work('own onSuccess'));
    });
    router.transitionService.onEnter({ entering: 'app.other' }, () => {
      throw new TypeError('no other');
    });
    router.transitionService.onError({}, () => {
      tracer.startSpan('onError').end();
    });
    await travel(router).catch(() => {});

    const all = await spans();

    expect(parentName(all, 'own onSuccess before await')).toBe('success');
    expect(parentName(all, 'onError')).toBe('error');
  });

  it('passes return values, this and errors through untouched', async () => {
    const { router, plugin, spans } = setup(
      new StackContextManager(),
      { activateHookSpans: true },
      (work) => [
        ...states(work),
        { name: 'redirects' },
        { name: 'aborts' },
        {
          name: 'rejects',
          onEnter: () => Promise.reject(new RangeError('no')),
        },
        { name: 'throws' },
      ],
    );

    plugin();

    const service = router.transitionService;
    const bind = { label: 'bound' };
    let bound = false;

    service.onStart(
      { to: 'redirects' },
      function (this: typeof bind, trans: Transition) {
        bound = this === bind;

        return trans.router.stateService.target('app.home');
      },
      { bind },
    );
    service.onBefore({ to: 'aborts' }, () => false);
    service.onStart({ to: 'throws' }, () => {
      throw new SyntaxError('thrown');
    });

    const redirected = await router.stateService.go('redirects');

    expect(redirected.name).toBe('app.home');
    expect(bound).toBe(true);
    await expect(router.stateService.go('aborts')).rejects.toMatchObject({
      type: RejectType.ABORTED,
    });
    await expect(router.stateService.go('rejects')).rejects.toMatchObject({
      type: RejectType.ERROR,
      detail: new RangeError('no'),
    });
    await expect(router.stateService.go('throws')).rejects.toMatchObject({
      type: RejectType.ERROR,
      detail: new SyntaxError('thrown'),
    });

    const outcomes = Object.fromEntries(
      (await spans())
        .filter(
          (span) => span.attributes['uirouter.transition_id'] !== undefined,
        )
        .map((span) => [span.name, span.attributes['uirouter.outcome']]),
    );

    expect(outcomes).toMatchObject({
      redirects: 'redirected',
      aborts: 'aborted',
      rejects: 'error',
      throws: 'error',
    });
  });

  it('leaves core’s own hooks unwrapped: a resolve and a redirectTo run outside the phase span', async () => {
    const { router, plugin, spans } = setup(
      new StackContextManager(),
      { activateHookSpans: true },
      (work) => [
        {
          name: 'resolves',
          resolve: [{ token: 'data', resolveFn: () => work('resolve') }],
          onEnter: () => work('state onEnter'),
        },
        {
          name: 'redirectsTo',
          redirectTo: () => {
            void work('redirectTo');

            return 'resolves';
          },
        },
      ],
    );

    plugin();
    await router.stateService.go('redirectsTo');

    const all = await spans();

    expect(parentName(all, 'state onEnter before await')).toBe(
      'enter resolves',
    );
    expect(parentOf(named(all, 'resolve before await'))).toBeUndefined();
    expect(parentOf(named(all, 'redirectTo before await'))).toBeUndefined();
  });

  it('emits the same spans as when it is off, when no hook starts one', async () => {
    const reported = async (options: Omit<OtelPluginOptions, 'tracer'>) => {
      const { router, plugin, spans } = setup(
        new StackContextManager(),
        options,
        () => [
          { name: 'app', url: '/app', onRetain: () => {} },
          { name: 'app.home', url: '/home', onExit: () => {} },
          { name: 'app.other', url: '/other', onEnter: () => {} },
          { name: 'redirects', redirectTo: 'app.home' },
          { name: 'fails', onEnter: () => Promise.reject(new Error('no')) },
          { name: 'slow', onEnter: () => sleep(5) },
        ],
      );

      plugin();
      router.transitionService.onStart({}, () => undefined);
      router.transitionService.onBefore({ to: 'redirects' }, () => undefined);

      const go = (name: string) => router.stateService.go(name).catch(() => {});

      await go('app.home');
      await go('app.other');
      await go('redirects');
      await go('fails');

      const slow = go('slow');

      await go('app.other');
      await slow;

      const all = await spans();

      const nameOf = (id: string | undefined) =>
        all.find((span) => idOf(span) === id)?.name;

      return all.map((span) => ({
        name: span.name,
        parent: nameOf(parentOf(span)),
        kind: span.kind,
        attributes: span.attributes,
        status: span.status,
        links: span.links.length,
        events: span.events.map((event) => event.name),
      }));
    };

    const off = await reported({});

    expect(off.length).toBeGreaterThan(20);
    expect(await reported({ activateHookSpans: true })).toEqual(off);
  });

  it('reports a transition core ignores once an app onBefore hook ran in it, so the hook’s spans keep their parent', async () => {
    const { router, work, plugin, spans } = setup(new StackContextManager(), {
      activateHookSpans: true,
    });

    plugin();
    await router.stateService.go('app.home');
    router.transitionService.onBefore({}, () => work('every onBefore'));
    await router.stateService.go('app.home').catch(() => {});

    const all = await spans();

    const ignored = all.filter(
      (span) => span.attributes['uirouter.outcome'] === 'ignored',
    );

    expect(ignored).toHaveLength(1);
    expect(parentName(all, 'every onBefore before await')).toBe('before');
  });

  it('restores each hook on dispose', async () => {
    const { router, work, plugin, spans } = setup(new StackContextManager(), {
      activateHookSpans: true,
    });

    const hook = () => work('onStart');

    router.transitionService.onStart({}, hook);

    const otel = plugin();

    expect(
      router.transitionService
        .getHooks('onStart')
        .some((each) => each.callback === hook),
    ).toBe(false);

    otel.dispose();

    expect(
      router.transitionService
        .getHooks('onStart')
        .some((each) => each.callback === hook),
    ).toBe(true);

    await router.stateService.go('app.home');

    expect(
      parentOf(named(await spans(), 'onStart before await')),
    ).toBeUndefined();
  });

  it('runs hooks as they are when the reporter has no transition for them, or core’s registration is not found', async () => {
    const { router, tracer, work, spans } = setup(
      new StackContextManager(),
      {},
    );

    const reporter = reportToTracer(tracer);

    router.transitionService.onStart({}, () => work('onStart'));
    activateHookSpans(router, reporter);

    const other = new UIRouter();

    routers.push(other);
    Object.defineProperty(
      other.transitionService,
      '_registerCoreTransitionHooks',
      { value: undefined },
    );
    activateHookSpans(other, reporter)();
    await router.stateService.go('app.home');

    expect(reporter.phaseSpan(0, 'start')).toBeUndefined();
    expect(
      parentOf(named(await spans(), 'onStart before await')),
    ).toBeUndefined();
  });

  it('leaves a hook at the adapter’s own priority as it is', async () => {
    const { router, work, plugin, spans } = setup(new StackContextManager(), {
      activateHookSpans: true,
    });

    plugin();
    router.transitionService.onEnter(
      { entering: 'app.home' },
      () => work('instrumentation'),
      { priority: Number.MAX_SAFE_INTEGER },
    );
    await router.stateService.go('app.home');

    expect(
      parentOf(named(await spans(), 'instrumentation before await')),
    ).toBeUndefined();
  });

  // The devtools recorder observes the same router through this adapter; either may attach first.
  it.each(['before', 'after'] as const)(
    'works beside the devtools recorder attached %s it',
    async (order) => {
      const { router, work, plugin, spans } = setup(new StackContextManager(), {
        activateHookSpans: true,
        activateResolveSpans: true,
      });

      const events: RouterEvent[] = [];
      const record = () => observe(router, (event) => events.push(event));

      if (order === 'before') record();

      plugin();

      if (order === 'after') record();

      registerHooks(router, work);
      await travel(router);

      const all = await spans();

      for (const [hook, phase] of PHASE_OF)
        expect(parentName(all, `${hook} before await`), hook).toBe(phase);

      // app and app.home, then app.other: each state's start and end edge.
      expect(
        events.filter(
          (event) => event.type === 'phase' && event.phase === 'enter',
        ),
      ).toHaveLength(6);
    },
  );

  it('sends the devtools panel an app span whose parent is a phase span of the transition', async () => {
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
    router.stateRegistry.register({
      name: 'users',
      onEnter: () => {
        tracer.startSpan('GET users').end();
      },
    });
    router.plugin(OtelPlugin, { tracer, activateHookSpans: true });
    await router.stateService.go('users');

    const ended = records.filter((record) => record.endTime !== undefined);
    const find = (name: string) => ended.find((record) => record.name === name);
    const transition = find('users');
    const phase = find('enter users');

    // The shape the Timeline joins as `child`: a router transition span, a phase span under it, an app span under that.
    expect(transition?.attributes?.['uirouter.transition_id']).toBe(0);
    expect(phase?.parentSpanId).toBe(transition?.spanId);
    expect(phase?.attributes?.['uirouter.phase']).toBe('enter');
    expect(find('GET users')?.parentSpanId).toBe(phase?.spanId);
  });
});
