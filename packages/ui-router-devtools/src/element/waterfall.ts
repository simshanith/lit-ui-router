// The Timeline's model: a transition, its redirect chain, its phases, resolves and joined spans, on one time axis. No DOM.
import { originOf, type Tx } from '../fold.ts';
import type { PhaseEvent, SpanRecord, StateInfo } from '../schema.ts';
import { spanWindow } from '../spans.ts';
import { seq, type Status } from '../notation.ts';

export type BarKind = 'transition' | 'phase' | 'resolve' | 'span';

/**
 * How a span is known to belong to a transition: `child` descends from one of the router's own spans for it, `trace`
 * shares its trace and overlaps it, and `during` only overlaps it in time.
 */
export type Relation = 'child' | 'trace' | 'during';

export interface Bar {
  /** Unique in one waterfall, and stable while the transition runs. */
  key: string;
  kind: BarKind;
  /** The transition the bar belongs to. */
  tx: number;
  name: string;
  state: string | null;
  /** On the event clock; null for a row nothing timed. */
  start: number | null;
  end: number | null;
  running: boolean;
  fault: boolean;
  /** What the bar alone does not say: `cached`, `untimed`, `cut short`, `redirected to 007`. */
  note: string | null;
  status?: Status;
  relation?: Relation;
  span?: SpanRecord;
  children: Bar[];
}

export interface Waterfall {
  roots: Bar[];
  /** The axis's zero on the event clock, and its length in milliseconds. */
  zero: number;
  length: number;
}

export interface WaterfallInput {
  txs: readonly Tx[];
  tx: Tx;
  states: readonly StateInfo[];
  /** The event clock now, or at an imported session's export. */
  clock: number;
  /** Whether the session timed resolves; without it a transition's resolves are listed untimed. */
  timeResolves: boolean;
  spans: readonly SpanRecord[];
  /** Epoch milliseconds of the event clock's zero, to place spans on it. */
  timeOrigin: number;
}

/** How far apart, in milliseconds, the recorder's and the reporter's clocks may read one transition's start. */
export const START_TOLERANCE = 2;

const ROUTER = 'uirouter.';

const NOTES: Partial<Record<Status, string>> = {
  aborted: 'aborted',
  ignored: 'ignored',
  invalid: 'invalid',
  error: 'failed',
};

/** The redirect chain `tx` is part of, from the first transition to the last that ran. */
export const chainOf = (txs: readonly Tx[], tx: Tx): Tx[] => {
  let first = tx;

  for (
    let origin = originOf(txs, first);
    origin && origin !== tx;
    origin = originOf(txs, origin)
  )
    first = origin;

  const chain = [first];

  for (let id = first.successor; id !== undefined;) {
    const next = txs.find((each) => each.id === id);

    if (!next || chain.includes(next)) break;
    chain.push(next);
    id = next.successor;
  }

  return chain;
};

const byStart = (a: Bar, b: Bar): number =>
  (a.start ?? Infinity) - (b.start ?? Infinity);

const endOf = (tx: Tx, clock: number): number => tx.result?.t ?? clock;

const txNote = (tx: Tx): string | null => {
  const result = tx.result;

  if (!result) return null;

  if (result.outcome === 'redirected')
    return tx.successor === undefined
      ? 'redirected'
      : `redirected to ${seq(tx.successor)}`;

  if (result.outcome === 'superseded')
    return result.by === undefined
      ? 'superseded'
      : `superseded by ${seq(result.by)}`;

  return NOTES[result.outcome] ?? null;
};

const phaseBar = (
  tx: Tx,
  start: PhaseEvent,
  end: number,
  cut: 'running' | 'cut' | null,
): Bar => ({
  key: `${tx.id}:p${start.seq}`,
  kind: 'phase',
  tx: tx.id,
  name: start.state ? `${start.phase} ${start.state}` : start.phase,
  state: start.state,
  start: start.t,
  end,
  running: cut === 'running',
  fault: start.phase === 'error',
  note: cut === 'cut' ? 'cut short' : null,
  children: [],
});

// Pairs each phase's two edges; a phase still open when the transition settled ends with it.
const phaseBars = (tx: Tx, clock: number): Bar[] => {
  const open = new Map<string, PhaseEvent>();
  const bars: Bar[] = [];

  for (const mark of tx.marks) {
    const key = `${mark.phase} ${mark.state ?? ''}`;

    if (mark.edge === 'start') {
      open.set(key, mark);
      continue;
    }

    const start = open.get(key);

    if (!start) continue;
    open.delete(key);
    bars.push(phaseBar(tx, start, mark.t, null));
  }

  for (const start of open.values())
    bars.push(
      phaseBar(tx, start, endOf(tx, clock), tx.result ? 'cut' : 'running'),
    );

  return bars;
};

