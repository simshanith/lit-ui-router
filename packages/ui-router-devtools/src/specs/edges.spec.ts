import { expect, it } from 'vitest';

import { edgeWeight, observedEdges } from '../edges.ts';
import type { Outcome, RouterEvent, StateInfo } from '../schema.ts';

const state = (name: string): StateInfo => ({
  name,
  parent: null,
  url: null,
  params: [],
  resolves: [],
  future: false,
  abstract: false,
  redirects: false,
});

const options = {
  source: 'unknown',
  location: true,
  reload: false,
  inherit: true,
  supercede: true,
} as const;

let clock = 0;

const tx = (
  id: number,
  from: string,
  to: string,
  outcome?: Outcome,
): RouterEvent[] => [
  {
    v: 1,
    seq: ++clock,
    t: clock,
    type: 'transition',
    id,
    from,
    to,
    fromParams: {},
    toParams: {},
    entering: [to],
    exiting: from ? [from] : [],
    retained: [],
    redirectedFrom: null,
    options,
    dynamic: false,
  },
  ...(outcome
    ? [{ v: 1, seq: ++clock, t: clock, type: 'result', id, outcome } as const]
    : []),
];

const session = (...events: RouterEvent[][]) => ({
  events: [
    {
      v: 1,
      seq: 0,
      t: 0,
      type: 'states',
      states: [state('a'), state('b'), state('c')],
    },
    ...events.flat(),
  ] satisfies RouterEvent[],
});

it('aggregates transitions per ordered pair, with outcomes and ids', () => {
  const edges = observedEdges(
    session(
      tx(0, '', 'a', 'success'),
      tx(1, 'a', 'b', 'success'),
      tx(2, 'b', 'a', 'success'),
      tx(3, 'a', 'b', 'error'),
      tx(4, 'a', 'b', 'success'),
      tx(5, 'b', 'b', 'success'),
      tx(6, 'b', 'c'),
    ),
  );

  expect(edges).toEqual([
    { from: '', to: 'a', count: 1, outcomes: { success: 1 }, ids: [0] },
    {
      from: 'a',
      to: 'b',
      count: 3,
      outcomes: { success: 2, error: 1 },
      ids: [1, 3, 4],
    },
    { from: 'b', to: 'a', count: 1, outcomes: { success: 1 }, ids: [2] },
    { from: 'b', to: 'b', count: 1, outcomes: { success: 1 }, ids: [5] },
    { from: 'b', to: 'c', count: 1, outcomes: { running: 1 }, ids: [6] },
  ]);
});

it('has no edge for a target that names no state', () => {
  const model = session(tx(0, 'a', 'missing', 'error'));

  expect(observedEdges(model)).toEqual([]);
});

it('counts an invalid target against no pair', () => {
  const model = {
    events: [
      { v: 1, seq: 1, t: 0, type: 'states', states: [state('a')] },
      {
        v: 1,
        seq: 2,
        t: 1,
        type: 'invalid',
        from: 'a',
        to: 'nowhere',
        toParams: {},
      },
    ] satisfies RouterEvent[],
  };

  expect(observedEdges(model)).toEqual([]);
});

it('weighs a line by its count', () => {
  expect([1, 2, 3, 4, 9].map(edgeWeight)).toEqual([1, 2, 2, 3, 3]);
});
