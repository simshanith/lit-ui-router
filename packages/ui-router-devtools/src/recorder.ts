import type { UIRouter } from '@uirouter/core';
import { observe, type ObserveOptions } from './adapter.ts';
import {
  SCHEMA_VERSION,
  type ConfigEvent,
  type CurrentEvent,
  type DevtoolsEvent,
  type Session,
  type StatesEvent,
} from './schema.ts';

export interface RecordOptions extends ObserveOptions {
  // Ring-buffer size for transition-scoped events; snapshots are kept outside it.
  limit?: number;
}

export interface Recorder {
  readonly routerId: string;
  readonly events: readonly DevtoolsEvent[];
  session(): Session;
  clear(): void;
  stop(): void;
  subscribe(listener: (event: DevtoolsEvent) => void): () => void;
}

// The latest of each snapshot event, kept outside the ring buffer.
interface Snapshots {
  config?: ConfigEvent;
  states?: StatesEvent;
  current?: CurrentEvent;
}

const ids = new WeakMap<UIRouter, string>();

let nextRouter = 0;

const routerIdOf = (router: UIRouter): string => {
  let id = ids.get(router);

  if (!id) ids.set(router, (id = `router-${++nextRouter}`));

  return id;
};

export const record = (
  router: UIRouter,
  { limit = 2000, ...options }: RecordOptions = {},
): Recorder => {
  const ring: DevtoolsEvent[] = [];

  const snapshots: Snapshots = {};

  const listeners = new Set<(event: DevtoolsEvent) => void>();

  const stop = observe(
    router,
    (event) => {
      if (event.type === 'config') snapshots.config = event;
      else if (event.type === 'states') snapshots.states = event;
      else if (event.type === 'current') snapshots.current = event;
      else {
        ring.push(event);

        if (ring.length > limit) ring.splice(0, ring.length - limit);
      }

      for (const listener of listeners) listener(event);
    },
    options,
  );

  return {
    routerId: routerIdOf(router),
    get events() {
      return ring;
    },
    session: () => ({
      v: SCHEMA_VERSION,
      routerId: routerIdOf(router),
      startedAt: performance.timeOrigin,
      events: [
        ...[snapshots.config, snapshots.states, snapshots.current].filter(
          (event): event is NonNullable<typeof event> => event !== undefined,
        ),
        ...ring,
      ],
    }),
    clear: () => void ring.splice(0),
    stop: () => {
      stop();
      listeners.clear();
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => void listeners.delete(listener);
    },
  };
};
