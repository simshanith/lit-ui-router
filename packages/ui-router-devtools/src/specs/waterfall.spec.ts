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
    expect(before.time!.end - before.time!.start).toBeCloseTo(0.2);
    expect(users.time!.end - users.time!.start).toBeCloseTo(388.9);
    expect(roles).toMatchObject({ time: null, note: 'cached' });
  });

  it('lists the declared resolves untimed when the session did not time them', () => {
    const untimed = events.filter((event) => event.type !== 'resolve');

    const { roots } = waterfall(
      input(txsOf(untimed), 1, { timeResolves: false }),
    );

    expect(
      roots[0].children
        .filter((bar) => bar.kind === 'resolve')
        .map((bar) => [bar.name, bar.time, bar.note]),
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

    expect(roots[0]).toMatchObject({
      running: true,
      time: { end: 600 },
      note: null,
    });
    expect(enter).toMatchObject({
      running: true,
      time: { end: 600 },
      note: null,
    });
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
      time: { end: 1 },
      note: 'cut short',
    });
  });

  // Core makes a Transition to the abstract root state and rejects it as invalid.
  it('names a transition to the root state', () => {
    const txs = txsOf([start(5, 0, ''), result(5, 1, 'error')]);

    expect(waterfall(input(txs, 5)).roots[0]).toMatchObject({
      name: '(root)',
      state: '',
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

describe('a session the recorder did not write whole', () => {
  // Two recordings joined into one file repeat ids, and their redirect links can then close a loop.
  it('draws a redirect loop in a file that repeats a transition id once round, and stops', () => {
    const txs = txsOf([
      start(1, 0, 'a'),
      start(2, 1, 'b', { redirectedFrom: 1 }),
      start(1, 2, 'a', { redirectedFrom: 2 }),
    ]);

    expect(chainOf(txs, txs[0]).map((tx) => tx.id)).toEqual([2, 1]);
  });

  it('stops walking back when repeated ids close a loop that leaves the chosen transition out', () => {
    const txs = txsOf([
      start(2, 0, 'a'),
      start(3, 1, 'b', { redirectedFrom: 2 }),
      start(2, 2, 'a', { redirectedFrom: 3 }),
    ]);

    const last = txs[txs.length - 1];

    expect(chainOf(txs, last).map((tx) => tx.id)).toEqual([2, 3]);
  });

  it('says only redirected or superseded when the transition that took over is not in the session', () => {
    const txs = txsOf([
      start(1, 0, 'a'),
      result(1, 1, 'redirected'),
      start(2, 2, 'b'),
      result(2, 3, 'superseded'),
    ]);

    expect(waterfall(input(txs, 1)).roots.map((bar) => bar.note)).toEqual([
      'redirected',
    ]);
    expect(waterfall(input(txs, 2)).roots[0].note).toBe('superseded');
  });

  it('stops a chain at a successor the ring buffer dropped', () => {
    const txs = txsOf([start(1, 0, 'a'), result(1, 1, 'redirected')]);

    txs[0] = { ...txs[0], successor: 9 };

    expect(chainOf(txs, txs[0]).map((tx) => tx.id)).toEqual([1]);
  });

  it('leaves out a phase whose start it never read, and the untimed resolves of a state it has no snapshot of', () => {
    const txs = txsOf([
      start(1, 0, 'ghost'),
      phase(1, 1, 'enter', 'end', 'ghost'),
      result(1, 2, 'success'),
    ]);

    expect(
      waterfall(input(txs, 1, { timeResolves: false })).roots[0].children,
    ).toEqual([]);
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

    const joined = joinSpans([users], spans, placing).bars.get(1) ?? [];

    expect(joined.map((bar) => [bar.name, bar.relation])).toEqual([
      ['child', 'child'],
      ['traced', 'trace'],
      ['during', 'during'],
    ]);
    expect(names(joined[2].children)).toEqual(['parse']);
    expect(joined[2]).toMatchObject({ running: true, time: { end: 1000 } });
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
        .bars.get(1)
        ?.map((bar) => [bar.name, bar.relation]),
    ).toEqual([['fetch', 'child']]);
  });

  it('joins a child of an ambiguous router span by time, as during', () => {
    const own = routerSpan(users, 'r1');
    const twin = { ...own, spanId: 'r3' };

    const spans = [
      own,
      twin,
      span('rs', 101, 250, {
        traceId: 'trace-r1',
        parentSpanId: 'r1',
        attributes: { 'uirouter.resolve': 'users', 'uirouter.state': 'users' },
      }),
      span('fetch', 102, 240, { traceId: 'trace-r1', parentSpanId: 'rs' }),
      span('twin fetch', 103, 200, { traceId: 'trace-r1', parentSpanId: 'r3' }),
    ];

    expect(
      joinSpans([users], spans, placing)
        .bars.get(1)
        ?.map((bar) => [bar.name, bar.relation]),
    ).toEqual([
      ['fetch', 'during'],
      ['twin fetch', 'during'],
    ]);
  });

  it("leaves a child of another transition's router span to that transition", () => {
    const spans = [
      routerSpan(users, 'r1'),
      routerSpan(roles, 'r2'),
      span('fetch', 410, 450, { traceId: 'trace-r2', parentSpanId: 'r2' }),
    ];

    expect(joinSpans([users], spans, placing).bars.size).toBe(0);
    expect(joinSpans([roles], spans, placing).bars.get(2)?.[0]?.relation).toBe(
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
      time: { start: 90, end: 110 },
    });
  });
});

describe('resolve rows timed by the router’s resolve spans', () => {
  const txs = txsOf([start(1, 100, 'users'), result(1, 300, 'success')]);
  const [users] = txs;

  // What ui-router-otel sends with activateResolveSpans: a resolve span under the transition's span.
  const resolveSpan = (more: Partial<SpanRecord> = {}) =>
    span('rs', 105, 250, {
      traceId: 'trace-r1',
      parentSpanId: 'r1',
      attributes: { 'uirouter.resolve': 'users', 'uirouter.state': 'users' },
      ...more,
    });

  const resolves = (spans: SpanRecord[], events = txs) =>
    waterfall(input(events, 1, { timeResolves: false, spans }))
      .roots[0].children.filter((bar) => bar.kind === 'resolve')
      .map((bar) => [bar.name, bar.time, bar.note, bar.fault]);

  it('times a declared resolve from its span when no event timed it, and lists the rest untimed', () => {
    expect(resolves([routerSpan(users, 'r1'), resolveSpan()])).toEqual([
      ['resolve users', { start: 105, end: 250 }, null, false],
      ['resolve roles', null, 'untimed', false],
    ]);
  });

  it('marks a failed resolve span, and grows a running one to the clock', () => {
    expect(
      resolves([routerSpan(users, 'r1'), resolveSpan({ status: 'error' })])[0],
    ).toEqual(['resolve users', { start: 105, end: 250 }, 'failed', true]);
    expect(
      resolves([
        routerSpan(users, 'r1'),
        resolveSpan({ endTime: undefined }),
      ])[0],
    ).toEqual(['resolve users', { start: 105, end: 1000 }, null, false]);
  });

  it('takes the recorded resolve event over the span when both time a resolve', () => {
    const recorded = txsOf([
      start(1, 100, 'users'),
      resolve(1, 'users', 'users', 110, 200),
      result(1, 300, 'success'),
    ]);

    expect(
      resolves([routerSpan(users, 'r1'), resolveSpan()], recorded),
    ).toEqual([['resolve users', { start: 110, end: 200 }, null, false]]);
  });

  it('lists every declared resolve untimed when neither an event nor a span timed it', () => {
    expect(resolves([routerSpan(users, 'r1')])).toEqual([
      ['resolve users', null, 'untimed', false],
      ['resolve roles', null, 'untimed', false],
    ]);
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
      time: { start: 0, end: 1 },
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

  // The Timeline sizes its gridline background from the second line.
  it('gives every axis from the shortest a transition has, 0.1 ms, up to minutes at least two lines past zero', () => {
    const lengths = Array.from({ length: 700 }, (_, i) => 0.1 * 1.02 ** i);

    expect(lengths.filter((length) => ticks(length).length < 3)).toEqual([]);
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

  it('keeps for a session file the spans that overlap a transition, a running one up to the clock, and not an invalid target, which ran nothing', () => {
    const txs = txsOf([
      start(1, 100, 'users'),
      result(1, 300, 'success'),
      { ...at(450), type: 'invalid', from: 'users', to: 'typo', toParams: {} },
      start(2, 600, 'roles', { from: 'users' }),
    ]);

    const kept = spansDuring(
      [
        span('in', 150, 160),
        span('out', 400, 500),
        span('open', 250, undefined),
        span('late', 900, 950),
      ],
      txs,
      ORIGIN,
      1000,
    );

    expect(kept.map((each) => each.spanId)).toEqual(['in', 'open', 'late']);
  });
});
