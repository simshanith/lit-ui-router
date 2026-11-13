// The nested Map's packer: measured boxes in, placed boxes out. It reads no DOM.

export interface Metrics {
  /** A leaf's block size, and a compound's header row. */
  head: number;
  /** Padding between a compound's border and its rows, along the inline and block axes. */
  padX: number;
  padY: number;
  /** Space between leaves in a row, and between rows of leaves. */
  gapX: number;
  gapY: number;
  /** Space between a compound and its neighbours, so groups read as groups. */
  groupX: number;
  groupY: number;
  /** The narrowest and widest a leaf may be. */
  min: number;
  max: number;
  /** The type size the labels are set in. */
  type: number;
}

// The spacing system, on the panel's 4px unit and 12px module; `map.md` records it.
export const METRICS: Metrics = {
  head: 24,
  padX: 24,
  padY: 12,
  gapX: 24,
  gapY: 24,
  groupX: 36,
  groupY: 36,
  min: 56,
  max: 208,
  type: 12,
};

/** The maximised panel's steps: the same proportions at 16px and 20px type, a third and two thirds larger. */
export const ROOMY_METRICS: Metrics = {
  head: 32,
  padX: 32,
  padY: 16,
  gapX: 32,
  gapY: 32,
  groupX: 48,
  groupY: 48,
  min: 76,
  max: 276,
  type: 16,
};

export const LARGE_METRICS: Metrics = {
  head: 40,
  padX: 40,
  padY: 20,
  gapX: 40,
  gapY: 40,
  groupX: 60,
  groupY: 60,
  min: 92,
  max: 348,
  type: 20,
};

/** The caption-size rung of the fit ladder. */
export const SMALL_METRICS: Metrics = {
  head: 20,
  padX: 16,
  padY: 8,
  gapX: 16,
  gapY: 12,
  groupX: 24,
  groupY: 16,
  min: 48,
  max: 176,
  type: 11,
};

export interface Size {
  width: number;
  height: number;
}

export interface Box {
  name: string;
  /** The header's inline size: glyph, name, count, marks and tag. */
  label: number;
  /** Room kept before the box for the default-child marker. */
  lead?: number;
  /** Shares one header with its only child, which is also a compound. */
  merge?: boolean;
  children: Box[];
}

export interface Placed extends Size {
  /** `null` for a stack of short boxes beside a tall one, and for the root of several top-level states. */
  box: Box | null;
  /** The inline size of the ancestors' labels this header follows, when merged. */
  indent: number;
  rows: Placed[][];
  /** Offset from the container's content origin, set when the container is placed. */
  x: number;
  y: number;
}

const INNER_RATIO = 2;

/** How much an empty fraction of a compound's interior costs against a ratio nearer the target. */
const WASTE = 1.5;

const GRID = 4;

const onGrid = (value: number): number => Math.ceil(value / GRID) * GRID;

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

const cellWidth = (cell: Placed): number => cell.width + (cell.box?.lead ?? 0);

// A drawn compound or a stack: something that reads as a group, not a pill.
const isGroup = (cell: Placed): boolean => cell.rows.length > 0;

const between = (a: Placed, b: Placed, metrics: Metrics): number =>
  isGroup(a) || isGroup(b) ? metrics.groupX : metrics.gapX;

const rowWidth = (row: readonly Placed[], metrics: Metrics): number =>
  sum(
    row.map(
      (cell, index) =>
        cellWidth(cell) + (index ? between(row[index - 1], cell, metrics) : 0),
    ),
  );

const rowHeight = (row: readonly Placed[]): number =>
  Math.max(0, ...row.map((cell) => cell.height));

const rowGap = (
  above: readonly Placed[],
  below: readonly Placed[],
  metrics: Metrics,
): number =>
  above.some(isGroup) || below.some(isGroup) ? metrics.groupY : metrics.gapY;

const rowsSize = (rows: readonly Placed[][], metrics: Metrics): Size => ({
  width: Math.max(0, ...rows.map((row) => rowWidth(row, metrics))),
  height: sum(
    rows.map(
      (row, index) =>
        rowHeight(row) + (index ? rowGap(rows[index - 1], row, metrics) : 0),
    ),
  ),
});

// Splits cells into `count` contiguous rows whose widest row is as narrow as possible; ties keep earlier rows longer.
export const splitRows = (
  cells: readonly Placed[],
  count: number,
  metrics: Metrics,
): Placed[][] => {
  const n = cells.length;

  const span = (from: number, to: number) =>
    rowWidth(cells.slice(from, to), metrics);

  // best[k][i]: the widest row when the first i cells take k rows; cut[k][i]: where the last row starts.
  const best = [cells.map((_, i) => span(0, i + 1))];
  const cut = [cells.map(() => 0)];

  for (let k = 1; k < count; k++) {
    best.push([]);
    cut.push([]);

    for (let i = k; i < n; i++) {
      let width = Infinity;
      let at = k;

      for (let j = k; j <= i; j++) {
        const candidate = Math.max(best[k - 1][j - 1], span(j, i + 1));

        if (candidate <= width) [width, at] = [candidate, j];
      }

      best[k][i] = width;
      cut[k][i] = at;
    }
  }

  const rows: Placed[][] = [];

  for (let k = count - 1, end = n; k >= 0; k--) {
    const start = cut[k][end - 1];
    rows.unshift(cells.slice(start, end));
    end = start;
  }

  return rows;
};

