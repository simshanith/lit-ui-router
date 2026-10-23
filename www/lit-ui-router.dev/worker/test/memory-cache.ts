// An in-memory stand-in for the Workers Cache API and the waitUntil hook, for node tests.
import type { EdgeCache } from '../releases/edge-cache.ts';

/** An EdgeCache over a Map, keyed by url like the Cache API, recording each call. */
export const memoryEdge = () => {
  const entries = new Map<string, Response>();
  const pending: Promise<unknown>[] = [];
  const calls: string[] = [];

  const edge: EdgeCache = {
    cache: {
      match: (input) => {
        const request = new Request(input);
        calls.push(`match ${request.method} ${request.url}`);

        if (request.method !== 'GET') return Promise.resolve(undefined);

        return Promise.resolve(entries.get(request.url)?.clone());
      },
      put: (input, response) => {
        const request = new Request(input);
        calls.push(`put ${request.method} ${request.url}`);
        entries.set(request.url, response);

        return Promise.resolve();
      },
    },
    waitUntil: (promise) => {
      pending.push(promise);
    },
  };

  return {
    edge,
    entries,
    calls,
    /** Resolves once every write handed to waitUntil has settled. */
    settled: () => Promise.all(pending),
  };
};
