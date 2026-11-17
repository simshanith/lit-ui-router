import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commands } from 'vitest/browser';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';
import type { SpanRecord } from 'ui-router-otel';

import { restSpan } from '../util/restSpan.js';
import { installTelemetry } from './telemetry.js';

interface CollectedRequest {
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

declare module 'vitest/browser' {
  interface BrowserCommands {
    startOtlpCollector: () => Promise<string>;
    takeOtlpRequests: () => Promise<CollectedRequest[]>;
    stopOtlpCollector: () => Promise<void>;
  }
}

interface OtlpBody {
  resourceSpans: {
    resource: {
      attributes: { key: string; value: { stringValue?: string } }[];
    };
    scopeSpans: { spans: { name: string }[] }[];
  }[];
}

const contactsRouter = () => {
  const router = new UIRouter();

  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateRegistry.register({
    name: 'contacts',
    url: '/contacts',
    resolve: [
      {
        token: 'contacts',
        resolveFn: () => restSpan('GET', 'contacts', () => Promise.resolve([])),
      },
    ],
  });

  return router;
};

describe('installTelemetry', () => {
  let router: UIRouter;
  let records: Map<string, SpanRecord>;

  const named = (name: string) =>
    [...records.values()].find((span) => span.name === name);

  beforeEach(async () => {
    records = new Map();
    router = contactsRouter();
    await installTelemetry(
      router,
      () => ({ addSpan: (span) => records.set(span.spanId, span) }),
      {},
    );
  });

  afterEach(() => {
    router.dispose();
  });

  it('sends a REST span to the sink as the child of its resolve span', async () => {
    await router.stateService.go('contacts');

    await vi.waitFor(() => expect(named('contacts')?.endTime).toBeDefined());

    const transition = named('contacts');
    const resolve = named('resolve contacts');
    const request = named('GET contacts');

    expect(resolve?.parentSpanId).toBe(transition?.spanId);
    expect(request?.parentSpanId).toBe(resolve?.spanId);
    expect(request?.traceId).toBe(transition?.traceId);
    expect(request?.endTime).toBeDefined();
  });

  it('stops sending spans once the router is disposed', async () => {
    router.dispose();
    records.clear();

    await restSpan('GET', 'contacts', () => Promise.resolve([]));

    expect(records.size).toBe(0);
  });
});

describe('installTelemetry with an OTLP endpoint', () => {
  let router: UIRouter;

  // What the page does as it unloads; the batch processor flushes on it.
  const hidePage = () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    Reflect.deleteProperty(document, 'visibilityState');
  };

  beforeEach(() => {
    router = contactsRouter();
  });

  afterEach(async () => {
    router.dispose();
    await commands.stopOtlpCollector();
  });

  it('loads no exporter and sends nothing without an endpoint', async () => {
    const load = vi.fn(() => import('./otlpExport.js'));
    const fetch = vi.spyOn(globalThis, 'fetch');

    await installTelemetry(router, () => null, {}, load);
    await router.stateService.go('contacts');
    hidePage();

    expect(load).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });

  it('sends batched spans, named by the service, with the headers when the page hides', async () => {
    const url = await commands.startOtlpCollector();

    await installTelemetry(router, () => null, {
      VITE_OTLP_TRACES_ENDPOINT: url,
      VITE_OTLP_TRACES_HEADERS: 'x-otlp-test=a%3Db, x-other = c',
      VITE_OTLP_SERVICE_NAME: 'sample-app-spec',
    });
    await router.stateService.go('contacts');

    expect(await commands.takeOtlpRequests()).toEqual([]);

    hidePage();

    const requests = await vi.waitUntil(
      async () => {
        const taken = await commands.takeOtlpRequests();

        return taken.length > 0 && taken;
      },
      { timeout: 5000 },
    );

    // SAFETY: the exporter sends OTLP JSON
    const bodies = requests.map(({ body }) => JSON.parse(body) as OtlpBody);
    const resourceSpans = bodies.flatMap(({ resourceSpans }) => resourceSpans);

    const names = resourceSpans.flatMap(({ scopeSpans }) =>
      scopeSpans.flatMap(({ spans }) => spans.map(({ name }) => name)),
    );

    expect(requests[0]?.headers).toMatchObject({
      'content-type': 'application/json',
      'x-otlp-test': 'a=b',
      'x-other': 'c',
    });
    expect(names).toEqual(
      expect.arrayContaining(['contacts', 'resolve contacts', 'GET contacts']),
    );
    expect(
      resourceSpans[0]?.resource.attributes.find(
        ({ key }) => key === 'service.name',
      )?.value,
    ).toEqual({ stringValue: 'sample-app-spec' });
  });
});
