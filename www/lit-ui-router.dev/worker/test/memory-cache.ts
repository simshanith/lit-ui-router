// An in-memory stand-in for the Workers Cache API, the waitUntil hook and the clock, for node tests.
import type { EdgeCache } from '../releases/edge-cache.ts';

/** An EdgeCache over a Map, keyed by url like the Cache API, recording each call; `advance` moves its clock. */
export const memoryEdge = () => {
  const entries = new Map<string, Response>();
  const pending: Promise<unknown>[] = [];
  const calls: string[] = [];
  let clock = 1_000_000;

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
    now: () => clock,
  };

  return {
    edge,
    entries,
    calls,
    /** How many promises waitUntil has received. */
    background: () => pending.length,
    advance: (ms: number) => {
      clock += ms;
    },
    /** Resolves once every promise handed to waitUntil has settled. */
    settled: () => Promise.allSettled(pending),
  };
};
