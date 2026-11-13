import { describe, expect, it } from 'vitest';

import { fold, type Tx } from '../fold.ts';
import type { RouterEvent, SpanRecord, StateInfo } from '../schema.ts';
import { spansDuring, upsertSpan } from '../spans.ts';
import {
  chainOf,
  joinSpans,
  rowsOf,
  ticks,
  transitionSpanOf,
  waterfall,
  type Bar,
  type WaterfallInput,
} from '../element/waterfall.ts';

const ORIGIN = 1_700_000_000_000;

let seq = 0;

const at = (t: number) => ({ v: 1, seq: ++seq, t }) as const;

const start = (
  id: number,
  t: number,
  to: string,
  more: { redirectedFrom?: number; from?: string; entering?: string[] } = {},
): RouterEvent => ({
  ...at(t),
  type: 'transition',
  id,
  from: more.from ?? '',
  to,
  fromParams: {},
  toParams: {},
  entering: more.entering ?? [to],
  exiting: [],
  retained: [],
  redirectedFrom: more.redirectedFrom ?? null,
  options: {
    source: 'unknown',
    location: true,
    reload: false,
    inherit: true,
    supercede: true,
  },
  dynamic: false,
});

const phase = (
  id: number,
  t: number,
  name: string,
  edge: 'start' | 'end',
  state: string | null = null,
): RouterEvent => ({ ...at(t), type: 'phase', id, phase: name, edge, state });

const resolve = (
  id: number,
  token: string,
  state: string,
  from: number,
  to: number,
  more: { ok?: boolean; cached?: boolean } = {},
): RouterEvent => ({
  ...at(to),
  type: 'resolve',
  id,
  token,
  state,
  start: from,
  end: to,
  ok: more.ok ?? true,
  cached: more.cached ?? false,
});

const result = (
  id: number,
  t: number,
  outcome: 'success' | 'redirected' | 'superseded' | 'error',
  by?: number,
): RouterEvent => ({
  ...at(t),
  type: 'result',
  id,
  outcome,
  ...(by !== undefined && { by }),
});

const states: StateInfo[] = [
  {
    name: 'users',
    parent: null,
    url: '/users',
    params: [],
    resolves: ['users', 'roles'],
    future: false,
    abstract: false,
    redirects: false,
  },
];

const txsOf = (events: RouterEvent[]): Tx[] => fold(events).txs;

const input = (
  txs: Tx[],
  id: number,
  more: Partial<WaterfallInput> = {},
): WaterfallInput => ({
  txs,
  tx: txs.find((tx) => tx.id === id)!,
  states,
  clock: 1000,
  timeResolves: true,
  spans: [],
  timeOrigin: ORIGIN,
  ...more,
});

const names = (bars: readonly Bar[]) => bars.map((bar) => bar.name);

const span = (
  spanId: string,
  from: number,
  to: number | undefined,
  more: Partial<SpanRecord> = {},
): SpanRecord => ({
  traceId: `trace-${spanId}`,
  spanId,
  name: spanId,
  startTime: ORIGIN + from,
  ...(to !== undefined && { endTime: ORIGIN + to }),
  ...more,
});

// What ui-router-otel sends for a transition: its id, its ends and its start.
const routerSpan = (tx: Tx, spanId: string, traceId = `trace-${spanId}`) =>
  span(spanId, tx.t + 0.05, tx.result?.t, {
    traceId,
    name: tx.to,
    attributes: {
      'uirouter.transition_id': tx.id,
      'uirouter.from': tx.from,
      'uirouter.to': tx.to,
    },
  });

