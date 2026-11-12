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

  it('draws a fixed loop when both ends are one box', () => {
    const edge = only(
      route(BOXES, [{ id: '1', from: 'a', to: 'a', fromStub: true }]),
    );

    const a = rectOf('a');
    expect(edge.kind).toBe('loop');
    expect(Math.abs(edge.points[0].x - a.x - a.width)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(edge.points.at(-1)!.x - a.x - a.width)).toBeLessThanOrEqual(
      0.5,
    );
    expect(edge.head.angle).toBe(180);
    expect(edge.caps).toHaveLength(1);
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
