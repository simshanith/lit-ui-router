import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';
import type { SpanRecord } from 'ui-router-otel';

import { restSpan } from '../util/restSpan.js';
import { installTelemetry } from './telemetry.js';

describe('installTelemetry', () => {
  let router: UIRouter;
  let records: Map<string, SpanRecord>;

  const named = (name: string) =>
    [...records.values()].find((span) => span.name === name);

  beforeEach(() => {
    records = new Map();
    router = new UIRouter();
    router.plugin(servicesPlugin);
    router.plugin(memoryLocationPlugin);
    router.stateRegistry.register({
      name: 'contacts',
      url: '/contacts',
      resolve: [
        {
          token: 'contacts',
          resolveFn: () =>
            restSpan('GET', 'contacts', () => Promise.resolve([])),
        },
      ],
    });
    installTelemetry(router, () => ({
      addSpan: (span) => records.set(span.spanId, span),
    }));
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