describe('waterfall', () => {
  const events = [
    start(1, 10, 'users'),
    phase(1, 10, 'before', 'start'),
    phase(1, 10.2, 'before', 'end'),
    phase(1, 11, 'enter', 'start', 'users'),
    resolve(1, 'users', 'users', 11.1, 400),
    resolve(1, 'roles', 'users', 11.2, 11.3, { cached: true }),
    phase(1, 401, 'enter', 'end', 'users'),
    result(1, 402, 'success'),
  ];

  it('nests phases and resolves under the transition, in the order they started, on one axis', () => {
    const { roots, zero, length } = waterfall(input(txsOf(events), 1));

    expect(names(roots)).toEqual(['users']);
    expect(names(roots[0].children)).toEqual([
      'before',
      'enter users',
      'resolve users',
      'resolve roles',
    ]);
    expect(zero).toBe(10);
    expect(length).toBe(392);

    const [before, , users, roles] = roots[0].children;

    // a sub-millisecond phase keeps its own duration beside a long resolve
    expect(before.end! - before.start!).toBeCloseTo(0.2);
    expect(users.end! - users.start!).toBeCloseTo(388.9);
    expect(roles).toMatchObject({ start: null, note: 'cached' });
  });

  it('lists the declared resolves untimed when the session did not time them', () => {
    const untimed = events.filter((event) => event.type !== 'resolve');

    const { roots } = waterfall(
      input(txsOf(untimed), 1, { timeResolves: false }),
    );

    expect(
      roots[0].children
        .filter((bar) => bar.kind === 'resolve')
        .map((bar) => [bar.name, bar.start, bar.note]),
    ).toEqual([
      ['resolve users', null, 'untimed'],
      ['resolve roles', null, 'untimed'],
    ]);
  });

  it('grows a running transition and its open phase to the clock', () => {
    const running = events.slice(0, 5);

    const { roots, length } = waterfall(
      input(txsOf(running), 1, { clock: 600 }),
    );

    const enter = roots[0].children.find((bar) => bar.name === 'enter users');

    expect(roots[0]).toMatchObject({ running: true, end: 600, note: null });
    expect(enter).toMatchObject({ running: true, end: 600, note: null });
    expect(length).toBe(590);
  });

  it('draws a redirect chain from its origin, and cuts short a phase the redirect ended', () => {
    const txs = txsOf([
      start(2, 0, 'home'),
      phase(2, 0.5, 'start', 'start'),
      result(2, 1, 'redirected'),
      start(3, 1.2, 'users', { redirectedFrom: 2 }),
      result(3, 5, 'success'),
    ]);

    expect(chainOf(txs, txs[1]).map((tx) => tx.id)).toEqual([2, 3]);

    const { roots, zero } = waterfall(input(txs, 3));

    expect(zero).toBe(0);
    expect(roots.map((bar) => [bar.name, bar.note])).toEqual([
      ['home', 'redirected to 003'],
      ['users', null],
    ]);
    expect(roots[0].children[0]).toMatchObject({
      name: 'start',
      end: 1,
      note: 'cut short',
    });
  });

  it('says what superseded a transition and marks a failed resolve', () => {
    const txs = txsOf([
      start(4, 0, 'users'),
      resolve(4, 'users', 'users', 0.1, 3, { ok: false }),
      result(4, 3, 'superseded', 5),
    ]);

    const { roots } = waterfall(input(txs, 4));

    expect(roots[0]).toMatchObject({
      status: 'superseded',
      note: 'superseded by 005',
      fault: false,
    });
    expect(roots[0].children[0]).toMatchObject({ fault: true, note: 'failed' });
  });
});

