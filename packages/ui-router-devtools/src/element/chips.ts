// Places the Map's count chips: routes and boxes in, a place per chip out. It reads no DOM.
import type { Size } from './pack.ts';
import type { Point, Rect, RouteBox, Routed } from './route.ts';

export interface ChipWant extends Size {
  /** The route the chip belongs to. */
  id: string;
}

export interface Chip extends Rect {
  id: string;
  /** The way the route travels where the chip sits: 0 east, 1 south, 2 west, 3 north. */
  dir: number;
}

/** The line left showing between a chip and the end of the segment it sits on. */
const SHOW = 4;

/** An arrowhead and room beside it, kept clear at a route's ends. */
const HEAD = 10;

const STEP = 4;

/** Half the width of the halo an edge is drawn on. */
const HALO = 3;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

const grown = ({ x, y, width, height }: Rect, by: number): Rect => ({
  x: x - by,
  y: y - by,
  width: width + by * 2,
  height: height + by * 2,
});

// What a chip may not cover: a leaf, a compound's header row and its border. The room inside a compound is free.
const solids = (boxes: readonly RouteBox[]): Rect[] =>
  boxes.flatMap(({ rect, head }) => {
    const { x, y, width, height } = rect;

    if (height <= head + 1) return [rect];

    return [
      { x, y, width, height: head },
      { x: x - 1, y, width: 2, height },
      { x: x + width - 1, y, width: 2, height },
      { x, y: y + height - 1, width, height: 2 },
    ];
  });

const segmentsOf = ({ points }: Routed): Rect[] =>
  points.slice(1).map((b, index) => {
    const a = points[index];

    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    };
  });

const dirOf = (a: Point, b: Point): number => {
  if (a.y === b.y) return b.x >= a.x ? 0 : 2;

  return b.y >= a.y ? 1 : 3;
};

interface Spot {
  centre: Point;
  dir: number;
  /** How far the spot is from the middle of the route, along it. */
  off: number;
  /** The chip sits beside the line, not on it. */
  beside: boolean;
}

// Places on the line, a step apart, wherever a segment is long enough to show past the chip at both ends.
const onLine = ({ points, tail }: Routed, size: Size): Spot[] => {
  const lengths = points
    .slice(1)
    .map((b, i) => Math.abs(b.x - points[i].x) + Math.abs(b.y - points[i].y));

  const half = lengths.reduce((total, length) => total + length, 0) / 2;
  const spots: Spot[] = [];
  let before = 0;

  lengths.forEach((length, index) => {
    const a = points[index];
    const b = points[index + 1];
    const dir = dirOf(a, b);
    const span = (dir % 2 ? size.height : size.width) / 2 + SHOW;
    const first = span + (index === 0 && tail ? HEAD : 0);
    const last = length - span - (index === lengths.length - 1 ? HEAD : 0);

    // The steps are counted from the middle of the route, so a chip that can sit there does.
    const offset = (((half - before - first) % STEP) + STEP) % STEP;

    for (let at = first + offset; at <= last; at += STEP)
      spots.push({
        centre: {
          x: a.x + ((b.x - a.x) / length) * at,
          y: a.y + ((b.y - a.y) / length) * at,
        },
        dir,
        off: Math.abs(before + at - half),
        beside: false,
      });

    before += length;
  });

  return spots.toSorted((a, b) => a.off - b.off);
};

// Places beside the middle of each segment, for a route too short to carry its chip.
const besideLine = ({ points }: Routed, size: Size): Spot[] =>
  points.slice(1).flatMap((b, index) => {
    const a = points[index];
    const dir = dirOf(a, b);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // The chip meets the line's halo, so nothing shows between them.
    const away = (dir % 2 ? size.width : size.height) / 2 + HALO;

    return [-1, 1].map((sign) => ({
      centre:
        dir % 2
          ? { x: mid.x + sign * away, y: mid.y }
          : { x: mid.x, y: mid.y + sign * away },
      dir,
      off: 0,
      beside: true,
    }));
  });

/**
 * A place for each wanted chip: on its route as near the middle as leaves it clear of every box, every other route
 * and every other chip, else beside the route. A chip with no clear place is left out.
 */
export const placeChips = (
  routed: readonly Routed[],
  boxes: readonly RouteBox[],
  wants: readonly ChipWant[],
): Chip[] => {
  const blocked = solids(boxes);
  const lines = new Map(routed.map((r) => [r.id, segmentsOf(r)]));
  const chips: Chip[] = [];

  for (const want of wants) {
    const own = routed.find((r) => r.id === want.id);

    if (!own) continue;

    const others = [...lines].flatMap(([id, segments]) =>
      id === want.id ? [] : segments.map((segment) => grown(segment, 3)),
    );

    const rectAt = ({ centre }: Spot): Rect => ({
      // A hairline's coordinates sit mid-pixel; the chip keeps to whole ones.
      x: Math.floor(centre.x - want.width / 2 + 0.25),
      y: Math.floor(centre.y - want.height / 2 + 0.25),
      width: want.width,
      height: want.height,
    });

    const clear = (spot: Spot): boolean => {
      const rect = rectAt(spot);

      return ![
        ...blocked,
        ...others,
        ...chips.map((chip) => grown(chip, 2)),
        ...(spot.beside ? (lines.get(want.id) ?? []) : []),
      ].some((other) => overlaps(rect, other));
    };

    const spot = [...onLine(own, want), ...besideLine(own, want)].find(clear);

    if (spot) chips.push({ id: want.id, dir: spot.dir, ...rectAt(spot) });
  }

  return chips;
};
