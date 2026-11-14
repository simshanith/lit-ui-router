import type { UIRouter } from '@uirouter/core';
import { observe, type ObserveOptions } from '@repo/router-events';
import {
  keepAll,
  redactionOf,
  redactSession,
} from '@repo/router-events/redaction';
import {
  SCHEMA_VERSION,
  type ConfigEvent,
  type CurrentEvent,
  type Redaction,
  type RouterEvent,
  type Session,
  type StatesEvent,
} from './schema.ts';

export interface RecordOptions extends ObserveOptions {
  /** Ring-buffer size for transition-scoped events; snapshots are kept outside it, and a full buffer drops its oldest transitions whole. */
  limit?: number;
}

export interface Recorder {
  readonly routerId: string;
  readonly events: readonly RouterEvent[];
  /** Events discarded since recording began, by the ring buffer or by `clear()`. */
  readonly dropped: number;
  /** The recording as a session file; `redaction` defaults to param keys without their values, messages kept. */
  session(redaction?: Partial<Redaction>): Session;
  clear(): void;
  stop(): void;
  subscribe(listener: (event: RouterEvent) => void): () => void;
}

// The latest of each snapshot event, kept outside the ring buffer.
interface Snapshots {
  config?: ConfigEvent;
  states?: StatesEvent;
  current?: CurrentEvent;
}

const GENERATOR: Session['generator'] = {
  name: 'ui-router-devtools',
  version: import.meta.env.PACKAGE_VERSION,
};

const ids = new WeakMap<UIRouter, string>();

let nextRouter = 0;

const routerIdOf = (router: UIRouter): string => {
  let id = ids.get(router);

  if (!id) ids.set(router, (id = `router-${++nextRouter}`));

  return id;
};

const hex = (bytes: Uint8Array, from: number, to: number) =>
  [...bytes.subarray(from, to)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

// randomUUID exists only in secure contexts; a dev server on a LAN address is not one.
const uuid = (): string => {
  const secure: Partial<Pick<Crypto, 'randomUUID'>> = crypto;

  if (secure.randomUUID) return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return [
    hex(bytes, 0, 4),
    hex(bytes, 4, 6),
    hex(bytes, 6, 8),
    hex(bytes, 8, 10),
    hex(bytes, 10, 16),
  ].join('-');
};

type Buffered = Exclude<RouterEvent, ConfigEvent | StatesEvent | CurrentEvent>;

// A transition's events share its id; an invalid target is one event of its own.
const keyOf = (event: Buffered): number =>
  'id' in event ? event.id : -event.seq;

export const record = (
  router: UIRouter,
  { limit = 2000, ...options }: RecordOptions = {},
): Recorder => {
  const id = uuid();
  let ring: Buffered[] = [];
  let dropped = 0;
  // Transitions dropped while still running; their later events are dropped too.
  const cut = new Set<number>();

  const snapshots: Snapshots = {};

  const listeners = new Set<(event: RouterEvent) => void>();

  // Drops the events under the given keys; a dropped transition still running loses its later events too.
  const drop = (gone: ReadonlySet<number>) => {
    const settled = new Set(
      ring.flatMap((event) => (event.type === 'result' ? [event.id] : [])),
    );

    for (const key of gone) if (key >= 0 && !settled.has(key)) cut.add(key);
    const kept = ring.filter((event) => !gone.has(keyOf(event)));
    dropped += ring.length - kept.length;
    ring = kept;
  };

  // Drops whole transitions, oldest first, to a tenth under the limit, so trims are rare and leave no orphan events.
  const trim = () => {
    const target = Math.floor(limit * 0.9);
    const counts = new Map<number, number>();

    for (const event of ring)
      counts.set(keyOf(event), (counts.get(keyOf(event)) ?? 0) + 1);

    const gone = new Set<number>();
    let left = ring.length;

    for (const event of ring) {
      if (left <= target) break;
      const key = keyOf(event);

      if (gone.has(key)) continue;
      gone.add(key);
      left -= counts.get(key) ?? 0;
    }

    drop(gone);
  };

  const keep = (event: Buffered) => {
    if ('id' in event && cut.has(event.id)) {
      dropped += 1;

      if (event.type === 'result') cut.delete(event.id);

      return;
    }

    ring.push(event);

    if (ring.length > limit) trim();
  };

  const stop = observe(
    router,
    (event) => {
      if (event.type === 'config') snapshots.config = event;
      else if (event.type === 'states') snapshots.states = event;
      else if (event.type === 'current') snapshots.current = event;
      else keep(event);

      for (const listener of listeners) listener(event);
    },
    options,
  );

  const snapshotEvents = () =>
    [snapshots.config, snapshots.states, snapshots.current].filter(
      (event): event is NonNullable<typeof event> => event !== undefined,
    );

  return {
    routerId: routerIdOf(router),
    get events() {
      return ring;
    },
    get dropped() {
      return dropped;
    },
    session: (redaction) =>
      redactSession(
        {
          format: 'ui-router-session',
          v: SCHEMA_VERSION,
          id,
          generator: GENERATOR,
          routerId: routerIdOf(router),
          timeOrigin: performance.timeOrigin,
          t: performance.now(),
          dropped,
          timeResolves: options.timeResolves ?? false,
          redaction: keepAll(),
          events: [...snapshotEvents(), ...ring],
        },
        redactionOf(redaction),
      ),
    clear: () => drop(new Set(ring.map(keyOf))),
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
