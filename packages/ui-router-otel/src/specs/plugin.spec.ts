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

import { OtelPlugin, type OtelPluginOptions } from '../index.ts';

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
      'ui_router.transition_id': 0,
      'ui_router.from': '',
      'ui_router.to': 'a',
      'ui_router.source': 'unknown',
      'ui_router.reload': false,
      'ui_router.location': 'true',
      'ui_router.entering': ['a'],
      'ui_router.exiting': [],
      'ui_router.retained': [],
      'ui_router.outcome': 'success',
    });

    expect(childrenOf(spans(), span)).toEqual([
      'before',
      'start',
      'enter a',
      'finish',
      'success',
    ]);

    expect(named(spans(), 'enter a').attributes).toEqual({
      'ui_router.phase': 'enter',
      'ui_router.state': 'a',
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
      'ui_router.from': 'a',
      'ui_router.reload': true,
      'ui_router.reload_state': 'a',
      'ui_router.location': 'replace',
      'ui_router.entering': ['b'],
      'ui_router.exiting': ['a'],
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
      expect(origin.attributes['ui_router.outcome']).toBe('redirected');
      expect(origin.attributes['ui_router.rejection_type']).toBe('superseded');
      expect(origin.status.code).toBe(SpanStatusCode.UNSET);
    }

    expect(r1.links).toEqual([]);
    expect(r2.links.map((link) => link.context.spanId)).toEqual([idOf(r1)]);
    expect(b.links.map((link) => link.context.spanId)).toEqual([idOf(r2)]);
    expect(b.attributes['ui_router.source']).toBe('redirect');
    expect(b.attributes['ui_router.outcome']).toBe('success');
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
    expect(span.attributes['ui_router.outcome']).toBe('error');
    expect(span.attributes['ui_router.rejection_type']).toBe('error');
    expect(span.events.map((event) => [event.name, event.attributes])).toEqual([
      ['exception', { 'exception.message': 'boom failed' }],
    ]);
  });

  it('maps or drops the message through errorMessage', async () => {
    const states = [
      {
        name: 'boom',
        url: '/boom',
        onEnter: () => {
          throw new Error('user 42 not found');
        },
      },
    ];

    const mapped = setup(states, {
      errorMessage: (message) => message.replace(/\d+/g, '#'),
    });

    mapped.plugin();
    await mapped.go('boom');
    expect(named(mapped.spans(), 'boom').status.message).toBe(
      'user # not found',
    );

    const dropped = setup(states, { errorMessage: () => undefined });
    dropped.plugin();
    await dropped.go('boom');
    const span = named(dropped.spans(), 'boom');
    expect(span.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(span.events).toEqual([]);
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
      'ui_router.resolve': 'child',
      'ui_router.state': 'p.ok',
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
  it('ends with its outcome when superseded, closing the phase it was in', async () => {
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
    expect(slow.attributes['ui_router.outcome']).toBe('superseded');
    expect(slow.attributes['ui_router.rejection_type']).toBe('superseded');
    expect(slow.status.code).toBe(SpanStatusCode.UNSET);
    expect(slow.links).toEqual([]);
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
    expect(span.attributes['ui_router.outcome']).toBe('aborted');
    expect(span.attributes['ui_router.rejection_type']).toBe('aborted');
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
    expect(ignored?.attributes['ui_router.outcome']).toBe('ignored');
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
      'ui_router.from': '',
      'ui_router.to': 'nope',
      'ui_router.outcome': 'invalid',
      'ui_router.rejection_type': 'invalid',
    });
  });
});

describe('params', () => {
  const states: StateDeclaration[] = [
    { name: 'folder', url: '/folder/:folderId?q' },
  ];

  it('are attributes only when the allowlist names them', async () => {
    const listed = setup(states, { params: ['folderId', 'missing'] });
    listed.plugin();
    await listed.go('folder', { folderId: '42', q: 'secret' });

    const span = named(listed.spans(), 'folder');
    expect(span.attributes['ui_router.param.folderId']).toBe('42');
    expect(
      Object.keys(span.attributes).filter((k) => k.includes('param')),
    ).toEqual(['ui_router.param.folderId']);

    const unlisted = setup(states);
    unlisted.plugin();
    await unlisted.go('folder', { folderId: '42', q: 'secret' });
    expect(
      Object.keys(named(unlisted.spans(), 'folder').attributes).filter((k) =>
        k.includes('param'),
      ),
    ).toEqual([]);
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
    expect(hang.attributes['ui_router.outcome']).toBeUndefined();
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
      spans().filter((s) => s.attributes['ui_router.outcome'] === 'success'),
    ).toHaveLength(70);
  });
});
