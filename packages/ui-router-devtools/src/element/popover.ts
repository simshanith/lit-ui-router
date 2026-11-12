import type { Point, Rect } from './route.ts';
import type { Size } from './pack.ts';

const GAP = 8;

/** Something the popover should not cover, and how much covering it costs. */
export interface Avoid extends Rect {
  weight: number;
}

const overlap = (a: Rect, b: Rect): number =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

/**
 * Where the inspector popover goes: beside the anchor, level with its top or its bottom, else a corner of the bounds.
 * Of the places inside the bounds it takes the one that covers least of `avoid`, the earliest on a tie.
 */
export const placeBeside = (
  anchor: Rect,
  size: Size,
  bounds: Rect,
  avoid: readonly Avoid[] = [],
): Point => {
  const right = bounds.x + bounds.width - size.width;
  const bottom = bounds.y + bounds.height - size.height;
  const far = { x: Math.max(bounds.x, right), y: Math.max(bounds.y, bottom) };

  const xs = [anchor.x + anchor.width + GAP, anchor.x - GAP - size.width];
  const ys = [anchor.y, anchor.y + anchor.height - size.height];

  const beside = xs.flatMap((x) => ys.map((y) => ({ x, y })));

  const corners = [far.x, bounds.x].flatMap((x) =>
    [far.y, bounds.y].map((y) => ({ x, y })),
  );

  const inside = [...beside, ...corners].filter(
    ({ x, y }) => x >= bounds.x && x <= far.x && y >= bounds.y && y <= far.y,
  );

  // `size` may be a DOMRect, whose fields a spread would miss.
  const cost = ({ x, y }: Point) =>
    avoid.reduce(
      (total, rect) =>
        total +
        rect.weight *
          overlap({ x, y, width: size.width, height: size.height }, rect),
      0,
    );

  return inside.reduce(
    (best, at) => (cost(at) < cost(best) ? at : best),
    inside[0] ?? far,
  );
};
