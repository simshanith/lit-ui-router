import { describe, expect, it } from 'vitest';

import {
  route,
  visibleEnd,
  type Point,
  type Rect,
  type RouteBox,
  type Routed,
} from '../element/route.ts';

const box = (
  id: string,
  parent: string | null,
  x: number,
  y: number,
  width: number,
  height = 24,
): RouteBox => ({ id, parent, rect: { x, y, width, height }, head: 24 });

// root > a, x > x1, c > (d, e > f): a leaf, an unrelated container, then a nest two levels deeper.
const BOXES: RouteBox[] = [
  box('root', null, 0, 0, 640, 300),
  box('a', 'root', 20, 60, 80),
  box('x', 'root', 160, 40, 120, 200),
  box('x1', 'x', 180, 80, 80),
  box('c', 'root', 340, 40, 280, 240),
  box('d', 'c', 360, 80, 80),
  box('e', 'c', 360, 130, 240, 130),
  box('f', 'e', 400, 190, 80),
];

const header = (id: string): Rect => {
  const { rect, head } = BOXES.find((b) => b.id === id)!;

  return { ...rect, height: head };
};

const rectOf = (id: string): Rect => BOXES.find((b) => b.id === id)!.rect;

// True when an axis-aligned polyline passes through a rect's interior.
const crosses = (points: readonly Point[], rect: Rect): boolean =>
  points.slice(1).some((b, index) => {
    const a = points[index];

    return (
      Math.max(a.x, b.x) > rect.x &&
      Math.min(a.x, b.x) < rect.x + rect.width &&
      Math.max(a.y, b.y) > rect.y &&
      Math.min(a.y, b.y) < rect.y + rect.height
    );
  });

const orthogonal = ({ points }: Routed): boolean =>
  points.slice(1).every((b, index) => {
    const a = points[index];

    return Math.abs(a.x - b.x) < 1e-9 || Math.abs(a.y - b.y) < 1e-9;
  });

const only = (routed: Routed[]): Routed => {
  expect(routed).toHaveLength(1);

  return routed[0];
};