const resolveBars = (tx: Tx): Bar[] =>
  tx.resolves.map((resolve) => ({
    key: `${tx.id}:r${resolve.seq}`,
    kind: 'resolve',
    tx: tx.id,
    name: `resolve ${resolve.token}`,
    state: resolve.state,
    start: resolve.cached ? null : resolve.start,
    end: resolve.cached ? null : resolve.end,
    running: false,
    fault: !resolve.ok,
    note: resolve.cached ? 'cached' : resolve.ok ? null : 'failed',
    children: [],
  }));

// Without resolve timing the entering states' declared resolves still ran; they are listed, with no bar.
const untimedBars = (tx: Tx, states: readonly StateInfo[]): Bar[] =>
  tx.entering.flatMap((name) =>
    (states.find((state) => state.name === name)?.resolves ?? []).map(
      (token): Bar => ({
        key: `${tx.id}:u${name}:${token}`,
        kind: 'resolve',
        tx: tx.id,
        name: `resolve ${token}`,
        state: name,
        start: null,
        end: null,
        running: false,
        fault: false,
        note: 'untimed',
        children: [],
      }),
    ),
  );

const isRouterSpan = (span: SpanRecord): boolean =>
  Object.keys(span.attributes ?? {}).some((key) => key.startsWith(ROUTER));

/**
 * The router's span for `tx`, from `ui-router-otel`: its transition id, its ends, and a start within
 * `START_TOLERANCE` of the recorded one. A transition id is unique per router only, so the ends and the start tell two
 * routers, or a router created again, apart; when two spans still match, neither is used.
 */
export const transitionSpanOf = (
  tx: Tx,
  spans: readonly SpanRecord[],
  timeOrigin: number,
): SpanRecord | undefined => {
  const found = spans.filter(
    ({ attributes, startTime }) =>
      attributes?.['uirouter.transition_id'] === tx.id &&
      attributes['uirouter.to'] === tx.to &&
      attributes['uirouter.from'] === tx.from &&
      Math.abs(startTime - timeOrigin - tx.t) <= START_TOLERANCE,
  );

  return found.length === 1 ? found[0] : undefined;
};

interface SpanIndex {
  spans: readonly SpanRecord[];
  byId: ReadonlyMap<string, SpanRecord>;
  children: ReadonlyMap<string, SpanRecord[]>;
  routerIds: ReadonlySet<string>;
}

const indexSpans = (spans: readonly SpanRecord[]): SpanIndex => {
  const children = new Map<string, SpanRecord[]>();

  for (const span of spans)
    if (span.parentSpanId)
      children.set(span.parentSpanId, [
        ...(children.get(span.parentSpanId) ?? []),
        span,
      ]);

  return {
    spans,
    byId: new Map(spans.map((span) => [span.spanId, span])),
    children,
    routerIds: new Set(
      spans.flatMap((span) => (isRouterSpan(span) ? [span.spanId] : [])),
    ),
  };
};

interface Placing {
  timeOrigin: number;
  clock: number;
}

const spanBar = (
  index: SpanIndex,
  span: SpanRecord,
  tx: number,
  placing: Placing,
  seen: Set<string>,
): Bar => {
  seen.add(span.spanId);

  const { start, end } = spanWindow(span, placing.timeOrigin, placing.clock);

  const children = (index.children.get(span.spanId) ?? [])
    .filter((child) => !seen.has(child.spanId) && !isRouterSpan(child))
    .map((child) => spanBar(index, child, tx, placing, seen))
    .sort(byStart);

  return {
    key: `${tx}:s${span.spanId}`,
    kind: 'span',
    tx,
    name: span.name,
    state: null,
    start,
    end,
    running: span.endTime === undefined,
    fault: span.status === 'error',
    note: null,
    span,
    children,
  };
};

// The router's span for each transition in the chain, and the ids of that span and its phase and resolve children.
const routerSpansOf = (
  chain: readonly Tx[],
  index: SpanIndex,
  timeOrigin: number,
) =>
  chain.map((tx) => {
    const span = transitionSpanOf(tx, index.spans, timeOrigin);

    const ids = span
      ? [
          span.spanId,
          ...(index.children.get(span.spanId) ?? [])
            .filter(isRouterSpan)
            .map((child) => child.spanId),
        ]
      : [];

    return { tx, span, ids: new Set(ids) };
  });

// A span that is not the router's and whose parent is no such span either: the top of what is joined.
const foreignRoots = (index: SpanIndex): SpanRecord[] =>
  index.spans.filter((span) => {
    if (index.routerIds.has(span.spanId)) return false;

    const parent = span.parentSpanId && index.byId.get(span.parentSpanId);

    return !parent || index.routerIds.has(parent.spanId);
  });

interface Joined {
  tx: Tx;
  relation: Relation;
}

const overlaps = (
  window: { start: number; end: number },
  from: number,
  to: number,
): boolean => window.start <= to && window.end >= from;

// The transition a span overlapping the chain is drawn under: the last to start before it, else the first.
const startedBefore = (chain: readonly Tx[], start: number): Tx =>
  chain.findLast((tx) => tx.t <= start) ?? chain[0];

