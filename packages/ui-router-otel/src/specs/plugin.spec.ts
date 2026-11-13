import { afterEach, describe, expect, it } from 'vitest';
import { context, SpanKind, SpanStatusCode } from '@opentelemetry/api';
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
  type RawParams,
  type StateDeclaration,
  type TransitionOptions,
} from '@uirouter/core';

import type {
  PhaseEvent,
  RouterEvent,
  TransitionEvent,
} from '@repo/router-events/schema';

import { OtelPlugin, type OtelPluginOptions } from '../index.ts';
import { reportToTracer } from '../reporter.ts';

type Options = Omit<OtelPluginOptions, 'tracer'>;

const routers: UIRouter[] = [];

afterEach(() => routers.splice(0).forEach((router) => router.dispose()));

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const setup = (states: StateDeclaration[], options: Options = {}) => {
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

  for (const state of states) router.stateRegistry.register(state);

  const go = async (
    name: string,
    params?: RawParams,
    transitionOptions?: TransitionOptions,
  ) => {
    await router.stateService
      .go(name, params, transitionOptions)
      .catch(() => {});
    await provider.forceFlush();
  };

  return {
    router,
    tracer,
    go,
    flush: () => provider.forceFlush(),
    plugin: () => router.plugin(OtelPlugin, { tracer, ...options }),
    spans: () => exporter.getFinishedSpans(),
  };
};

const named = (spans: ReadableSpan[], name: string): ReadableSpan => {
  const span = spans.find((s) => s.name === name);

  if (!span) throw new Error(`no span named ${name}`);

  return span;
};

const idOf = (span: ReadableSpan): string => span.spanContext().spanId;

const childrenOf = (spans: ReadableSpan[], parent: ReadableSpan): string[] =>
  spans.flatMap((s) =>
    s.parentSpanContext?.spanId === idOf(parent) ? [s.name] : [],
  );

const ms = ([seconds, nanos]: [number, number]): number =>
  seconds * 1e3 + nanos / 1e6;

const clock = (): number => performance.timeOrigin + performance.now();

describe('a successful transition', () => {
  it('is one span named by its target, with a child span per phase', async () => {
    const { go, plugin, spans } = setup([{ name: 'a', url: '/a' }]);
    plugin();
    const before = clock();
    await go('a');
    const after = clock();

    const span = named(spans(), 'a');
    expect(span.kind).toBe(SpanKind.INTERNAL);
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
    expect(span.parentSpanContext).toBeUndefined();

    expect(span.attributes).toEqual({
      'uirouter.transition_id': 0,
      'uirouter.from': '',
      'uirouter.to': 'a',
      'uirouter.source': 'unknown',
      'uirouter.reload': false,
      'uirouter.location': 'true',
      'uirouter.entering': ['a'],
      'uirouter.exiting': [],
      'uirouter.retained': [],
      'uirouter.outcome': 'success',
    });

    expect(childrenOf(spans(), span)).toEqual([
      'before',
      'start',
      'enter a',
      'finish',
      'success',
    ]);

    expect(named(spans(), 'enter a').attributes).toEqual({
      'uirouter.phase': 'enter',
      'uirouter.state': 'a',
    });

    // Event times, not the reporter's clock.
    expect(ms(span.startTime)).toBeGreaterThanOrEqual(before - 1);
    expect(ms(span.endTime)).toBeLessThanOrEqual(after + 1);

    for (const child of spans().filter((s) => s !== span)) {
      expect(ms(child.startTime)).toBeGreaterThanOrEqual(ms(span.startTime));
      expect(ms(child.endTime)).toBeLessThanOrEqual(ms(span.endTime));
      expect(child.spanContext().traceId).toBe(span.spanContext().traceId);
    }
  });

  it('records the transition options', async () => {
    const { go, plugin, spans } = setup([
      { name: 'a', url: '/a' },
      { name: 'b', url: '/b' },
    ]);

    await go('a');
    plugin();
    await go('b', {}, { location: 'replace', reload: 'a' });

    expect(named(spans(), 'b').attributes).toMatchObject({
      'uirouter.from': 'a',
      'uirouter.reload': true,
      'uirouter.reload_state': 'a',
      'uirouter.location': 'replace',
      'uirouter.entering': ['b'],
      'uirouter.exiting': ['a'],
    });
  });
});

