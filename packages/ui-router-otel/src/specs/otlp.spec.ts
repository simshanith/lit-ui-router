import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import {
  memoryLocationPlugin,
  servicesPlugin,
  UIRouter,
  type StateDeclaration,
} from '@uirouter/core';

import { OtelPlugin } from '../index.ts';

type Value =
  | { stringValue: string }
  | { intValue: number }
  | { boolValue: boolean }
  | { arrayValue: { values: Value[] } };

interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  attributes: { key: string; value: Value }[];
  events: { name: string }[];
  status: { code: number; message?: string };
}

interface OtlpBody {
  resourceSpans: {
    scopeSpans: { scope: { name: string }; spans: OtlpSpan[] }[];
  }[];
}

interface Received {
  type: string | undefined;
  body: string;
}

const closers: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

// A receiver that keeps each request it is sent, as an OTLP collector's HTTP endpoint would get it.
const collector = async () => {
  const requests: Received[] = [];

  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      requests.push({
        type: request.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{}');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  closers.push(
    () => new Promise<void>((resolve) => server.close(() => resolve())),
  );

  // SAFETY: a server listening on a TCP port reports an AddressInfo
  const { port } = server.address() as AddressInfo;

  return { requests, url: `http://127.0.0.1:${port}/v1/traces` };
};

const STATES: StateDeclaration[] = [
  { name: 'home', url: '/' },
  {
    name: 'user',
    url: '/users/:id',
    resolve: { profile: () => ({ name: 'Ada' }) },
  },
  {
    name: 'broken',
    url: '/broken',
    resolve: { fails: () => Promise.reject(new Error('no')) },
  },
];

// The plugin on a router whose tracer exports through the real OTLP exporter, one request per span.
const setup = async () => {
  const { requests, url } = await collector();

  const provider = new TracerProvider({
    spanProcessors: [
      new SimpleSpanProcessor({ exporter: new OTLPTraceExporter({ url }) }),
    ],
  });

  const router = new UIRouter();

  closers.push(() => provider.shutdown());
  closers.push(() => router.dispose());
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => {});

  for (const state of STATES) router.stateRegistry.register(state);

  router.plugin(OtelPlugin, {
    tracer: provider.getTracer('spec'),
    activateResolveSpans: true,
  });

  const sent = async (): Promise<OtlpSpan[]> => {
    await provider.forceFlush();

    return requests.flatMap(({ body }) =>
      // SAFETY: the receiver is sent OTLP JSON, asserted by content type in the first spec
      (JSON.parse(body) as OtlpBody).resourceSpans.flatMap(({ scopeSpans }) =>
        scopeSpans.flatMap(({ spans }) => spans),
      ),
    );
  };

  return { router, requests, sent };
};

const attributesOf = (span: OtlpSpan | undefined) =>
  Object.fromEntries(
    (span?.attributes ?? []).map(({ key, value }) => [key, value]),
  );

const strings = (...values: string[]): Value => ({
  arrayValue: { values: values.map((stringValue) => ({ stringValue })) },
});

describe('OTLP export', () => {
  it("sends a transition's span as OTLP JSON with typed attribute values", async () => {
    const { router, requests, sent } = await setup();

    await router.stateService.go('home');
    await router.stateService.go('user', { id: '7' });

    const user = (await sent()).find(({ name }) => name === 'user');

    expect(new Set(requests.map(({ type }) => type))).toEqual(
      new Set(['application/json']),
    );
    expect(attributesOf(user)).toEqual({
      'uirouter.transition_id': { intValue: 1 },
      'uirouter.from': { stringValue: 'home' },
      'uirouter.to': { stringValue: 'user' },
      'uirouter.source': { stringValue: 'unknown' },
      'uirouter.reload': { boolValue: false },
      'uirouter.location': { stringValue: 'true' },
      'uirouter.entering': strings('user'),
      'uirouter.exiting': strings('home'),
      'uirouter.retained': strings(),
      'uirouter.outcome': { stringValue: 'success' },
    });
    expect(user?.status).toEqual({ code: 0 });
    expect(user?.parentSpanId).toBeUndefined();
  });

  it("sends a transition's phases and resolve in its trace, under it", async () => {
    const { router, sent } = await setup();

    await router.stateService.go('user', { id: '7' });

    const spans = await sent();
    const user = spans.find(({ name }) => name === 'user');
    const inTrace = spans.filter((span) => span !== user);
    const names = new Map(spans.map(({ spanId, name }) => [spanId, name]));

    const parents = Object.fromEntries(
      inTrace.map(({ name, parentSpanId }) => [
        name,
        names.get(parentSpanId ?? ''),
      ]),
    );

    expect(new Set(spans.map(({ traceId }) => traceId)).size).toBe(1);
    expect(parents).toEqual({
      before: 'user',
      start: 'user',
      'enter user': 'user',
      'resolve profile': 'user',
      finish: 'user',
      success: 'user',
    });
    expect(
      attributesOf(inTrace.find(({ name }) => name === 'resolve profile')),
    ).toEqual({
      'uirouter.resolve': { stringValue: 'profile' },
      'uirouter.state': { stringValue: 'user' },
    });
  });

  it('sends a failed transition and its resolve with an error status and an exception event', async () => {
    const { router, sent } = await setup();

    await router.stateService.go('broken').catch(() => {});

    const spans = await sent();

    const failed = ['broken', 'resolve fails'].map((wanted) =>
      spans.find(({ name }) => name === wanted),
    );

    for (const span of failed) {
      expect(span?.status).toEqual({ code: 2, message: 'no' });
      expect(span?.events.map(({ name }) => name)).toEqual(['exception']);
      expect(attributesOf(span)['error.type']).toEqual({
        stringValue: 'Error',
      });
    }

    expect(attributesOf(failed[0])['uirouter.outcome']).toEqual({
      stringValue: 'error',
    });
  });
});
