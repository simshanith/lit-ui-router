// The connectors the home listing draws from each code region to its card: pure geometry, so the page only measures.

/** A point in the drawing's own pixels. */
export interface Point {
  x: number;
  y: number;
}

/** What one connector joins: where it leaves the code, and the card whose near edge it lands on. */
export interface WireEnds {
  from: Point;
  card: { left: number; top: number; bottom: number };
}

/** A connector as drawn: its path, the ends its dots sit on, and the lane it turns in when it bends. */
export interface Wire {
  d: string;
  from: Point;
  to: Point;
  lane?: number;
}

/** The radius of a bend's corner. */
const BEND = 4;

/** How far from a card's corner a connector may land. */
const INSET = 18;

/** The distance between the lanes of neighbouring bends. */
const LANE = 8;

// Half pixels, so a 1.5px stroke stays sharp.
const snap = (value: number) => Math.round(value * 2) / 2;

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), Math.max(low, high));

function pathOf(from: Point, to: Point, lane: number | undefined): string {
  if (lane === undefined) return `M${from.x} ${from.y}H${to.x}`;

  const turn = Math.sign(to.y - from.y) * BEND;

  return [
    `M${from.x} ${from.y}H${lane - BEND}`,
    `Q${lane} ${from.y} ${lane} ${from.y + turn}`,
    `V${to.y - turn}`,
    `Q${lane} ${to.y} ${lane + BEND} ${to.y}H${to.x}`,
  ].join('');
}

/**
 * One connector for each pair, given in reading order: the regions run down
 * the code and their cards run down the rail in the same order. A connector
 * runs level where its region is beside its card, and bends once, in the gap
 * right of `gapStart`, where it is not.
 *
 * Each bend turns in a lane of its own. In a run of bends the same way the
 * lanes step across the gap in the one order that keeps the connectors from
 * crossing: toward the code for bends downward, toward the cards for bends
 * upward.
 */
export function wiresFor(pairs: readonly WireEnds[], gapStart: number): Wire[] {
  const ends = pairs.map(({ from, card }) => {
    const start = { x: snap(from.x), y: snap(from.y) };
    const landing = snap(clamp(from.y, card.top + INSET, card.bottom - INSET));
    const bent = Math.abs(landing - start.y) >= 2 * BEND;

    return {
      from: start,
      to: { x: snap(card.left), y: bent ? landing : start.y },
      bent,
      down: landing > start.y,
    };
  });

  const middle = snap((gapStart + Math.min(...ends.map(({ to }) => to.x))) / 2);

  const lanes = new Map<number, number>();
  let run: number[] = [];

  const assign = () => {
    run.forEach((index, place) => {
      const offset = (place - (run.length - 1) / 2) * LANE;

      lanes.set(index, middle + (ends[index].down ? -offset : offset));
    });
    run = [];
  };

  ends.forEach(({ bent, down }, index) => {
    const before = run.at(-1);

    if (!bent || (before !== undefined && ends[before].down !== down)) assign();

    if (bent) run.push(index);
  });
  assign();

  return ends.map(({ from, to }, index) => {
    const lane = lanes.get(index);

    return { from, to, lane, d: pathOf(from, to, lane) };
  });
}