// A run of short cells beside a tall one stacks into as many rows as the tall one's height holds.
const stackRun = (
  run: Placed[],
  height: number,
  metrics: Metrics,
): Placed[] => {
  for (let count = Math.min(run.length, 8); count > 1; count--) {
    const rows = splitRows(run, count, metrics);
    const size = rowsSize(rows, metrics);

    if (size.height <= height)
      return [{ box: null, indent: 0, rows, x: 0, y: 0, ...size }];
  }

  return run;
};

const stackShort = (row: Placed[], metrics: Metrics): Placed[] => {
  const height = rowHeight(row);
  const short = (cell: Placed) => cell.height * 2 + metrics.gapY <= height;
  const cells: Placed[] = [];
  let run: Placed[] = [];

  for (const cell of row) {
    if (short(cell)) {
      run.push(cell);
      continue;
    }

    cells.push(...stackRun(run, height, metrics), cell);
    run = [];
  }

  return [...cells, ...stackRun(run, height, metrics)];
};

interface Choice {
  /** Width over height the split should come nearest. */
  ratio: number;
  /** A split that fits this size is preferred to any that does not. */
  fit?: Size;
}

interface Frame {
  /** The box's own inline size outside its rows. */
  inline: number;
  /** The box's own block size outside its rows. */
  block: number;
  /** The narrowest the box may be. */
  min: number;
}

const frameSize = (rows: Placed[][], frame: Frame, metrics: Metrics): Size => {
  const size = rowsSize(rows, metrics);

  return {
    width: onGrid(Math.max(frame.min, size.width + frame.inline)),
    height: size.height + frame.block,
  };
};

export const fits = (size: Size, room: Size | undefined): boolean =>
  !room || (size.width <= room.width && size.height <= room.height);

const area = (cells: readonly Placed[]): number =>
  sum(cells.map((cell) => cellWidth(cell) * cell.height));

// The share of the rows' bounding box that their cells cover.
const cover = (rows: readonly Placed[][], metrics: Metrics): number => {
  const size = rowsSize(rows, metrics);

  return area(rows.flat()) / Math.max(1, size.width * size.height);
};

// Tries every row count and keeps the split nearest the target ratio that wastes least of its interior; ties keep fewer rows.
const chooseRows = (
  cells: Placed[],
  frame: Frame,
  choice: Choice,
  metrics: Metrics,
): Placed[][] => {
  let chosen: Placed[][] = [];
  let score = Infinity;

  for (let count = 1; count <= cells.length; count++) {
    const rows = splitRows(cells, count, metrics).map((row) =>
      stackShort(row, metrics),
    );

    const size = frameSize(rows, frame, metrics);

    const candidate =
      Math.abs(Math.log(size.width / size.height / choice.ratio)) +
      WASTE * (1 - cover(rows, metrics)) +
      (fits(size, choice.fit) ? 0 : 1000);

    if (candidate < score) [chosen, score] = [rows, candidate];
  }

  return chosen;
};

// Rows start at the inline start and cells sit at their row's top.
const place = (rows: Placed[][], metrics: Metrics): void => {
  let y = 0;

  rows.forEach((row, index) => {
    let x = 0;

    if (index) y += rowGap(rows[index - 1], row, metrics);

    row.forEach((cell, at) => {
      if (at) x += between(row[at - 1], cell, metrics);
      cell.x = x + (cell.box?.lead ?? 0);
      cell.y = y;
      x += cellWidth(cell);

      if (!cell.box) place(cell.rows, metrics);
    });

    y += rowHeight(row);
  });
};

const packBox = (
  box: Box,
  metrics: Metrics,
  choice: Choice,
  indent = 0,
): Placed => {
  const label = indent + box.label;
  const only = box.children[0];

  if (box.merge && only) {
    const inner = packBox(only, metrics, choice, label);

    return {
      box,
      indent,
      rows: [[inner]],
      x: 0,
      y: 0,
      width: inner.width,
      height: inner.height,
    };
  }

  if (!box.children.length)
    return {
      box,
      indent,
      rows: [],
      x: 0,
      y: 0,
      width: onGrid(Math.min(metrics.max, Math.max(metrics.min, label))),
      height: metrics.head,
    };

  const frame = {
    inline: metrics.padX * 2,
    block: metrics.head + metrics.padY * 2,
    min: label,
  };

  const cells = box.children.map((child) =>
    packBox(child, metrics, { ratio: INNER_RATIO }),
  );

  const rows = chooseRows(cells, frame, choice, metrics);
  place(rows, metrics);

  return {
    box,
    indent,
    rows,
    x: 0,
    y: 0,
    ...frameSize(rows, frame, metrics),
  };
};