describe('joining spans', () => {
  const txs = txsOf([
    start(1, 100, 'users'),
    result(1, 300, 'success'),
    start(2, 400, 'roles', { from: 'users' }),
    result(2, 500, 'success'),
  ]);

  const [users, roles] = txs;
  const placing = { timeOrigin: ORIGIN, clock: 1000 };

  it("finds the router's span by id, ends and start, and none when two match", () => {
    const own = routerSpan(users, 'r1');

    expect(transitionSpanOf(users, [own], ORIGIN)).toBe(own);

    // Another router's transition with the same id, later: the start tells them apart.
    const other = { ...routerSpan(users, 'r2'), startTime: ORIGIN + 5000 };

    expect(transitionSpanOf(users, [own, other], ORIGIN)).toBe(own);

    // A twin within the tolerance is ambiguous, so neither is used.
    const twin = { ...own, spanId: 'r3' };

    expect(transitionSpanOf(users, [own, twin], ORIGIN)).toBeUndefined();
  });

  it("joins a child of the router's spans, a span of its trace and a span during it, and nests their children", () => {
    const own = routerSpan(users, 'r1', 'trace-app');

    const phaseSpan = span('p1', 101, 120, {
      traceId: 'trace-app',
      parentSpanId: 'r1',
      attributes: { 'uirouter.phase': 'enter' },
    });

    const spans = [
      own,
      phaseSpan,
      span('child', 105, 200, { traceId: 'trace-app', parentSpanId: 'p1' }),
      span('traced', 150, 250, { traceId: 'trace-app', parentSpanId: 'click' }),
      span('during', 120, undefined),
      span('parse', 190, 199, {
        traceId: 'trace-during',
        parentSpanId: 'during',
      }),
      span('before', 0, 50),
    ];

    const joined = joinSpans([users], spans, placing).get(1) ?? [];

    expect(joined.map((bar) => [bar.name, bar.relation])).toEqual([
      ['child', 'child'],
      ['traced', 'trace'],
      ['during', 'during'],
    ]);
    expect(names(joined[2].children)).toEqual(['parse']);
    expect(joined[2]).toMatchObject({ running: true, end: 1000 });
  });

  // What ui-router-otel sends with activateResolveSpans: the app's fetch under the router's resolve span.
  it("joins an app span under the router's resolve span as a child, not as during", () => {
    const spans = [
      routerSpan(users, 'r1'),
      span('rs', 101, 250, {
        traceId: 'trace-r1',
        parentSpanId: 'r1',
        attributes: { 'uirouter.resolve': 'users', 'uirouter.state': 'users' },
      }),
      span('fetch', 102, 240, { traceId: 'trace-r1', parentSpanId: 'rs' }),
    ];

    expect(
      joinSpans([users], spans, placing)
        .get(1)
        ?.map((bar) => [bar.name, bar.relation]),
    ).toEqual([['fetch', 'child']]);
  });

  it("leaves a child of another transition's router span to that transition", () => {
    const spans = [
      routerSpan(users, 'r1'),
      routerSpan(roles, 'r2'),
      span('fetch', 410, 450, { traceId: 'trace-r2', parentSpanId: 'r2' }),
    ];

    expect(joinSpans([users], spans, placing).size).toBe(0);
    expect(joinSpans([roles], spans, placing).get(2)?.[0]?.relation).toBe(
      'child',
    );
  });

  it('places spans on the axis, which reaches back to the earliest', () => {
    const { roots, zero } = waterfall(
      input(txs, 1, { spans: [span('early', 90, 110)] }),
    );

    expect(zero).toBe(90);
    expect(roots[0].children[0]).toMatchObject({
      kind: 'span',
      relation: 'during',
      start: 90,
      end: 110,
    });
  });
});

describe('rows, ticks and the span buffer', () => {
  it('walks bars depth first and leaves out the children of a collapsed one', () => {
    const leaf = (key: string, children: Bar[] = []): Bar => ({
      key,
      kind: 'span',
      tx: 1,
      name: key,
      state: null,
      start: 0,
      end: 1,
      running: false,
      fault: false,
      note: null,
      children,
    });

    const roots = [leaf('a', [leaf('b', [leaf('c')]), leaf('d')])];

    expect(
      rowsOf(roots, new Set()).map((row) => [
        row.bar.key,
        row.level,
        row.posinset,
        row.setsize,
        row.expanded,
      ]),
    ).toEqual([
      ['a', 1, 1, 1, true],
      ['b', 2, 1, 2, true],
      ['c', 3, 1, 1, null],
      ['d', 2, 2, 2, null],
    ]);
    expect(rowsOf(roots, new Set(['b'])).map((row) => row.bar.key)).toEqual([
      'a',
      'b',
      'd',
    ]);
  });

  it('steps gridlines by 1, 2, 2.5 or 5 of a power of ten', () => {
    expect(ticks(235)).toEqual([0, 50, 100, 150, 200]);
    expect(ticks(5.5)).toEqual([0, 2, 4]);
    expect(ticks(0.4)).toEqual([0, 0.1, 0.2, 0.3, 0.4]);
  });

  it('replaces a span by id and drops the oldest past the limit', () => {
    const spans = new Map<string, SpanRecord>();

    upsertSpan(spans, span('a', 0, undefined), 2);
    upsertSpan(spans, span('b', 1, 2), 2);
    upsertSpan(spans, span('a', 0, 3), 2);
    upsertSpan(spans, span('c', 4, 5), 2);

    expect([...spans.keys()]).toEqual(['a', 'c']);
    expect(spans.get('a')?.endTime).toBe(ORIGIN + 3);
  });

  it('keeps for a session file the spans that overlap a transition', () => {
    const txs = txsOf([start(1, 100, 'users'), result(1, 300, 'success')]);

    const kept = spansDuring(
      [
        span('in', 150, 160),
        span('out', 400, 500),
        span('open', 250, undefined),
      ],
      txs,
      ORIGIN,
      1000,
    );

    expect(kept.map((each) => each.spanId)).toEqual(['in', 'open']);
  });
});
