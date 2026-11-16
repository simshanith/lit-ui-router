import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { context, SpanStatusCode, type SpanContext } from '@opentelemetry/api';
import {
  StackContextManager,
  TracerProvider,
  type ReadableSpan,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';

import {
  DevtoolsSpanProcessor,
  OtelPlugin,
  type ProcessedSpan,
  type SpanRecord,
} from '../index.ts';
import { spanRecordOf } from '../processor.ts';

const routers: UIRouter[] = [];

afterEach(() => {
  routers.splice(0).forEach((router) => router.dispose());
  context.disable();
});

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const sinkOf = () => {
  const records: SpanRecord[] = [];

  return { records, addSpan: (span: SpanRecord) => void records.push(span) };
};

const context0: SpanContext = {
  traceId: '0af7651916cd43dd8448eb211c80319c',
  spanId: 'b7ad6b7169203331',
  traceFlags: 1,
};

const fake = (overrides: Partial<ProcessedSpan> = {}): ProcessedSpan => ({
  name: 'GET /users',
  spanContext: () => context0,
  startTime: [1_700_000_000, 500_000_000],
  endTime: [1_700_000_000, 750_000_000],
  status: { code: SpanStatusCode.ERROR },
  attributes: {},
  ...overrides,
});

describe('DevtoolsSpanProcessor', () => {
  it("is an SDK SpanProcessor, and reads the SDK's spans", () => {
    expectTypeOf<DevtoolsSpanProcessor>().toExtend<SpanProcessor>();
    expectTypeOf<ReadableSpan>().toExtend<ProcessedSpan>();
  });

  it('sends the router spans and the app spans to the sink, each when it starts and when it ends', async () => {
    context.setGlobalContextManager(new StackContextManager().enable());

    const sink = sinkOf();

    const provider = new TracerProvider({
      spanProcessors: [new DevtoolsSpanProcessor(() => sink)],
    });

    const tracer = provider.getTracer('spec');
    const router = new UIRouter();

    routers.push(router);
    router.plugin(servicesPlugin);
    router.plugin(memoryLocationPlugin);
    router.stateRegistry.register({
      name: 'users',
      url: '/users',
      resolve: [
        {
          token: 'users',
          resolveFn: () =>
            tracer.startActiveSpan('GET /api/users', async (span) => {
              await sleep(5);
              span.end();

              return [];
            }),
        },
      ],
    });
    router.plugin(OtelPlugin, { tracer, timeResolves: true });

    await router.stateService.go('users');
    await provider.forceFlush();

    const transition = [...sink.records]
      .reverse()
      .find((record) => record.attributes?.['uirouter.transition_id'] === 0);

    const fetches = sink.records.filter(
      (record) => record.name === 'GET /api/users',
    );

    expect(transition).toMatchObject({
      name: 'users',
      status: 'unset',
      attributes: { 'uirouter.to': 'users', 'uirouter.from': '' },
    });
    expect(transition?.endTime).toBeGreaterThan(transition?.startTime ?? 0);
    expect(fetches.map((record) => record.endTime === undefined)).toEqual([
      true,
      false,
    ]);
    // The reporter never makes its span active, so a fetch inside a resolve starts a trace of its own.
    expect(fetches[1]).not.toHaveProperty('parentSpanId');
    expect(fetches[1]?.traceId).not.toBe(transition?.traceId);

    const resolve = sink.records.find(
      (record) => record.name === 'resolve users' && record.endTime,
    );

    expect(resolve?.parentSpanId).toBe(transition?.spanId);
  });

  it('sends only ended spans when started is off, and nothing once shut down or without a sink', async () => {
    const sink = sinkOf();
    const processor = new DevtoolsSpanProcessor(() => sink, { started: false });

    processor.onStart(fake());
    processor.onEnd(fake());
    expect(sink.records).toHaveLength(1);

    await processor.forceFlush();
    await processor.shutdown();
    processor.onEnd(fake());
    expect(sink.records).toHaveLength(1);

    expect(() =>
      new DevtoolsSpanProcessor(() => null).onEnd(fake()),
    ).not.toThrow();
  });
});

describe('spanRecordOf', () => {
  it('turns times into epoch milliseconds and the status code into a word', () => {
    expect(spanRecordOf(fake(), true)).toEqual({
      traceId: context0.traceId,
      spanId: context0.spanId,
      name: 'GET /users',
      startTime: 1_700_000_000_500,
      endTime: 1_700_000_000_750,
      status: 'error',
      attributes: {},
    });
    expect(spanRecordOf(fake(), false)).not.toHaveProperty('endTime');
  });

  it("names the parent from either SDK's field", () => {
    const parent = { ...context0, spanId: '00f067aa0ba902b7' };

    expect(
      spanRecordOf(fake({ parentSpanContext: parent }), true).parentSpanId,
    ).toBe('00f067aa0ba902b7');
    expect(
      spanRecordOf(fake({ parentSpanId: '1111111111111111' }), true)
        .parentSpanId,
    ).toBe('1111111111111111');
  });

  it('keeps as text what JSON cannot hold: a symbol, a circular object, and the like inside an array', () => {
    interface Loop {
      self?: Loop;
    }

    const circular: Loop = {};

    circular.self = circular;

    const record = spanRecordOf(
      fake({
        attributes: {
          symbol: Symbol('token'),
          circular,
          items: [{ id: 7 }, 3],
        },
      }),
      true,
    );

    expect(record.attributes).toEqual({
      symbol: 'Symbol(token)',
      circular: '[object Object]',
      items: ['{"id":7}', 3],
    });
  });

  it('keeps scalars and arrays, drops what is unset, and keeps anything else as text', () => {
    const record = spanRecordOf(
      fake({
        attributes: {
          'http.response.status_code': 200,
          'url.full': 'https://example.test/users',
          cached: false,
          tags: ['a', undefined, 'b'],
          unset: undefined,
          empty: null,
          body: { id: 7 },
        },
      }),
      true,
    );

    expect(record.attributes).toEqual({
      'http.response.status_code': 200,
      'url.full': 'https://example.test/users',
      cached: false,
      tags: ['a', null, 'b'],
      body: '{"id":7}',
    });
  });
});
