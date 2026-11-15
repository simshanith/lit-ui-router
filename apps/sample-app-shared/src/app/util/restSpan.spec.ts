import { afterEach, describe, expect, it } from 'vitest';
import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  StackContextManager,
  TracerProvider,
} from '@opentelemetry/sdk-trace';

import { restSpan } from './restSpan.js';

const exporter = new InMemorySpanExporter();

const install = () => {
  context.setGlobalContextManager(new StackContextManager().enable());
  trace.setGlobalTracerProvider(
    new TracerProvider({
      spanProcessors: [new SimpleSpanProcessor({ exporter })],
    }),
  );
};

const finished = () => exporter.getFinishedSpans();

describe('restSpan', () => {
  afterEach(() => {
    trace.disable();
    context.disable();
    exporter.reset();
  });

  it('runs the request on the no-op tracer without a provider', async () => {
    await expect(
      restSpan('GET', 'contacts', () => Promise.resolve('data')),
    ).resolves.toBe('data');

    install();
    expect(finished()).toEqual([]);
  });

  it('names the span by verb and resource and ends it when the request settles', async () => {
    install();
    let settle: (value: string) => void = () => {};

    const pending = restSpan(
      'PUT',
      'contacts',
      () => new Promise<string>((resolve) => (settle = resolve)),
    );

    expect(finished()).toEqual([]);
    settle('saved');
    await expect(pending).resolves.toBe('saved');

    const [span] = finished();
    expect(span?.name).toBe('PUT contacts');
    expect(span?.attributes).toEqual({
      'http.request.method': 'PUT',
      'sample_app.resource': 'contacts',
    });
    expect(span?.status.code).toBe(SpanStatusCode.UNSET);
  });

  it('is a child of the span active when the request starts', async () => {
    install();
    let request: Promise<number> = Promise.resolve(0);

    const resolveSpan = trace
      .getTracer('spec')
      .startActiveSpan('resolve contacts', (span) => {
        request = restSpan('GET', 'contacts', () => Promise.resolve(1));

        return span;
      });

    resolveSpan.end();
    await request;

    const child = finished().find(({ name }) => name === 'GET contacts');
    expect(child?.parentSpanContext?.spanId).toBe(
      resolveSpan.spanContext().spanId,
    );
    expect(child?.spanContext().traceId).toBe(
      resolveSpan.spanContext().traceId,
    );
  });

  it('marks a failed request with its error type', async () => {
    install();

    await expect(
      restSpan('DELETE', 'messages', () =>
        Promise.reject(new TypeError('gone')),
      ),
    ).rejects.toThrow('gone');

    expect(() =>
      restSpan('POST', 'folders', () => {
        throw new RangeError('sync');
      }),
    ).toThrow('sync');

    expect(
      finished().map(({ name, status, attributes }) => ({
        name,
        code: status.code,
        type: attributes['error.type'],
      })),
    ).toEqual([
      {
        name: 'DELETE messages',
        code: SpanStatusCode.ERROR,
        type: 'TypeError',
      },
      { name: 'POST folders', code: SpanStatusCode.ERROR, type: 'RangeError' },
    ]);
  });
});