describe('a redirect chain', () => {
  it('links each successor to the transition it replaced', async () => {
    const { go, plugin, spans } = setup([
      { name: 'r1', url: '/r1', redirectTo: 'r2' },
      { name: 'r2', url: '/r2', redirectTo: 'b' },
      { name: 'b', url: '/b' },
    ]);

    plugin();
    await go('r1');

    const r1 = named(spans(), 'r1');
    const r2 = named(spans(), 'r2');
    const b = named(spans(), 'b');

    for (const origin of [r1, r2]) {
      expect(origin.attributes['uirouter.outcome']).toBe('redirected');
      expect(origin.status.code).toBe(SpanStatusCode.UNSET);
    }

    expect(r1.links).toEqual([]);
    expect(r2.links.map((link) => link.context.spanId)).toEqual([idOf(r1)]);
    expect(b.links.map((link) => link.context.spanId)).toEqual([idOf(r2)]);
    expect(b.attributes['uirouter.source']).toBe('redirect');
    expect(b.attributes['uirouter.outcome']).toBe('success');
  });
});

describe('a failed transition', () => {
  it('sets an error status and records the message as an exception', async () => {
    const { go, plugin, spans } = setup([
      {
        name: 'boom',
        url: '/boom',
        onEnter: () => {
          throw new Error('boom failed');
        },
      },
    ]);

    plugin();
    await go('boom');

    const span = named(spans(), 'boom');
    expect(span.status).toEqual({
      code: SpanStatusCode.ERROR,
      message: 'boom failed',
    });
    expect(span.attributes['uirouter.outcome']).toBe('error');
    expect(span.attributes['error.type']).toBe('Error');
    expect(span.events.map((event) => [event.name, event.attributes])).toEqual([
      ['exception', { 'exception.message': 'boom failed' }],
    ]);
  });

  it('leaves the message out when the redaction drops messages', async () => {
    const states = [
      {
        name: 'boom',
        url: '/boom',
        onEnter: () => {
          throw new TypeError('user 42 not found');
        },
      },
    ];

    const dropped = setup(states, { redaction: { messages: false } });
    dropped.plugin();
    await dropped.go('boom');
    const span = named(dropped.spans(), 'boom');
    expect(span.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(span.events).toEqual([]);
    expect(span.attributes['error.type']).toBe('TypeError');
  });

  it('reports invalid param values as invalid, naming the params by default', async () => {
    const { go, plugin, spans } = setup([
      { name: 'n', url: '/n/:num', params: { num: { type: 'int' } } },
    ]);

    plugin();
    await go('n', { num: 'x' });

    const span = named(spans(), 'n');
    expect(span.attributes).toMatchObject({
      'uirouter.outcome': 'invalid',
      'uirouter.invalid_params': ['num'],
      'error.type': 'invalid',
    });
    expect(span.attributes).not.toHaveProperty('uirouter.param.num');
    expect(span.status).toEqual({
      code: SpanStatusCode.ERROR,
      message:
        "The following parameter values are not valid for state 'n': [num:null]",
    });
  });
});

describe('resolves', () => {
  const states = (): StateDeclaration[] => [
    {
      name: 'p',
      url: '/p',
      resolve: [{ token: 'parent', resolveFn: () => sleep(2) }],
    },
    {
      name: 'p.ok',
      url: '/ok',
      resolve: [{ token: 'child', resolveFn: () => 'ok' }],
    },
    {
      name: 'p.fail',
      url: '/fail',
      resolve: [
        {
          token: 'user',
          resolveFn: () => Promise.reject(new Error('no user')),
        },
      ],
    },
  ];

  it('are child spans when timeResolves is on, and skip cached values', async () => {
    const { go, plugin, spans } = setup(states(), { timeResolves: true });
    plugin();
    await go('p.ok');
    await go('p.fail');

    const ok = named(spans(), 'p.ok');
    expect(childrenOf(spans(), ok)).toEqual(
      expect.arrayContaining(['resolve parent', 'resolve child']),
    );
    expect(named(spans(), 'resolve child').attributes).toEqual({
      'uirouter.resolve': 'child',
      'uirouter.state': 'p.ok',
    });

    const fail = named(spans(), 'p.fail');
    const resolve = named(spans(), 'resolve user');
    expect(childrenOf(spans(), fail)).toContain('resolve user');
    expect(resolve.status).toEqual({
      code: SpanStatusCode.ERROR,
      message: 'no user',
    });
    expect(resolve.events[0]?.attributes).toEqual({
      'exception.message': 'no user',
    });
    expect(fail.status).toEqual({
      code: SpanStatusCode.ERROR,
      message: 'no user',
    });
    // `parent` is retained from p.ok, so the second transition reuses its value.
    expect(spans().filter((s) => s.name === 'resolve parent')).toHaveLength(1);
  });

  it('are not timed by default', async () => {
    const { go, plugin, spans } = setup(states());
    plugin();
    await go('p.ok');

    expect(spans().filter((s) => s.name.startsWith('resolve'))).toEqual([]);
  });
});

describe('a transition that does not finish', () => {
  it('ends with its outcome when superseded, closing the phase it was in and linking its superseder', async () => {
    const { router, go, flush, plugin, spans } = setup([
      {
        name: 'slow',
        url: '/slow',
        resolve: [{ token: 'wait', resolveFn: () => sleep(10) }],
      },
      { name: 'a', url: '/a' },
    ]);

    plugin();
    void router.stateService.go('slow').catch(() => {});
    // Let `slow` reach its resolve, which core fetches lazily on enter.
    await sleep(2);
    await go('a');
    await sleep(20);
    await flush();

    const slow = named(spans(), 'slow');
    expect(slow.attributes['uirouter.outcome']).toBe('superseded');
    expect(slow.status.code).toBe(SpanStatusCode.UNSET);
    expect(slow.links.map((link) => link.context.spanId)).toEqual([
      idOf(named(spans(), 'a')),
    ]);
    expect(named(spans(), 'a').links).toEqual([]);

    const enter = spans().find(
      (s) =>
        s.name === 'enter slow' && s.parentSpanContext?.spanId === idOf(slow),
    );

    expect(enter?.endTime).toEqual(slow.endTime);
  });

  it('ends as aborted when a hook returns false', async () => {
    const { router, go, plugin, spans } = setup([{ name: 'a', url: '/a' }]);
    router.transitionService.onStart({ to: 'a' }, () => false);
    plugin();
    await go('a');

    const span = named(spans(), 'a');
    expect(span.attributes['uirouter.outcome']).toBe('aborted');
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
  });

  it('leaves no span when core ignores it, unless includeIgnored is on', async () => {
    const quiet = setup([{ name: 'a', url: '/a' }]);
    quiet.plugin();
    await quiet.go('a');
    await quiet.go('a');
    expect(quiet.spans().map((s) => s.name)).not.toContain('error');
    expect(quiet.spans().filter((s) => s.name === 'a')).toHaveLength(1);

    const loud = setup([{ name: 'a', url: '/a' }], { includeIgnored: true });
    loud.plugin();
    await loud.go('a');
    await loud.go('a');
    const [, ignored] = loud.spans().filter((s) => s.name === 'a');
    expect(ignored?.attributes['uirouter.outcome']).toBe('ignored');
    expect(ignored?.status.code).toBe(SpanStatusCode.UNSET);
    // The before phase never ends: core's ignore check rejects inside it.
    expect(childrenOf(loud.spans(), ignored)).toEqual(['error', 'before']);
  });
});

describe('an invalid target', () => {
  it('is a zero-length error span that names no state', async () => {
    const { go, plugin, spans } = setup([{ name: 'a', url: '/a' }]);
    plugin();
    await go('nope', { id: 1 });

    expect(spans()).toHaveLength(1);
    const span = named(spans(), 'invalid target');
    expect(span.startTime).toEqual(span.endTime);
    expect(span.status).toEqual({
      code: SpanStatusCode.ERROR,
      message: "No state named 'nope'",
    });
    expect(span.attributes).toEqual({
      'uirouter.from': '',
      'uirouter.to': 'nope',
      'uirouter.outcome': 'invalid',
      'error.type': 'invalid',
    });
  });
});

describe('params', () => {
  const states: StateDeclaration[] = [
    {
      name: 'folder',
      url: '/folder/:folderId?q&tags',
      params: { tags: { array: true } },
    },
  ];

  const paramAttributes = (span: ReadableSpan) =>
    Object.fromEntries(
      Object.entries(span.attributes).filter(([key]) =>
        key.startsWith('uirouter.param.'),
      ),
    );

  it('become attributes only for the keys the redaction lists', async () => {
    const listed = setup(states, {
      redaction: { params: ['folderId', 'missing'] },
    });

    listed.plugin();
    await listed.go('folder', { folderId: '42', q: 'secret' });

    expect(paramAttributes(named(listed.spans(), 'folder'))).toEqual({
      'uirouter.param.folderId': '42',
    });

    const unlisted = setup(states);
    unlisted.plugin();
    await unlisted.go('folder', { folderId: '42', q: 'secret' });
    expect(paramAttributes(named(unlisted.spans(), 'folder'))).toEqual({});
  });

  it('keep every value under all, a list as strings', async () => {
    const all = setup(states, { redaction: { params: 'all' } });
    all.plugin();
    await all.go('folder', { folderId: '42', tags: ['a', 'b'] });

    expect(paramAttributes(named(all.spans(), 'folder'))).toEqual({
      'uirouter.param.folderId': '42',
      'uirouter.param.tags': ['a', 'b'],
    });
  });
});

describe('dispose()', () => {
  it('ends open spans and stops reporting', async () => {
    const { router, go, flush, plugin, spans } = setup([
      {
        name: 'hang',
        url: '/hang',
        resolve: [{ token: 'never', resolveFn: () => new Promise(() => {}) }],
      },
      { name: 'a', url: '/a' },
    ]);

    const otel = plugin();
    void router.stateService.go('hang').catch(() => {});
    await sleep(0);
    expect(spans().map((s) => s.name)).not.toContain('hang');

    otel.dispose();
    otel.dispose();
    await flush();
    const hang = named(spans(), 'hang');
    expect(hang.ended).toBe(true);
    expect(hang.attributes['uirouter.outcome']).toBeUndefined();
    // Core fetches resolves lazily on enter by default, so the transition waits there.
    expect(childrenOf(spans(), hang)).toEqual([
      'before',
      'start',
      'enter hang',
    ]);

    const count = spans().length;
    await go('a');
    expect(spans()).toHaveLength(count);
  });

  it('ignores a transition that started before the plugin', async () => {
    const { router, go, plugin, spans } = setup([
      {
        name: 'slow',
        url: '/slow',
        resolve: [{ token: 'wait', resolveFn: () => sleep(5) }],
      },
    ]);

    const pending = router.stateService.go('slow');
    plugin();
    await pending;
    await go('slow');
    expect(spans()).toEqual([]);
  });
});

describe('the active context', () => {
  it('parents the transition span under the span active when it started', async () => {
    const manager = new StackContextManager().enable();
    context.setGlobalContextManager(manager);

    try {
      const { router, tracer, flush, plugin, spans } = setup([
        { name: 'a', url: '/a' },
      ]);

      plugin();
      let pending: Promise<unknown> = Promise.resolve();

      tracer.startActiveSpan('click', (click) => {
        pending = router.stateService.go('a');
        click.end();
      });
      await pending;
      await flush();

      const click = named(spans(), 'click');
      const a = named(spans(), 'a');
      expect(a.parentSpanContext?.spanId).toBe(idOf(click));
      expect(a.spanContext().traceId).toBe(click.spanContext().traceId);
    } finally {
      context.disable();
    }
  });
});

describe('retention', () => {
  it('keeps reporting past the settled-transition window', async () => {
    const { go, plugin, spans } = setup([
      { name: 'a', url: '/a' },
      { name: 'b', url: '/b' },
    ]);

    plugin();

    for (let i = 0; i < 70; i++) await go(i % 2 ? 'b' : 'a');

    expect(
      spans().filter((s) => s.attributes['uirouter.outcome'] === 'success'),
    ).toHaveLength(70);
  });
});

describe('a phase a later v1 adds', () => {
  const start: TransitionEvent = {
    v: 1,
    seq: 1,
    t: 1,
    type: 'transition',
    id: 0,
    from: '',
    to: 'a',
    fromParams: {},
    toParams: {},
    entering: ['a'],
    exiting: [],
    retained: [],
    redirectedFrom: null,
    options: {
      source: 'unknown',
      location: true,
      reload: false,
      inherit: true,
      supercede: true,
    },
    dynamic: false,
  };

  const phase = (
    seq: number,
    name: string,
    edge: 'start' | 'end',
    state: string | null = null,
  ): PhaseEvent => ({
    v: 1,
    seq,
    t: seq,
    type: 'phase',
    id: 0,
    phase: name,
    edge,
    state,
  });

  it('is a child span under its own name, paired only with its own edges', () => {
    const exporter = new InMemorySpanExporter();

    const provider = new TracerProvider({
      spanProcessors: [new SimpleSpanProcessor({ exporter })],
    });

    const reporter = reportToTracer(provider.getTracer('spec'));

    const events: RouterEvent[] = [
      start,
      phase(2, 'before', 'start'),
      phase(3, 'before', 'end'),
      phase(4, 'inactivate', 'start', 'a'),
      phase(5, 'enter', 'end', 'a'),
      phase(6, 'inactivate', 'end', 'a'),
      phase(7, 'reactivate', 'end', 'a'),
      phase(8, 'reactivate', 'start'),
      { v: 1, seq: 9, t: 9, type: 'result', id: 0, outcome: 'success' },
    ];

    for (const event of events) reporter.report(event);

    const spans = exporter.getFinishedSpans();
    const span = named(spans, 'a');

    expect(childrenOf(spans, span)).toEqual([
      'before',
      'inactivate a',
      'reactivate',
    ]);
    expect(named(spans, 'inactivate a').attributes).toEqual({
      'uirouter.phase': 'inactivate',
      'uirouter.state': 'a',
    });
    expect(ms(named(spans, 'inactivate a').endTime)).toBe(
      performance.timeOrigin + 6,
    );
    // Opened without a close, it ends with its transition.
    expect(ms(named(spans, 'reactivate').endTime)).toBe(
      performance.timeOrigin + 9,
    );
  });
});
