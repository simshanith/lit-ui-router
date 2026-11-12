// The nested Map's packer: measured boxes in, rows out. It reads no DOM.

export interface Metrics {
  /** A leaf's block size, and a compound's header row. */
  head: number;
  /** Padding between a compound's border and its rows. */
  pad: number;
  /** Space between boxes in a row and between rows. */
  gap: number;
}

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
}

const INNER_RATIO = 2;

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

const cellWidth = (cell: Placed): number => cell.width + (cell.box?.lead ?? 0);

const rowWidth = (row: readonly Placed[], gap: number): number =>
  sum(row.map(cellWidth)) + gap * (row.length - 1);

const rowHeight = (row: readonly Placed[]): number =>
  Math.max(0, ...row.map((cell) => cell.height));

const rowsSize = (rows: readonly Placed[][], gap: number): Size => ({
  width: Math.max(0, ...rows.map((row) => rowWidth(row, gap))),
  height: sum(rows.map(rowHeight)) + gap * Math.max(0, rows.length - 1),
});

// Splits cells into `count` contiguous rows whose widest row is as narrow as possible; ties keep earlier rows longer.
export const splitRows = (
  cells: readonly Placed[],
  count: number,
  gap: number,
): Placed[][] => {
  const n = cells.length;
  const before = [0];

  for (const cell of cells) before.push(before.at(-1)! + cellWidth(cell));

  const span = (from: number, to: number) =>
    before[to] - before[from] + gap * (to - from - 1);

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
const stackRun = (run: Placed[], height: number, gap: number): Placed[] => {
  for (let count = Math.min(run.length, 8); count > 1; count--) {
    const rows = splitRows(run, count, gap);
    const size = rowsSize(rows, gap);

    if (size.height <= height) return [{ box: null, indent: 0, rows, ...size }];
  }

  return run;
};

const stackShort = (row: Placed[], gap: number): Placed[] => {
  const height = rowHeight(row);
  const short = (cell: Placed) => cell.height * 2 + gap <= height;
  const cells: Placed[] = [];
  let run: Placed[] = [];

  for (const cell of row) {
    if (short(cell)) {
      run.push(cell);
      continue;
    }

    cells.push(...stackRun(run, height, gap), cell);
    run = [];
  }

  return [...cells, ...stackRun(run, height, gap)];
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

const frameSize = (rows: Placed[][], frame: Frame, gap: number): Size => {
  const size = rowsSize(rows, gap);

  return {
    width: Math.max(frame.min, size.width + frame.inline),
    height: size.height + frame.block,
  };
};

const fits = (size: Size, room: Size | undefined): boolean =>
  !room || (size.width <= room.width && size.height <= room.height);

// Tries every row count and keeps the split whose aspect ratio is nearest the target; ties keep fewer rows.
const chooseRows = (
  cells: Placed[],
  frame: Frame,
  choice: Choice,
  gap: number,
): Placed[][] => {
  let chosen: Placed[][] = [];
  let score = Infinity;

  for (let count = 1; count <= cells.length; count++) {
    const rows = splitRows(cells, count, gap).map((row) =>
      stackShort(row, gap),
    );

    const size = frameSize(rows, frame, gap);

    const candidate =
      Math.abs(Math.log(size.width / size.height / choice.ratio)) +
      (fits(size, choice.fit) ? 0 : 1000);

    if (candidate < score) [chosen, score] = [rows, candidate];
  }

  return chosen;
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
      width: inner.width,
      height: inner.height,
    };
  }

  const frame = {
    inline: metrics.pad * 2,
    block: box.children.length ? metrics.head + metrics.pad * 2 : metrics.head,
    min: label,
  };

  const cells = box.children.map((child) =>
    packBox(child, metrics, { ratio: INNER_RATIO }),
  );

  const rows = chooseRows(cells, frame, choice, metrics.gap);

  return { box, indent, rows, ...frameSize(rows, frame, metrics.gap) };
};

/** Packs the top-level boxes for a viewport: one root box fills it, several share it as rows. */
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

  const rows = chooseRows(cells, frame, choice, metrics.gap);

  return {
    box: null,
    indent: 0,
    rows,
    ...frameSize(rows, frame, metrics.gap),
  };
};

/** The fit ladder, mildest first; each rung keeps the ones before it. The last is the node-link tree. */
export const RUNGS = [
  'expanded',
  'collapsed',
  'merged',
  'truncated',
  'small',
  'tree',
] as const;

export type Rung = (typeof RUNGS)[number];

const SPARE = 0.9;

/**
 * The first rung whose packed size fits the viewport. A rung milder than the previous one
 * must fit with a tenth of the inline size to spare, so a resize does not flicker between layouts.
 */
export const chooseRung = (
  sizeAt: (rung: Rung, room: Size) => Size,
  viewport: Size,
  previous?: Rung,
): Rung => {
  const held = previous ? RUNGS.indexOf(previous) : 0;
  const spare = { ...viewport, width: viewport.width * SPARE };

  for (const [index, rung] of RUNGS.entries()) {
    if (rung === 'tree') break;

    // A milder rung is packed for the narrower room, since a packing follows the room it is given.
    const room = index < held ? spare : viewport;

    if (fits(sizeAt(rung, room), room)) return rung;
  }

  return 'tree';
};