/** Packs the top-level boxes at their natural sizes into rows whose outline is nearest the viewport's shape. */
export const pack = (
  roots: readonly Box[],
  viewport: Size,
  metrics: Metrics,
): Placed => {
  const choice = {
    ratio: viewport.width / Math.max(1, viewport.height),
    fit: viewport,
  };

  const [root] = roots;

  if (root && roots.length === 1) return packBox(root, metrics, choice);

  const frame = { inline: 0, block: 0, min: 0 };

  const cells = roots.map((box) =>
    packBox(box, metrics, { ratio: INNER_RATIO }),
  );

  const rows = chooseRows(cells, frame, choice, metrics);
  place(rows, metrics);

  return {
    box: null,
    indent: 0,
    rows,
    x: 0,
    y: 0,
    ...frameSize(rows, frame, metrics),
  };
};

export interface Drawn extends Size {
  box: Box;
  placed: Placed;
  /** Offset from the enclosing drawn box's border, or from the diagram's origin. */
  x: number;
  y: number;
}

/** The boxes drawn directly inside a placed box, with stacks flattened away. */
export const drawnIn = (placed: Placed, metrics: Metrics): Drawn[] => {
  const merged = placed.box?.merge;
  const inset = placed.box && !merged ? metrics.padX : 0;
  const top = placed.box && !merged ? metrics.head + metrics.padY : 0;

  const walk = (cell: Placed, x: number, y: number): Drawn[] =>
    cell.box
      ? [
          {
            box: cell.box,
            placed: cell,
            x: x + cell.x,
            y: y + cell.y,
            width: cell.width,
            height: cell.height,
          },
        ]
      : cell.rows.flat().flatMap((item) => walk(item, x + cell.x, y + cell.y));

  return placed.rows.flat().flatMap((cell) => walk(cell, inset, top));
};

/** The least share of any compound's packed rows that its boxes cover; ragged rows and short stacks lower it. */
export const leastCover = (placed: Placed, metrics: Metrics): number => {
  const inner = drawnIn(placed, metrics);
  const size = rowsSize(placed.rows, metrics);

  const own =
    placed.box?.merge || !inner.length
      ? 1
      : sum(
          inner.map(
            (item) => (item.width + (item.box.lead ?? 0)) * item.height,
          ),
        ) /
        (size.width * size.height);

  return Math.min(
    own,
    ...inner.map((item) => leastCover(item.placed, metrics)),
  );
};

/** How far any compound is wider than its header and its rows need; a shrink-wrapped tree gives less than one grid step. */
export const mostSlack = (placed: Placed, metrics: Metrics): number => {
  const inner = drawnIn(placed, metrics);
  const { box } = placed;

  const own =
    box && !box.merge && inner.length
      ? placed.width -
        Math.max(
          placed.indent + box.label,
          rowsSize(placed.rows, metrics).width + metrics.padX * 2,
        )
      : 0;

  return Math.max(own, ...inner.map((item) => mostSlack(item.placed, metrics)));
};

/** The fit ladder, mildest first; each rung keeps the ones before it. The first two enlarge, and the last fits nothing: its diagram is panned. */
export const RUNGS = [
  'large',
  'roomy',
  'expanded',
  'collapsed',
  'merged',
  'truncated',
  'small',
  'pan',
] as const;

export type Rung = (typeof RUNGS)[number];

const SPARE = 0.9;

const NATURAL = RUNGS.indexOf('expanded');

/**
 * The first rung whose packed size fits the viewport, or `pan` when none does. A rung milder than the previous one
 * must fit with a tenth of the inline size to spare, so a resize does not flicker between layouts.
 * The enlarged rungs are tried only when `enlarge` is set, and must leave a tenth of each axis as margin.
 */
export const chooseRung = (
  sizeAt: (rung: Rung, room: Size) => Size,
  viewport: Size,
  previous?: Rung,
  enlarge = false,
): Rung => {
  const held = previous ? RUNGS.indexOf(previous) : 0;
  const spare = { ...viewport, width: viewport.width * SPARE };
  const framed = { ...spare, height: viewport.height * SPARE };

  for (const [index, rung] of RUNGS.entries()) {
    if (rung === 'pan') break;

    if (index < NATURAL && !enlarge) continue;

    // A milder rung is packed for the narrower room, since a packing follows the room it is given.
    const room = index < NATURAL ? framed : index < held ? spare : viewport;

    if (fits(sizeAt(rung, room), room)) return rung;
  }

  return 'pan';
};