const joinOf = (
  root: SpanRecord,
  routers: ReturnType<typeof routerSpansOf>,
  index: SpanIndex,
  placing: Placing,
): Joined | null => {
  const parent = root.parentSpanId;
  const owner = parent && routers.find(({ ids }) => ids.has(parent));

  if (owner) return { tx: owner.tx, relation: 'child' };

  // A child of another transition's router span is that transition's.
  if (parent && index.routerIds.has(parent)) return null;

  const window = spanWindow(root, placing.timeOrigin, placing.clock);
  const chain = routers.map(({ tx }) => tx);

  const traced = routers.find(
    ({ tx, span }) =>
      span?.traceId === root.traceId &&
      overlaps(window, tx.t, endOf(tx, placing.clock)),
  );

  if (traced) return { tx: traced.tx, relation: 'trace' };

  const first = chain[0];
  const last = chain.at(-1) ?? first;

  return overlaps(window, first.t, endOf(last, placing.clock))
    ? { tx: startedBefore(chain, window.start), relation: 'during' }
    : null;
};

/** The spans drawn under each transition of `chain`, keyed by transition id. */
export const joinSpans = (
  chain: readonly Tx[],
  spans: readonly SpanRecord[],
  placing: Placing,
): Map<number, Bar[]> => {
  const index = indexSpans(spans);
  const routers = routerSpansOf(chain, index, placing.timeOrigin);
  const joined = new Map<number, Bar[]>();
  const seen = new Set<string>();

  for (const root of foreignRoots(index)) {
    const join = joinOf(root, routers, index, placing);

    if (!join || seen.has(root.spanId)) continue;

    const bar = {
      ...spanBar(index, root, join.tx.id, placing, seen),
      relation: join.relation,
    };

    joined.set(join.tx.id, [...(joined.get(join.tx.id) ?? []), bar]);
  }

  return joined;
};

const transitionBar = (
  input: WaterfallInput,
  tx: Tx,
  spans: readonly Bar[],
): Bar => {
  const { clock, states, timeResolves } = input;
  const status: Status = tx.result?.outcome ?? 'running';
  const timed = timeResolves || tx.resolves.length > 0;

  return {
    key: `${tx.id}`,
    kind: 'transition',
    tx: tx.id,
    name: tx.to || '(root)',
    state: tx.to,
    start: tx.t,
    end: endOf(tx, clock),
    running: !tx.result,
    fault: status === 'error' || status === 'invalid',
    note: txNote(tx),
    status,
    children: [
      ...phaseBars(tx, clock),
      ...resolveBars(tx),
      ...spans,
      ...(timed ? [] : untimedBars(tx, states)),
    ].sort(byStart),
  };
};

const extent = (
  bars: readonly Bar[],
  pick: (bar: Bar) => number | null,
): number[] =>
  bars.flatMap((bar) => {
    const at = pick(bar);

    return [...(at === null ? [] : [at]), ...extent(bar.children, pick)];
  });

/** Lays out `tx` and its redirect chain on one axis, which starts at the earliest bar and ends at the latest. */
export const waterfall = (input: WaterfallInput): Waterfall => {
  const chain = chainOf(input.txs, input.tx);

  const spans = input.spans.length
    ? joinSpans(chain, input.spans, input)
    : new Map<number, Bar[]>();

  const roots = chain.map((tx) =>
    transitionBar(input, tx, spans.get(tx.id) ?? []),
  );

  const zero = Math.min(...extent(roots, (bar) => bar.start));
  const end = Math.max(...extent(roots, (bar) => bar.end));

  return { roots, zero, length: Math.max(end - zero, 0.1) };
};

const STEPS = [1, 2, 2.5, 5];

/** Gridline offsets for an axis `length` long: a 1, 2, 2.5 or 5 step that gives at most `most` lines past zero. */
export const ticks = (length: number, most = 5): number[] => {
  const raw = length / most;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = (STEPS.find((each) => each * power >= raw) ?? 10) * power;

  return Array.from(
    { length: Math.floor(length / step + 1e-9) + 1 },
    // Rounded, so a tenth of a millisecond times three reads 0.3.
    (_, index) => Number((index * step).toPrecision(12)),
  );
};

export interface WaterfallRow {
  bar: Bar;
  level: number;
  setsize: number;
  posinset: number;
  parent: string | null;
  expanded: boolean | null;
}

/** The rows a tree of bars shows, depth first, with the children of a collapsed bar left out. */
export const rowsOf = (
  roots: readonly Bar[],
  collapsed: ReadonlySet<string>,
): WaterfallRow[] => {
  const rows: WaterfallRow[] = [];

  const walk = (bars: readonly Bar[], level: number, parent: string | null) =>
    bars.forEach((bar, index) => {
      const open = bar.children.length > 0 && !collapsed.has(bar.key);

      rows.push({
        bar,
        level,
        setsize: bars.length,
        posinset: index + 1,
        parent,
        expanded: bar.children.length ? open : null,
      });

      if (open) walk(bar.children, level + 1, bar.key);
    });

  walk(roots, 1, null);

  return rows;
};
