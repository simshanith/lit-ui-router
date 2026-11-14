import { describe, expect, it } from 'vitest';

import { placeChips } from '../element/chips.ts';
import { route, type Rect, type RouteBox } from '../element/route.ts';

const box = (
  id: string,
  parent: string | null,
  x: number,
  y: number,
  width: number,
  height = 24,
): RouteBox => ({ id, parent, rect: { x, y, width, height }, head: 24 });

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

const SIZE = { width: 20, height: 12 };

describe('placeChips', () => {
  it('sits on the middle of its route', () => {
    const boxes = [box('p', null, 0, 0, 80), box('q', null, 280, 0, 80)];
    const routed = route(boxes, [{ id: '1', from: 'p', to: 'q' }]);
    const [chip] = placeChips(routed, boxes, [{ id: '1', ...SIZE }]);

    expect(chip).toMatchObject({ id: '1', x: 170, y: 6, dir: 0, ...SIZE });
  });

  it('moves along its route to keep clear of another', () => {
    const boxes = [
      box('p', null, 0, 100, 80),
      box('q', null, 280, 100, 80),
      box('r', null, 140, 0, 80),
      box('s', null, 140, 200, 80),
    ];

    const routed = route(boxes, [
      { id: '1', from: 'p', to: 'q' },
      { id: '2', from: 'r', to: 's' },
    ]);

    const chips = placeChips(routed, boxes, [
      { id: '1', ...SIZE },
      { id: '2', ...SIZE },
    ]);

    const crossing = { x: 177, y: 109, width: 6, height: 6 };

    // The two routes cross at their middles, so neither chip sits there, and the chips keep apart.
    expect(chips).toHaveLength(2);
    expect(chips.some((chip) => overlaps(chip, crossing))).toBe(false);
    expect(overlaps(chips[0], chips[1])).toBe(false);
  });

  it('sits beside a stub too short to carry it, clear of both boxes', () => {
    const boxes = [
      box('parent', null, 0, 0, 200, 72),
      box('child', 'parent', 24, 36, 80),
    ];

    const routed = route(boxes, [
      { id: 'down', from: 'parent', to: 'child' },
      { id: 'up', from: 'child', to: 'parent' },
    ]);

    const chips = placeChips(
      routed,
      boxes,
      routed.map(({ id }) => ({ id, ...SIZE })),
    );

    const header = { x: 0, y: 0, width: 200, height: 24 };

    expect(chips).toHaveLength(2);

    for (const chip of chips) {
      expect(overlaps(chip, header)).toBe(false);
      expect(overlaps(chip, boxes[1].rect)).toBe(false);
    }

    // One chip each side of the pair of stubs.
    expect(Math.abs(chips[0].x - chips[1].x)).toBeGreaterThanOrEqual(
      SIZE.width + 12,
    );
  });

  it('leaves a chip out when it has no clear place', () => {
    const boxes = [box('p', null, 0, 0, 80), box('q', null, 92, 0, 80)];
    const routed = route(boxes, [{ id: '1', from: 'p', to: 'q' }]);

    expect(
      placeChips(routed, boxes, [{ id: '1', width: 120, height: 40 }]),
    ).toEqual([]);
  });
});
