import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  wiresFor,
  type Point,
  type Wire,
  type WireEnds,
} from '../theme/components/annotation-wires.ts';

const GAP_START = 600;

const CARD_LEFT = 656;

/** Regions leaving the code at `ys`, beside a rail of cards stacked from `top`, each `height` tall and 12 apart. */
const layout = (ys: number[], top: number, height: number): WireEnds[] =>
  ys.map((y, index) => ({
    from: { x: 400 + index * 20, y },
    card: {
      left: CARD_LEFT,
      top: top + index * (height + 12),
      bottom: top + index * (height + 12) + height,
    },
  }));

type Segment = [Point, Point];

// The corners are rounded in the drawing; the straight runs between them are what can cross.
const segments = ({ from, to, lane }: Wire): Segment[] =>
  lane === undefined
    ? [[from, to]]
    : [
        [from, { x: lane, y: from.y }],
        [
          { x: lane, y: from.y },
          { x: lane, y: to.y },
        ],
        [{ x: lane, y: to.y }, to],
      ];

const between = (value: number, a: number, b: number) =>
  value > Math.min(a, b) && value < Math.max(a, b);

/** Whether a level run and an upright one cross, away from their ends. */
const cross = ([a, b]: Segment, [c, d]: Segment): boolean => {
  const level = (p: Point, q: Point) => p.y === q.y;

  if (level(a, b) === level(c, d)) return false;

  const [[h1, h2], [v1, v2]] = level(a, b)
    ? [
        [a, b],
        [c, d],
      ]
    : [
        [c, d],
        [a, b],
      ];

  return between(v1.x, h1.x, h2.x) && between(h1.y, v1.y, v2.y);
};

function crossings(wires: Wire[]): number {
  let count = 0;

  wires.forEach((wire, index) => {
    for (const other of wires.slice(index + 1))
      for (const one of segments(wire))
        for (const two of segments(other)) if (cross(one, two)) count += 1;
  });

  return count;
}

describe("the home listing's connectors", () => {
  it('run level where a region is beside its card', () => {
    const [wire] = wiresFor(layout([150], 100, 120), GAP_START);

    assert.equal(wire.lane, undefined);
    assert.equal(wire.d, `M400 150H${CARD_LEFT}`);
    assert.deepEqual(wire.to, { x: CARD_LEFT, y: 150 });
  });

  it('bend once, in the gap, to a card above or below, and land clear of its corner', () => {
    const [down] = wiresFor(layout([40], 100, 120), GAP_START);
    const [up] = wiresFor(layout([400], 100, 120), GAP_START);

    assert.equal(down.to.y, 118);
    assert.equal(up.to.y, 202);

    for (const { lane, d } of [down, up]) {
      assert.ok(lane !== undefined && lane > GAP_START && lane < CARD_LEFT);
      assert.equal(d.split('V').length, 2);
    }
  });

  it('give each bend its own lane, on the half pixel', () => {
    const wires = wiresFor(layout([40, 62, 84, 106], 200, 100), GAP_START);
    const lanes = wires.map(({ lane }) => lane);

    assert.equal(new Set(lanes).size, wires.length);

    for (const lane of lanes) assert.ok(Number.isInteger((lane ?? 0.25) * 2));
  });

  // The rail's cards are taller than the code's lines, so they drift below their regions; a short rail drifts above.
  for (const [name, pairs] of [
    ['cards below their regions', layout([40, 62, 84, 300, 322], 150, 110)],
    ['cards above their regions', layout([500, 522, 544, 700, 722], 20, 80)],
    [
      'a rail that drifts below, then level',
      layout([90, 112, 212, 466, 488], 0, 118),
    ],
    [
      'a short rail under a long listing',
      layout([40, 300, 560, 820, 1080], 0, 100),
    ],
    ['regions on neighbouring lines', layout([40, 62, 84, 106, 128], 0, 140)],
  ] as const) {
    it(`never cross with ${name}`, () => {
      const wires = wiresFor(pairs, GAP_START);

      assert.equal(wires.length, pairs.length);
      assert.equal(crossings(wires), 0);
    });
  }
});
