// The nested Map's orthogonal edge router: rects in, paths out. It reads no DOM.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RouteBox {
  id: string;
  parent: string | null;
  rect: Rect;
  /** The header row's block size; a leaf's is its whole height. */
  head: number;
}

export interface RouteEdge {
  id: string;
  from: string;
  to: string;
  /** Stroke width in CSS pixels, for snapping. */
  width?: number;
  /** The end stands for a state inside a collapsed box. */
  fromStub?: boolean;
  toStub?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Cap extends Point {
  /** The cap is a short bar; `true` when it runs along the block axis. */
  upright: boolean;
}

export interface Routed {
  id: string;
  /** `fallback` is a straight line drawn when no orthogonal route exists. */
  kind: 'route' | 'loop' | 'fallback';
  points: Point[];
  d: string;
  /** The arrowhead's tip and its rotation in degrees, 0 pointing along +x. */
  head: Point & { angle: number };
  caps: Cap[];
}

export interface RouteOptions {
  /** The least clearance between a route and a box edge it runs alongside. */
  margin?: number;
  /** The longest straight lead between a box and an edge's first bend; a narrower gutter gives half its width. */
  lead?: number;
  /** The cost of one bend, in pixels of length. */
  bend?: number;
  /** Corner radius. */
  radius?: number;
  /** Device pixels per CSS pixel, for snapping. */
  dpr?: number;
}

interface Settings {
  margin: number;
  lead: number;
  bend: number;
  radius: number;
  dpr: number;
}

// East, south, west, north: the fixed expansion order.
const DX = [1, 0, -1, 0];

const DY = [0, 1, 0, -1];

/** The least space between two ports on one side: an arrowhead and room beside it. */
const PORT_STEP = 12;

/** Ports keep this far from a side's corners. */
const PORT_INSET = 6;

const NUDGE_STEP = 4;

const HEAD_INSET = 4;

/** A gutter wider than this is open space, where a route keeps its lead instead of the midline. */
const CHANNEL = 48;

const LOOP = 12;

type Side = 0 | 1 | 2 | 3;

const SIDES: readonly Side[] = [0, 1, 2, 3];

const opposite = (dir: number): number => (dir + 2) % 4;

const FACING: readonly Side[] = [2, 3, 0, 1];

interface Port {
  side: Side;
  /** The box is an ancestor of the other end, so the edge meets its border from inside. */
  inner: boolean;
  border: Point;
  /** How far the stub sits from the border. */
  reach: number;
  /** Where the search starts or ends: the border point moved clear of the box. */
  stub: Point;
}

const ancestorsOf = (
  boxes: ReadonlyMap<string, RouteBox>,
  id: string,
): string[] => {
  const chain: string[] = [];

  for (
    let parent = boxes.get(id)?.parent;
    parent && boxes.has(parent) && !chain.includes(parent);
    parent = boxes.get(parent)?.parent
  )
    chain.push(parent);

  return chain;
};

/**
 * The box that stands for a state: itself when drawn, else its nearest drawn ancestor.
 * `stub` says the state itself is hidden inside that box.
 */
export const visibleEnd = (
  name: string,
  parentOf: (name: string) => string | null | undefined,
  drawn: (name: string) => boolean,
): { id: string; stub: boolean } | undefined => {
  const seen = new Set<string>();

  for (
    let at: string | null | undefined = name;
    at != null && !seen.has(at);
    at = parentOf(at)
  ) {
    if (drawn(at)) return { id: at, stub: at !== name };
    seen.add(at);
  }

  return undefined;
};

// How far a box's side is from the nearest border facing it: a neighbour's, or an ancestor's from inside.
const clearance = (
  box: RouteBox,
  side: Side,
  boxes: ReadonlyMap<string, RouteBox>,
): number => {
  const { x, y, width, height } = box.rect;
  const upright = side % 2 === 0;
  const from = [x + width, y + height, x, y][side];
  const sign = side < 2 ? 1 : -1;
  const above = new Set(ancestorsOf(boxes, box.id));
  let clear = Infinity;

  for (const other of boxes.values()) {
    if (other === box) continue;

    const r = other.rect;
    const inside = above.has(other.id);

    const overlaps = upright
      ? r.y < y + height && y < r.y + r.height
      : r.x < x + width && x < r.x + r.width;

    if (!overlaps) continue;

    // An ancestor is met from inside, at its far border or under its header row.
    const far = inside === side < 2;

    const at = upright
      ? r.x + (far ? r.width : 0)
      : inside && side === 3
        ? r.y + other.head
        : r.y + (far ? r.height : 0);

    const gap = (at - from) * sign;

    if (gap >= 0) clear = Math.min(clear, gap);
  }

  return clear;
};

// A lead runs to the middle of a narrow gutter and no further than `lead` into an open one.
const leadOf = (clear: number, { margin, lead }: Settings): number =>
  Math.max(margin, Math.min(lead, Math.floor(clear / 2)));

const portAt = (
  box: RouteBox,
  side: Side,
  inner: boolean,
  offset: number,
  reach: number,
): Port => {
  const { x, y, width, height } = box.rect;
  const top = inner ? y + box.head : y;
  const cx = Math.round(x + width / 2) + offset;
  const cy = Math.round((inner ? top + y + height : y * 2 + height) / 2);

  const border = [
    { x: x + width, y: cy + offset },
    { x: cx, y: y + height },
    { x, y: cy + offset },
    { x: cx, y: top },
  ][side];

  const clear = inner ? -reach : reach;

  return {
    side,
    inner,
    border,
    reach,
    stub: { x: border.x + DX[side] * clear, y: border.y + DY[side] * clear },
  };
};

// The direction of travel through a port: out of a start, into an end.
const travel = (port: Port, start: boolean): number =>
  port.inner === start ? opposite(port.side) : port.side;

// Grid

interface Grid {
  xs: number[];
  ys: number[];
  ix: Map<number, number>;
  iy: Map<number, number>;
}

interface Line {
  at: number;
  /** 1 after a box's far edge, -1 before its near edge, 0 otherwise. */
  kind: number;
}

// Lines sit clear of every box edge, inside every compound, at ports, and midway along each gutter.
const axisLines = (lines: Line[]): number[] => {
  const sorted = lines.toSorted((a, b) => a.at - b.at || b.kind - a.kind);
  const out = new Set<number>();

  sorted.forEach((line, index) => {
    const next = sorted[index + 1];
    out.add(line.at);

    if (next && line.kind === 1 && next.kind === -1 && next.at - line.at >= 2)
      out.add(Math.round((line.at + next.at) / 2));
  });

  return [...out].toSorted((a, b) => a - b);
};

const buildGrid = (
  boxes: readonly RouteBox[],
  ports: readonly Port[],
  margin: number,
): Grid => {
  const xs: Line[] = [];
  const ys: Line[] = [];

  for (const { rect, head } of boxes) {
    const { x, y, width, height } = rect;
    xs.push({ at: x - margin, kind: -1 }, { at: x + width + margin, kind: 1 });
    ys.push({ at: y - margin, kind: -1 }, { at: y + height + margin, kind: 1 });

    if (height <= head + 1) continue;

    xs.push({ at: x + margin, kind: 0 }, { at: x + width - margin, kind: 0 });
    ys.push(
      { at: y + head + margin, kind: 0 },
      { at: y + height - margin, kind: 0 },
    );
  }

  for (const { stub } of ports) {
    xs.push({ at: stub.x, kind: 0 });
    ys.push({ at: stub.y, kind: 0 });
  }

  const gx = axisLines(xs);
  const gy = axisLines(ys);

  return {
    xs: gx,
    ys: gy,
    ix: new Map(gx.map((value, index) => [value, index])),
    iy: new Map(gy.map((value, index) => [value, index])),
  };
};

interface Walls {
  /** `east[j * nx + i]`: the step from column i to i + 1 on row j is blocked. */
  east: Uint8Array;
  /** `south[j * nx + i]`: the step from row j to j + 1 on column i is blocked. */
  south: Uint8Array;
}

// The index range of grid lines strictly inside (low, high), widened by one step on each side.
const reach = (
  lines: number[],
  low: number,
  high: number,
): [number, number] => {
  let first = lines.findIndex((value) => value > low);

  if (first < 0) first = lines.length;

  let last = lines.findLastIndex((value) => value < high);

  if (last < first) last = first - 1;

  return [first, last];
};

const blockRect = (grid: Grid, walls: Walls, rect: Rect): void => {
  const nx = grid.xs.length;
  const [i0, i1] = reach(grid.xs, rect.x - 1, rect.x + rect.width + 1);
  const [j0, j1] = reach(grid.ys, rect.y - 1, rect.y + rect.height + 1);

  for (let j = j0; j <= j1; j++)
    for (let i = Math.max(0, i0 - 1); i <= i1; i++) walls.east[j * nx + i] = 1;

  for (let i = i0; i <= i1; i++)
    for (let j = Math.max(0, j0 - 1); j <= j1; j++) walls.south[j * nx + i] = 1;
};

// Ancestors of either end are transparent, but their header rows still block.
const buildWalls = (
  grid: Grid,
  boxes: readonly RouteBox[],
  through: ReadonlySet<string>,
): Walls => {
  const size = grid.xs.length * grid.ys.length;
  const walls = { east: new Uint8Array(size), south: new Uint8Array(size) };

  for (const box of boxes) {
    const compound = box.rect.height > box.head + 1;

    if (through.has(box.id) && !compound) continue;

    blockRect(
      grid,
      walls,
      through.has(box.id) ? { ...box.rect, height: box.head } : box.rect,
    );
  }

  return walls;
};

// Search

// A bend right at a stub leaves no straight lead; a side with room for one is worth a detour.
const shortfall = (port: Port, lead: number): number =>
  Math.max(0, lead - port.reach) * 4;

interface Heap {
  items: number[];
  /** Orders two entries; negative when the first comes out first. */
  before: (a: number, b: number) => number;
}

const heapPush = (heap: Heap, entry: number): void => {
  const { items, before } = heap;
  let at = items.push(entry) - 1;

  while (at > 0) {
    const parent = (at - 1) >> 1;

    if (before(items[at], items[parent]) >= 0) break;
    [items[at], items[parent]] = [items[parent], items[at]];
    at = parent;
  }
};

const heapPop = (heap: Heap): number | undefined => {
  const { items, before } = heap;
  const top = items[0];
  const last = items.pop();

  if (items.length === 0 || last === undefined) return top;
  items[0] = last;

  for (let at = 0; ;) {
    const left = at * 2 + 1;
    const right = left + 1;
    let least = at;

    if (left < items.length && before(items[left], items[least]) < 0)
      least = left;

    if (right < items.length && before(items[right], items[least]) < 0)
      least = right;

    if (least === at) break;
    [items[at], items[least]] = [items[least], items[at]];
    at = least;
  }

  return top;
};

interface Found {
  start: Port;
  goal: Port;
  points: Point[];
}

interface Search {
  grid: Grid;
  walls: Walls;
  starts: Port[];
  goals: Port[];
  bend: number;
  /** The lead an end should have; a bend nearer the box than this costs the shortfall again. */
  lead: number;
}

const nodeOf = (grid: Grid, point: Point): number | undefined => {
  const i = grid.ix.get(point.x);
  const j = grid.iy.get(point.y);

  return i === undefined || j === undefined
    ? undefined
    : j * grid.xs.length + i;
};

// The neighbouring node in a direction, or -1 at the grid's edge or a wall.
const step = (grid: Grid, walls: Walls, node: number, dir: number): number => {
  const nx = grid.xs.length;
  const i = node % nx;
  const j = (node - i) / nx;

  if (dir === 0) return i + 1 < nx && !walls.east[node] ? node + 1 : -1;

  if (dir === 2) return i > 0 && !walls.east[node - 1] ? node - 1 : -1;

  if (dir === 1)
    return j + 1 < grid.ys.length && !walls.south[node] ? node + nx : -1;

  return j > 0 && !walls.south[node - nx] ? node - nx : -1;
};

// A state is a node and the direction it was entered in; the states past the grid are the goals, one per target port.
interface Frontier {
  search: Search;
  states: number;
  cost: Float64Array;
  bends: Int32Array;
  from: Int32Array;
  queue: { f: number; state: number; g: number }[];
  heap: Heap;
  /** What a bend at each start state costs. */
  short: Map<number, number>;
}

const pointOf = ({ search: { grid } }: Frontier, state: number): Point => {
  const node = state >> 2;
  const i = node % grid.xs.length;

  return { x: grid.xs[i], y: grid.ys[(node - i) / grid.xs.length] };
};

const guess = (frontier: Frontier, state: number): number => {
  if (state >= frontier.states) return 0;

  const at = pointOf(frontier, state);

  return Math.min(
    ...frontier.search.goals.map(
      ({ stub }) => Math.abs(stub.x - at.x) + Math.abs(stub.y - at.y),
    ),
  );
};

const visit = (
  frontier: Frontier,
  state: number,
  g: number,
  turns: number,
  prev: number,
): void => {
  const { cost, bends, from, queue, heap } = frontier;

  if (g > cost[state] || (g === cost[state] && turns >= bends[state])) return;
  cost[state] = g;
  bends[state] = turns;
  from[state] = prev;
  queue.push({ f: g + guess(frontier, state), state, g });
  heapPush(heap, queue.length - 1);
};

const newFrontier = (search: Search): Frontier => {
  const states = search.grid.xs.length * search.grid.ys.length * 4;
  const size = states + search.goals.length;
  const bends = new Int32Array(size);
  const queue: Frontier['queue'] = [];

  return {
    search,
    states,
    cost: new Float64Array(size).fill(Infinity),
    bends,
    from: new Int32Array(size).fill(-1),
    queue,
    short: new Map(),
    // Ties break on fewer bends, then on push order.
    heap: {
      items: [],
      before: (a, b) =>
        queue[a].f - queue[b].f ||
        bends[queue[a].state] - bends[queue[b].state] ||
        a - b,
    },
  };
};

const expand = (frontier: Frontier, state: number, g: number): void => {
  const { grid, walls, goals, bend } = frontier.search;
  const node = state >> 2;
  const dir = state & 3;
  const turns = frontier.bends[state];
  const at = pointOf(frontier, state);

  goals.forEach((goal, index) => {
    const into = travel(goal, false);

    if (nodeOf(grid, goal.stub) !== node || dir === opposite(into)) return;

    const turn = dir === into ? 0 : 1;
    visit(
      frontier,
      frontier.states + index,
      g + turn * (bend + shortfall(goal, frontier.search.lead)),
      turns + turn,
      state,
    );
  });

  for (const next of SIDES) {
    const to = next === opposite(dir) ? -1 : step(grid, walls, node, next);

    if (to < 0) continue;

    const turn = next === dir ? 0 : 1;
    const there = pointOf(frontier, to * 4);
    const length = Math.abs(there.x - at.x) + Math.abs(there.y - at.y);

    const short =
      frontier.from[state] < 0 ? (frontier.short.get(state) ?? 0) : 0;

    visit(
      frontier,
      to * 4 + next,
      g + length + turn * (bend + short),
      turns + turn,
      state,
    );
  }
};

const trace = (frontier: Frontier, goal: number): Found => {
  const { starts, goals } = frontier.search;
  const chain: number[] = [];

  for (let at = frontier.from[goal]; at >= 0; at = frontier.from[at])
    chain.unshift(at);

  const first = pointOf(frontier, chain[0]);

  return {
    start: starts.find(
      (port) =>
        port.stub.x === first.x &&
        port.stub.y === first.y &&
        travel(port, true) === (chain[0] & 3),
    )!,
    goal: goals[goal - frontier.states],
    points: chain.map((state) => pointOf(frontier, state)),
  };
};

// A* over (node, direction): length plus a penalty per bend, and no reversal.
const search = (query: Search): Found | null => {
  const frontier = newFrontier(query);
  const { heap, queue, cost, states } = frontier;

  for (const port of query.starts) {
    const node = nodeOf(query.grid, port.stub);

    if (node === undefined) continue;

    const state = node * 4 + travel(port, true);
    frontier.short.set(state, shortfall(port, query.lead));
    visit(frontier, state, 0, 0, -1);
  }

  for (let entry = heapPop(heap); entry !== undefined; entry = heapPop(heap)) {
    const { state, g } = queue[entry];

    if (g > cost[state]) continue;

    if (state >= states) return trace(frontier, state);
    expand(frontier, state, g);
  }

  return null;
};

// Polylines

const simplify = (points: readonly Point[]): Point[] => {
  const out: Point[] = [];

  for (const point of points) {
    const a = out.at(-2);
    const b = out.at(-1);

    if (b && b.x === point.x && b.y === point.y) continue;

    if (
      a &&
      b &&
      ((a.x === b.x && b.x === point.x) || (a.y === b.y && b.y === point.y))
    )
      out.pop();
    out.push({ ...point });
  }

  return out;
};

interface Segment {
  route: number;
  /** Index of the segment's first point. */
  index: number;
  upright: boolean;
  line: number;
  low: number;
  high: number;
  /** Which side of the shared line the segment keeps to: its right, in the direction of travel. */
  keep: number;
}

// The segments free to move: every one but the two that meet a port.
const innerSegments = (points: Point[], route: number): Segment[] => {
  const segments: Segment[] = [];

  for (let index = 1; index < points.length - 2; index++) {
    const a = points[index];
    const b = points[index + 1];
    const upright = a.x === b.x;

    segments.push({
      route,
      index,
      upright,
      line: upright ? a.x : a.y,
      low: upright ? Math.min(a.y, b.y) : Math.min(a.x, b.x),
      high: upright ? Math.max(a.y, b.y) : Math.max(a.x, b.x),
      keep: upright ? Math.sign(a.y - b.y) : Math.sign(b.x - a.x),
    });
  }

  return segments;
};

const shares = (a: Segment, b: Segment): boolean =>
  a.upright === b.upright &&
  a.line === b.line &&
  a.low < b.high &&
  b.low < a.high;

// Groups segments that overlap on one line, following overlaps transitively.
const clusters = (segments: Segment[]): Segment[][] => {
  const groups: Segment[][] = [];
  const left = new Set(segments);

  for (const seed of segments) {
    if (!left.delete(seed)) continue;

    const group = [seed];

    for (const member of group)
      for (const other of left)
        if (shares(member, other) && left.delete(other)) group.push(other);

    if (group.length > 1) groups.push(group);
  }

  return groups;
};

// Segments that share a line spread across the channel in a fixed order: by side kept, then by route.
const nudge = (routes: Point[][], margin: number): void => {
  const segments = routes.flatMap((points, route) =>
    innerSegments(points, route),
  );

  for (const group of clusters(segments)) {
    group.sort((a, b) => a.keep - b.keep || a.route - b.route);

    const gap = Math.min(
      NUDGE_STEP,
      Math.max(0, margin * 2 - 4) / (group.length - 1),
    );

    group.forEach((segment, order) => {
      const shift = Math.round((order - (group.length - 1) / 2) * gap);
      const points = routes[segment.route];
      const axis = segment.upright ? 'x' : 'y';
      points[segment.index][axis] += shift;
      points[segment.index + 1][axis] += shift;
    });
  }
};

// The borders a segment runs between: the nearest on each side whose box spans any of the segment's length.
const channel = (
  segment: Segment,
  boxes: readonly RouteBox[],
  margin: number,
): [number, number] => {
  let low = -Infinity;
  let high = Infinity;

  for (const { rect, head } of boxes) {
    const [from, size, start, length] = segment.upright
      ? [rect.x, rect.width, rect.y, rect.height]
      : [rect.y, rect.height, rect.x, rect.width];

    if (start > segment.high + margin || start + length < segment.low - margin)
      continue;

    const lines = [from, from + size];

    if (!segment.upright && rect.height > head + 1) lines.push(from + head);

    for (const line of lines) {
      if (line < segment.line) low = Math.max(low, line);
      else if (line > segment.line) high = Math.min(high, line);
    }
  }

  return [low, high];
};

// A free segment moves to the middle of a narrow gutter, and in open space keeps a lead's distance from a border.
const centre = (
  points: Point[],
  boxes: readonly RouteBox[],
  { margin, lead }: Settings,
): Point[] => {
  for (const segment of innerSegments(points, 0)) {
    const [low, high] = channel(segment, boxes, margin);
    const narrow = high - low <= CHANNEL;

    const to = narrow
      ? Math.round((low + high) / 2)
      : Math.min(high - lead, Math.max(low + lead, segment.line));

    const axis = segment.upright ? 'x' : 'y';
    points[segment.index][axis] = to;
    points[segment.index + 1][axis] = to;
  }

  return simplify(points);
};

// Output

// Puts a coordinate on the device-pixel grid: on a pixel boundary for an even stroke, mid-pixel for an odd one.
const snap = (value: number, dpr: number, width: number): number => {
  const device = Math.round(width * dpr) % 2 === 1 ? 0.5 : 0;

  return (Math.round(value * dpr - device) + device) / dpr;
};

const fmt = (value: number): string => String(Math.round(value * 100) / 100);

const pathOf = (points: readonly Point[], radius: number): string => {
  const parts = [`M${fmt(points[0].x)} ${fmt(points[0].y)}`];

  for (let i = 1; i < points.length; i++) {
    const at = points[i];
    const next = points[i + 1];

    if (!next) {
      parts.push(`L${fmt(at.x)} ${fmt(at.y)}`);
      break;
    }

    const prev = points[i - 1];
    const before = Math.hypot(at.x - prev.x, at.y - prev.y);
    const after = Math.hypot(next.x - at.x, next.y - at.y);
    const r = Math.min(radius, before / 2, after / 2);
    const ax = at.x - ((at.x - prev.x) / before) * r;
    const ay = at.y - ((at.y - prev.y) / before) * r;
    const bx = at.x + ((next.x - at.x) / after) * r;
    const by = at.y + ((next.y - at.y) / after) * r;
    parts.push(
      `L${fmt(ax)} ${fmt(ay)}Q${fmt(at.x)} ${fmt(at.y)} ${fmt(bx)} ${fmt(by)}`,
    );
  }

  return parts.join('');
};

const capsOf = (edge: RouteEdge, points: readonly Point[]): Cap[] => {
  const caps: Cap[] = [];
  const first = points[0];
  const last = points.at(-1)!;

  if (edge.fromStub) caps.push({ ...first, upright: first.y === points[1].y });

  if (edge.toStub) caps.push({ ...last, upright: last.y === points.at(-2)!.y });

  return caps;
};

const finish = (
  edge: RouteEdge,
  kind: Routed['kind'],
  raw: readonly Point[],
  settings: Settings,
): Routed => {
  const width = edge.width ?? 1;

  const points = raw.map(({ x, y }) => ({
    x: snap(x, settings.dpr, width),
    y: snap(y, settings.dpr, width),
  }));

  const tip = points.at(-1)!;
  const prev = points.at(-2)!;
  const length = Math.hypot(tip.x - prev.x, tip.y - prev.y) || 1;
  const inset = Math.min(HEAD_INSET, length / 2);

  // The line stops inside the arrowhead, so a heavy stroke never shows past its tip.
  const drawn = [
    ...points.slice(0, -1),
    {
      x: tip.x - ((tip.x - prev.x) / length) * inset,
      y: tip.y - ((tip.y - prev.y) / length) * inset,
    },
  ];

  return {
    id: edge.id,
    kind,
    points,
    d: pathOf(drawn, settings.radius),
    head: {
      ...tip,
      angle: Math.round(
        (Math.atan2(tip.y - prev.y, tip.x - prev.x) * 180) / Math.PI,
      ),
    },
    caps: capsOf(edge, points),
  };
};

// A self-loop is a fixed shape, not a search: out of the top or bottom near a corner and back into the side beside it.
// It takes the end side and the top unless routed edges already use them and the other is free.
const loop = (
  edge: RouteEdge,
  box: RouteBox,
  boxes: ReadonlyMap<string, RouteBox>,
  taken: ReadonlySet<Side>,
  settings: Settings,
): Routed => {
  const { x, y, width, height } = box.rect;
  const west = taken.has(0) && !taken.has(2);
  const south = taken.has(3) && !taken.has(1);
  const sx = west ? -1 : 1;
  const sy = south ? 1 : -1;
  const side = west ? x : x + width;
  const base = south ? y + height : y;

  const out =
    base + sy * leadOf(clearance(box, south ? 1 : 3, boxes), settings);

  const far = side + sx * leadOf(clearance(box, west ? 2 : 0, boxes), settings);
  const half = Math.round(Math.min(box.head, height) / 2);
  const back = south ? y + height - half : y + half;

  return finish(
    edge,
    'loop',
    [
      { x: side - sx * LOOP, y: base },
      { x: side - sx * LOOP, y: out },
      { x: far, y: out },
      { x: far, y: back },
      { x: side, y: back },
    ],
    { ...settings, radius: 6 },
  );
};

const middle = ({ rect }: RouteBox): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

// With no route, a straight line joins the sides that face each other.
const fallback = (
  edge: RouteEdge,
  from: RouteBox,
  to: RouteBox,
  settings: Settings,
): Routed => {
  const a = middle(from);
  const b = middle(to);
  const flat = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const forward = flat ? b.x >= a.x : b.y >= a.y;
  const sides: readonly Side[] = flat ? [0, 2] : [1, 3];
  const side = sides[forward ? 0 : 1];

  return finish(
    edge,
    'fallback',
    [
      portAt(from, side, false, 0, 0).border,
      portAt(to, FACING[side], false, 0, 0).border,
    ],
    settings,
  );
};

// Routing

interface Job {
  edge: RouteEdge;
  from: RouteBox;
  to: RouteBox;
  /** `from` is an ancestor of `to`, or the reverse. */
  fromInner: boolean;
  toInner: boolean;
  through: Set<string>;
  starts: Port[];
  goals: Port[];
  found?: Found;
}

const makeJob = (
  edge: RouteEdge,
  boxes: ReadonlyMap<string, RouteBox>,
  settings: Settings,
): Job | undefined => {
  const from = boxes.get(edge.from);
  const to = boxes.get(edge.to);

  if (!from || !to || from === to) return undefined;

  const above = ancestorsOf(boxes, from.id);
  const below = ancestorsOf(boxes, to.id);
  const fromInner = below.includes(from.id);
  const toInner = above.includes(to.id);

  const portsOf = (box: RouteBox, inner: boolean) =>
    SIDES.map((side) =>
      portAt(
        box,
        side,
        inner,
        0,
        inner ? settings.margin : leadOf(clearance(box, side, boxes), settings),
      ),
    );

  return {
    edge,
    from,
    to,
    fromInner,
    toInner,
    through: new Set([...above, ...below]),
    starts: portsOf(from, fromInner),
    goals: portsOf(to, toInner),
  };
};

const runJobs = (
  jobs: readonly Job[],
  boxes: readonly RouteBox[],
  settings: Settings,
): void => {
  const grid = buildGrid(
    boxes,
    jobs.flatMap((job) => [...job.starts, ...job.goals]),
    settings.margin,
  );

  for (const job of jobs) {
    const found = search({
      grid,
      walls: buildWalls(grid, boxes, job.through),
      starts: job.starts,
      goals: job.goals,
      bend: settings.bend,
      lead: settings.lead,
    });

    if (found || !job.found) job.found = found ?? undefined;
  }
};

interface Claim {
  job: Job;
  start: boolean;
  port: Port;
  /** Where the edge's other end sits along this side. */
  toward: number;
}

const claimsOf = (job: Job): Claim[] => {
  if (!job.found) return [];

  const { start, goal } = job.found;

  const along = (port: Port, other: Port) =>
    port.side % 2 === 0 ? other.border.y : other.border.x;

  return [
    { job, start: true, port: start, toward: along(start, goal) },
    { job, start: false, port: goal, toward: along(goal, start) },
  ];
};

// Which way a port keeps along its side so that opposite edges each stay on their right.
const keepOf = ({ port, start }: Claim): number => {
  const dir = travel(port, start);

  return port.side % 2 === 0 ? DX[dir] : -DY[dir];
};

const boxOf = (claim: Claim): RouteBox =>
  claim.start ? claim.job.from : claim.job.to;

const sideLength = (claim: Claim): number =>
  claim.port.side % 2 === 0
    ? boxOf(claim).rect.height
    : boxOf(claim).rect.width;

const claimsBySide = (jobs: readonly Job[]): Claim[][] => {
  const sides = new Map<string, Claim[]>();

  for (const claim of jobs.flatMap(claimsOf)) {
    const key = JSON.stringify([
      boxOf(claim).id,
      claim.port.side,
      claim.port.inner,
    ]);

    sides.set(key, [...(sides.get(key) ?? []), claim]);
  }

  return [...sides.values()];
};

// A side holds as many ports as fit a step apart; the edges past that lose the side, so the next pass tries another.
// A box with a self-loop keeps its end side for the loop.
const relieve = (
  jobs: readonly Job[],
  looped: ReadonlySet<string>,
): boolean => {
  let changed = false;

  for (const claims of claimsBySide(jobs)) {
    const [{ port }] = claims;

    const kept =
      port.side === 0 && !port.inner && looped.has(boxOf(claims[0]).id);

    const room = kept
      ? 0
      : Math.floor(
          Math.max(0, sideLength(claims[0]) - PORT_INSET * 2) / PORT_STEP,
        ) + 1;

    for (const claim of claims.slice(room)) {
      const key = claim.start ? 'starts' : 'goals';
      const rest = claim.job[key].filter((port) => port !== claim.port);

      if (!rest.length) continue;
      claim.job[key] = rest;
      changed = true;
    }
  }

  return changed;
};

// Ports on one side spread in the order of where their edges go; the last pass routes from them.
const spreadPorts = (jobs: readonly Job[]): void => {
  for (const claims of claimsBySide(jobs)) {
    claims.sort(
      (a, b) =>
        a.toward - b.toward ||
        keepOf(a) - keepOf(b) ||
        a.job.edge.id.localeCompare(b.job.edge.id),
    );

    const gap = Math.min(
      PORT_STEP,
      Math.max(0, sideLength(claims[0]) - PORT_INSET * 2) /
        Math.max(1, claims.length - 1),
    );

    claims.forEach((claim, order) => {
      const { side, inner, reach } = claim.port;
      const offset = Math.round((order - (claims.length - 1) / 2) * gap);
      const port = portAt(boxOf(claim), side, inner, offset, reach);

      if (claim.start) claim.job.starts = [port];
      else claim.job.goals = [port];
    });
  }
};

const polyline = (job: Job): Point[] | undefined =>
  job.found &&
  simplify([
    job.found.start.border,
    ...job.found.points,
    job.found.goal.border,
  ]);

const rounded = (box: RouteBox): RouteBox => ({
  ...box,
  rect: {
    x: Math.round(box.rect.x),
    y: Math.round(box.rect.y),
    width: Math.round(box.rect.width),
    height: Math.round(box.rect.height),
  },
});

/**
 * Routes edges around boxes. The same boxes and edges give the same paths, whatever their order.
 * An edge whose ends are one box becomes a loop; one with no route becomes a straight `fallback`.
 */
export const route = (
  boxes: readonly RouteBox[],
  edges: readonly RouteEdge[],
  options: RouteOptions = {},
): Routed[] => {
  const settings = {
    margin: 6,
    lead: 12,
    bend: 24,
    radius: 4,
    dpr: 1,
    ...options,
  };

  const drawn = boxes.map(rounded).toSorted((a, b) => a.id.localeCompare(b.id));
  const byId = new Map(drawn.map((box) => [box.id, box]));
  const ordered = edges.toSorted((a, b) => a.id.localeCompare(b.id));

  const jobs = ordered.flatMap((edge) => makeJob(edge, byId, settings) ?? []);

  // The first passes pick each end's side from the side midpoints; the last routes from the spread ports.
  runJobs(jobs, drawn, settings);

  const looped = new Set(
    ordered.flatMap((edge) => (edge.from === edge.to ? [edge.from] : [])),
  );

  for (let round = 0; round < 2 && relieve(jobs, looped); round++)
    runJobs(jobs, drawn, settings);

  spreadPorts(jobs);
  runJobs(jobs, drawn, settings);

  const lines = jobs.map((job) => {
    const points = polyline(job);

    return points && centre(points, drawn, settings);
  });

  nudge(
    lines.flatMap((points) => (points ? [points] : [])),
    settings.margin,
  );

  const routed = new Map(
    jobs.map((job, index) => {
      const points = lines[index];

      return [
        job.edge.id,
        points
          ? finish(job.edge, 'route', points, settings)
          : fallback(job.edge, job.from, job.to, settings),
      ];
    }),
  );

  const taken = (box: RouteBox) =>
    new Set(
      jobs
        .flatMap(claimsOf)
        .flatMap((claim) =>
          boxOf(claim) === box && !claim.port.inner ? [claim.port.side] : [],
        ),
    );

  return ordered.flatMap((edge) => {
    const box = edge.from === edge.to ? byId.get(edge.from) : undefined;

    return box
      ? [loop(edge, box, byId, taken(box), settings)]
      : (routed.get(edge.id) ?? []);
  });
};