describe('route', () => {
  it('joins a parent to its own descendant from inside the parent', () => {
    const edge = only(route(BOXES, [{ id: '1', from: 'c', to: 'f' }]));

    expect(edge.kind).toBe('route');
    expect(orthogonal(edge)).toBe(true);
    expect(crosses(edge.points, header('c'))).toBe(false);
    expect(crosses(edge.points, header('e'))).toBe(false);
    expect(crosses(edge.points, rectOf('d'))).toBe(false);

    const start = edge.points[0];
    const c = rectOf('c');
    expect(start.x).toBeGreaterThanOrEqual(c.x);
    expect(start.x).toBeLessThanOrEqual(c.x + c.width + 1);
    expect(start.y).toBeGreaterThanOrEqual(c.y);
    expect(start.y).toBeLessThanOrEqual(c.y + c.height + 1);
  });

  it('routes the reverse, a descendant to its ancestor', () => {
    const edge = only(route(BOXES, [{ id: '1', from: 'f', to: 'c' }]));

    expect(edge.kind).toBe('route');
    expect(crosses(edge.points, header('e'))).toBe(false);
  });

  it('goes around an unrelated container between cousins at different depths', () => {
    const edge = only(route(BOXES, [{ id: '1', from: 'a', to: 'f' }]));

    expect(edge.kind).toBe('route');
    expect(orthogonal(edge)).toBe(true);
    expect(crosses(edge.points, rectOf('x'))).toBe(false);
    expect(crosses(edge.points, rectOf('d'))).toBe(false);

    for (const id of ['root', 'c', 'e'])
      expect(crosses(edge.points, header(id))).toBe(false);
  });

  it('keeps opposite edges between one pair distinct and stable', () => {
    const ab = { id: 'ab', from: 'a', to: 'd' };
    const ba = { id: 'ba', from: 'd', to: 'a' };
    const first = route(BOXES, [ab, ba]);
    const again = route([...BOXES].reverse(), [ba, ab]);

    expect(again).toEqual(first);
    expect(first.map((edge) => edge.kind)).toEqual(['route', 'route']);
    expect(first[0].d).not.toBe(first[1].d);

    // No segment of one lies on a segment of the other.
    const lines = (edge: Routed) =>
      edge.points.slice(1).map((b, index) => {
        const a = edge.points[index];

        return a.x === b.x
          ? `x${a.x}:${Math.min(a.y, b.y)}`
          : `y${a.y}:${Math.min(a.x, b.x)}`;
      });

    const shared = lines(first[0]).filter((line) =>
      lines(first[1])
        .map((other) => other.split(':')[0])
        .includes(line.split(':')[0]),
    );

    expect(shared).toEqual([]);
  });

  it('caps an end that stands for a state inside a collapsed box', () => {
    const edge = only(
      route(BOXES, [{ id: '1', from: 'a', to: 'x1', toStub: true }]),
    );

    expect(edge.caps).toHaveLength(1);
    expect(edge.caps[0]).toMatchObject(edge.points.at(-1)!);
  });

  it('draws a loop out of the top and back into the end side when both ends are one box', () => {
    const edge = only(
      route(BOXES, [{ id: '1', from: 'a', to: 'a', fromStub: true }]),
    );

    const a = rectOf('a');
    const right = a.x + a.width;
    const first = edge.points[0];
    const last = edge.points.at(-1)!;

    expect(edge.kind).toBe('loop');
    expect(Math.abs(first.y - a.y)).toBeLessThanOrEqual(0.5);
    expect(first.x).toBeLessThan(right);
    expect(Math.abs(last.x - right)).toBeLessThanOrEqual(0.5);
    expect(Math.min(...edge.points.map((p) => p.y))).toBeLessThan(a.y - 5);
    expect(Math.max(...edge.points.map((p) => p.x))).toBeGreaterThan(right + 5);
    expect(edge.head.angle).toBe(180);
    expect(edge.caps).toHaveLength(1);
  });

  it('gives a loop the corner that the other edges of its box leave free', () => {
    const routed = route(BOXES, [
      { id: 'loop', from: 'a', to: 'a' },
      { id: 'out', from: 'a', to: 'd' },
    ]);

    const a = rectOf('a');
    const out = routed.find((edge) => edge.id === 'out')!;
    const loop = routed.find((edge) => edge.id === 'loop')!;

    // The edge to the east keeps the side that faces its other end, and the loop takes the west side.
    expect(Math.abs(out.points[0].x - (a.x + a.width))).toBeLessThanOrEqual(
      0.5,
    );
    expect(Math.abs(loop.points.at(-1)!.x - a.x)).toBeLessThanOrEqual(0.5);
    expect(loop.head.angle).toBe(0);
  });

  it('takes the side that faces the other end, and one bend for a diagonal', () => {
    const boxes: RouteBox[] = [
      box('p', null, 0, 0, 80),
      box('q', null, 200, 100, 80),
      box('r', null, 200, 0, 80),
    ];

    const across = only(route(boxes, [{ id: '1', from: 'p', to: 'r' }]));
    const down = only(route(boxes, [{ id: '1', from: 'r', to: 'q' }]));

    const diagonal = only(
      route(boxes.slice(0, 2), [{ id: '1', from: 'p', to: 'q' }]),
    );

    // With r in the way of a lead to the east, the same edge leaves by the bottom.
    const around = only(route(boxes, [{ id: '1', from: 'p', to: 'q' }]));

    expect(across.points).toHaveLength(2);
    expect(across.points[0].x).toBe(80.5);
    expect(down.points).toHaveLength(2);
    expect(down.points[0].y).toBe(24.5);
    // Out of the side that faces q along the longer axis, into the one that faces p along the shorter.
    expect(diagonal.points).toHaveLength(3);
    expect(diagonal.points[0].x).toBe(80.5);
    expect(diagonal.points.at(-1)!.y).toBe(100.5);
    expect(around.points[0].y).toBe(24.5);
    expect(around.points.at(-1)!.x).toBe(200.5);
  });

  it("ends a compound's edge to its child on the header, straight above the child", () => {
    const routed = route(BOXES, [
      { id: 'down', from: 'c', to: 'd' },
      { id: 'up', from: 'd', to: 'c' },
    ]);

    const c = BOXES.find((b) => b.id === 'c')!;
    const d = rectOf('d');
    const under = c.rect.y + c.head;

    for (const edge of routed) {
      const [top, bottom] = edge.points.toSorted((a, b) => a.y - b.y);

      // A straight stub between the header's bottom edge and the child's top.
      expect(edge.kind).toBe('route');
      expect(edge.points).toHaveLength(2);
      expect(top.x).toBe(bottom.x);
      expect(Math.abs(top.y - under)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(bottom.y - d.y)).toBeLessThanOrEqual(0.5);
      expect(top.x).toBeGreaterThan(d.x);
      expect(top.x).toBeLessThan(d.x + d.width);
    }

    // The two directions sit a port's step apart.
    expect(Math.abs(routed[0].points[0].x - routed[1].points[0].x)).toBe(12);
  });

  it("runs a compound's edge to a box deeper inside down a lane beside the branch that holds it", () => {
    const edge = only(route(BOXES, [{ id: '1', from: 'c', to: 'f' }]));
    const c = BOXES.find((b) => b.id === 'c')!;
    const e = rectOf('e');
    const [start] = edge.points;

    expect(edge.kind).toBe('route');
    expect(Math.abs(start.y - (c.rect.y + c.head))).toBeLessThanOrEqual(0.5);
    // Beside e, in the padding between it and c's border, not through e's header.
    expect(start.x).toBeLessThan(e.x);
    expect(start.x).toBeGreaterThan(c.rect.x);
    expect(crosses(edge.points, header('e'))).toBe(false);
  });

  it('budgets ports per side before routing, and spills to the sides beside a full one', () => {
    const boxes: RouteBox[] = [
      box('t', null, 400, 100, 80),
      box('w0', null, 0, 100, 80),
      box('w1', null, 120, 100, 80),
      box('w2', null, 240, 100, 80),
    ];

    const routed = route(
      boxes,
      ['w0', 'w1', 'w2'].map((from) => ({ id: from, from, to: 't' })),
    );

    const ends = routed.map((edge) => edge.points.at(-1)!);
    const west = ends.filter((end) => Math.abs(end.x - 400) < 1);

    // All three sources face the west side; a 24px end holds two ports, a step apart, so the third enters beside it.
    expect(routed.map((edge) => edge.kind)).toEqual(Array(3).fill('route'));
    expect(west).toHaveLength(2);
    expect(Math.abs(west[0].y - west[1].y)).toBe(12);

    for (const a of ends)
      for (const b of ends)
        if (a !== b)
          expect(
            Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
          ).toBeGreaterThanOrEqual(12);
  });

  it('orders the ports on a side by where their edges go, so they do not cross on the way out', () => {
    const boxes: RouteBox[] = [
      box('s', null, 0, 100, 80, 60),
      box('up', null, 200, 0, 80),
      box('level', null, 200, 118, 80),
      box('down', null, 200, 240, 80),
    ];

    const routed = route(
      boxes,
      ['down', 'level', 'up'].map((to) => ({ id: to, from: 's', to })),
    );

    const starts = Object.fromEntries(
      routed.map((edge) => [edge.id, edge.points[0]]),
    );

    expect(starts.up.y).toBeLessThan(starts.level.y);
    expect(starts.level.y).toBeLessThan(starts.down.y);
  });

  it('shares ports as one trunk when every side of a box is full', () => {
    const boxes: RouteBox[] = [
      box('t', null, 200, 200, 24),
      ...Array.from({ length: 12 }, (_, n) =>
        box(`s${n}`, null, (n % 4) * 140, n < 4 ? 0 : n < 8 ? 100 : 400, 40),
      ),
    ];

    const routed = route(
      boxes,
      Array.from({ length: 12 }, (_, n) => ({
        id: `s${String(n).padStart(2, '0')}`,
        from: `s${n}`,
        to: 't',
      })),
    );

    const ports = new Set(
      routed.map((edge) => JSON.stringify(edge.points.at(-1))),
    );

    // A 24px box holds eight ports, so twelve edges share them.
    expect(routed.every((edge) => edge.kind === 'route')).toBe(true);
    expect(ports.size).toBeLessThanOrEqual(8);
    expect(ports.size).toBeGreaterThanOrEqual(4);
  });

  it('draws a head at each end of a line that runs both ways', () => {
    const one = only(route(BOXES, [{ id: '1', from: 'a', to: 'd' }]));

    const both = only(
      route(BOXES, [{ id: '1', from: 'a', to: 'd', both: true }]),
    );

    expect(one.tail).toBeUndefined();
    expect(both.points).toEqual(one.points);
    expect(both.tail).toMatchObject(both.points[0]);
    // The tail points back into the box the line starts from.
    expect(both.tail?.angle).toBe(180);
    expect(both.d).not.toBe(one.d);
  });

  it('gives each end a straight lead, to the middle of a narrow gutter and 12px into open space', () => {
    const row: RouteBox[] = [
      box('p', null, 0, 0, 80),
      box('q', null, 104, 0, 80),
      box('r', null, 0, 120, 80),
    ];

    const beside = only(route(row, [{ id: '1', from: 'p', to: 'q' }]));
    const below = only(route(row, [{ id: '1', from: 'q', to: 'r' }]));

    const leg = (a: Point, b: Point) =>
      Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

    // Facing neighbours 24px apart are joined straight across.
    expect(beside.points).toHaveLength(2);
    expect(leg(below.points[0], below.points[1])).toBeGreaterThanOrEqual(12);
    expect(
      leg(below.points.at(-1)!, below.points.at(-2)!),
    ).toBeGreaterThanOrEqual(12);
  });

  it('keeps a route clear of every border it runs alongside', () => {
    const edges = [
      { id: '1', from: 'a', to: 'f' },
      { id: '2', from: 'f', to: 'a' },
      { id: '3', from: 'd', to: 'x1' },
      { id: '4', from: 'a', to: 'e' },
    ];

    for (const { points, kind } of route(BOXES, edges)) {
      expect(kind).toBe('route');

      // The free segments: every one but the two that meet a box.
      for (let i = 1; i < points.length - 2; i++) {
        const [a, b] = [points[i], points[i + 1]];
        const upright = Math.abs(a.x - b.x) < 1;

        for (const { rect } of BOXES) {
          const [line, from, to] = upright
            ? [a.x, Math.min(a.y, b.y), Math.max(a.y, b.y)]
            : [a.y, Math.min(a.x, b.x), Math.max(a.x, b.x)];

          const [start, size, low, high] = upright
            ? [rect.y, rect.height, rect.x, rect.x + rect.width]
            : [rect.x, rect.width, rect.y, rect.y + rect.height];

          if (to <= start || from >= start + size) continue;

          for (const border of [low, high])
            expect(Math.abs(line - border)).toBeGreaterThanOrEqual(5.5);
        }
      }
    }
  });

  it('centres a route in the gutter between two boxes', () => {
    const boxes: RouteBox[] = [
      box('p', null, 0, 0, 80),
      box('wall', null, -400, 60, 700, 40),
      box('q', null, 336, 60, 80, 40),
      box('r', null, 0, 160, 80),
    ];

    const edge = only(
      route(boxes, [{ id: '1', from: 'p', to: 'r', width: 2 }]),
    );

    const down = edge.points.find(
      (point, index) =>
        index > 0 && point.x === edge.points[index - 1].x && point.x > 300,
    );

    // The only way down is the 36px gutter between the wall and q; the route takes its midline.
    expect(down?.x).toBe(318);
  });

  it('spreads ports a step apart and sends the overflow to another side', () => {
    const boxes: RouteBox[] = [
      box('t', null, 200, 100, 80),
      box('s1', null, 0, 40, 80),
      box('s2', null, 0, 100, 80),
      box('s3', null, 0, 160, 80),
    ];

    const routed = route(
      boxes,
      ['s1', 's2', 's3'].map((from) => ({ id: from, from, to: 't' })),
    );

    const ends = routed.map((edge) => edge.points.at(-1)!);
    const west = ends.filter((end) => Math.abs(end.x - 200) < 1);

    // A 24px side holds two ports; the third edge enters by the top or the bottom.
    expect(west.length).toBeLessThanOrEqual(2);

    for (const a of ends)
      for (const b of ends)
        if (a !== b)
          expect(
            Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
          ).toBeGreaterThanOrEqual(12);
  });

  it('flags a straight fallback when no route exists', () => {
    const walled: RouteBox[] = [
      box('s', null, 0, 0, 40),
      box('t', null, 200, 100, 60),
      box('n', null, 190, 92, 80, 4),
      box('e', null, 264, 92, 4, 40),
      box('so', null, 190, 128, 80, 4),
      box('w', null, 192, 92, 4, 40),
    ];

    const edge = only(route(walled, [{ id: '1', from: 's', to: 't' }]));

    expect(edge.kind).toBe('fallback');
    expect(edge.points).toHaveLength(2);
  });

  it('snaps a hairline to the middle of a device pixel', () => {
    const edge = only(route(BOXES, [{ id: '1', from: 'a', to: 'd' }]));

    const heavy = only(
      route(BOXES, [{ id: '1', from: 'a', to: 'd', width: 2 }]),
    );

    for (const { x, y } of edge.points)
      expect([x % 1, y % 1]).toEqual([0.5, 0.5]);

    for (const { x, y } of heavy.points) expect([x % 1, y % 1]).toEqual([0, 0]);
  });

  it('skips an edge whose end is not drawn', () => {
    expect(route(BOXES, [{ id: '1', from: 'a', to: 'gone' }])).toEqual([]);
  });
});

describe('visibleEnd', () => {
  const parents = new Map<string, string | null>([
    ['app', null],
    ['app.contacts', 'app'],
    ['app.contacts.contact', 'app.contacts'],
  ]);

  const parentOf = (name: string) => parents.get(name);

  it('keeps a drawn state', () => {
    expect(visibleEnd('app.contacts', parentOf, () => true)).toEqual({
      id: 'app.contacts',
      stub: false,
    });
  });

  it('stands a hidden state in for by its nearest drawn ancestor', () => {
    expect(
      visibleEnd(
        'app.contacts.contact',
        parentOf,
        (name) => name !== 'app.contacts.contact',
      ),
    ).toEqual({ id: 'app.contacts', stub: true });
  });

  it('has no end when nothing on the path is drawn', () => {
    expect(visibleEnd('app', parentOf, () => false)).toBeUndefined();
  });
});
