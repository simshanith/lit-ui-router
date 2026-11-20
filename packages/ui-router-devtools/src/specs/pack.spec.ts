import { describe, expect, it } from 'vitest';

import { stressStates } from '../../demo/stress.ts';
import {
  chooseRung,
  drawnIn,
  LARGE_METRICS,
  leastCover,
  METRICS,
  mostSlack,
  pack,
  ROOMY_METRICS,
  splitRows,
  type Box,
  type Placed,
  type Rung,
  type Size,
} from '../element/pack.ts';
import { placeBeside } from '../element/popover.ts';
import { truncateMiddle } from '../notation.ts';

// A header's inline size as the layout measures it: padding, glyph, name, then what trails the name.
const label = (name: string, extra = 0): number =>
  Math.ceil(36 + name.length * 6.4 + extra);

const leaf = (name: string, width = label(name)): Box => ({
  name,
  label: width,
  children: [],
});

const compound = (name: string, children: Box[], extra = 0): Box => ({
  name,
  label: label(name, 20 + extra),
  children,
});

const cell = (name: string, width: number): Placed => ({
  box: leaf(name, width),
  indent: 0,
  rows: [],
  x: 0,
  y: 0,
  width,
  height: 24,
});

const names = (placed: Placed): string[] =>
  placed.rows.flatMap((row) =>
    row.flatMap((item) => (item.box ? [item.box.name] : names(item))),
  );

const leaves = (placed: Placed): Placed[] =>
  drawnIn(placed, METRICS).flatMap((item) =>
    item.placed.rows.length ? leaves(item.placed) : [item.placed],
  );

// The sample app's tree: seven children under one root, two of them compounds.
const sample = (): Box =>
  compound(
    'app',
    [
      { ...leaf('welcome'), lead: 20 },
      leaf('home'),
      leaf('login'),
      leaf('notFound'),
      leaf('prefs', label('prefs', 40)),
      compound(
        'mymessages',
        [leaf('compose'), compound('messagelist', [leaf('message')])],
        36,
      ),
      compound(
        'contacts',
        [compound('contact', [leaf('edit')]), leaf('new')],
        36,
      ),
    ],
    20,
  );

// The stress fixture as the ladder draws it: only the active path open, and at the merged rung its chain under one header.
const stress = (merge: boolean): Box[] => {
  const all = stressStates().map((state) => state.name ?? '');

  const open = (name: string) =>
    'orders.archive.year.month.day'.startsWith(name);

  const kids = (parent: string) =>
    all.filter(
      (name) =>
        name.startsWith(`${parent}.`) &&
        name.split('.').length === parent.split('.').length + 1,
    );

  const build = (name: string): Box => {
    const segment = name.split('.').at(-1)!;
    const children = open(name) ? kids(name).map(build) : [];

    const merged =
      merge && children.length === 1 && children[0].children.length > 0;

    const trail = kids(name).length ? (children.length ? 20 : 35) : 0;

    return {
      name,
      label: merged ? label(segment, 8) : label(segment, trail),
      merge: merged,
      children,
    };
  };

  return all.filter((name) => !name.includes('.')).map(build);
};

const DOCK = { width: 1230, height: 256 };

const MAXIMISED = { width: 1230, height: 372 };

const aspect = ({ width, height }: Size): number => width / height;

describe('splitRows', () => {
  it('keeps declaration order and makes the widest row as narrow as it can', () => {
    const cells = [100, 20, 20, 100, 20, 20].map((width, index) =>
      cell(String(index), width),
    );

    const rows = splitRows(cells, 2, METRICS);

    expect(rows.map((row) => row.map((c) => c.box?.name))).toEqual([
      ['0', '1', '2'],
      ['3', '4', '5'],
    ]);
  });
});

describe('pack', () => {
  it('keeps every state once, in declaration order', () => {
    expect(names(pack([sample()], DOCK, METRICS))).toEqual([
      'welcome',
      'home',
      'login',
      'notFound',
      'prefs',
      'mymessages',
      'contacts',
    ]);
  });

  it('uses more rows for a taller viewport', () => {
    const wide = pack([sample()], DOCK, METRICS);
    const tall = pack([sample()], { width: 600, height: 700 }, METRICS);

    expect(tall.rows.length).toBeGreaterThan(wide.rows.length);
    expect(aspect(tall)).toBeLessThan(aspect(wide));
  });

  it('keeps every leaf at its natural size', () => {
    const long = leaf('quarterlyReconciliationWorksheetOverviewAndThenSome');
    const placed = pack([compound('a', [leaf('b'), long])], DOCK, METRICS);
    const [short, capped] = leaves(placed);

    expect(short.width).toBe(METRICS.min);
    expect(capped.width).toBe(METRICS.max);

    for (const tree of [[sample()], stress(false), stress(true)])
      for (const item of leaves(pack(tree, DOCK, METRICS))) {
        expect(item.height).toBe(METRICS.head);
        expect(item.width).toBeLessThanOrEqual(METRICS.max);
        expect(item.width - item.box!.label).toBeLessThan(4);
      }
  });

  it('shrink-wraps every compound and fills its rows', () => {
    for (const viewport of [DOCK, MAXIMISED])
      for (const tree of [[sample()], stress(false), stress(true)]) {
        const placed = pack(tree, viewport, METRICS);

        expect(mostSlack(placed, METRICS)).toBeLessThan(4);
        expect(leastCover(placed, METRICS)).toBeGreaterThanOrEqual(0.5);
      }
  });

  it('composes the sample and stress trees inside the dock and the maximised panel, near their aspect', () => {
    const cases = [
      { tree: [sample()], viewport: DOCK },
      { tree: [sample()], viewport: MAXIMISED },
      { tree: stress(true), viewport: DOCK },
      { tree: stress(false), viewport: MAXIMISED },
    ];

    for (const { tree, viewport } of cases) {
      const placed = pack(tree, viewport, METRICS);
      const stretch = aspect(placed) / aspect(viewport);

      expect(placed.width).toBeLessThanOrEqual(viewport.width);
      expect(placed.height).toBeLessThanOrEqual(viewport.height);
      expect(stretch).toBeGreaterThan(0.6);
      expect(stretch).toBeLessThan(1.6);
      // The diagram takes a real share of the room without being stretched to it.
      expect(placed.width / viewport.width).toBeGreaterThan(0.5);
      expect(placed.height / viewport.height).toBeGreaterThan(0.4);
    }
  });

  it('stacks short boxes beside a tall one instead of leaving the row half empty', () => {
    const placed = pack([sample()], DOCK, METRICS);
    const stacks = placed.rows.flat().filter((item) => item.box === null);

    expect(stacks.length).toBeGreaterThan(0);
    expect(stacks[0].rows.length).toBeGreaterThan(1);
  });

  it('sets groups further apart than pills', () => {
    const drawn = drawnIn(pack([sample()], DOCK, METRICS), METRICS);
    const pills = drawn.filter((item) => !item.placed.rows.length);
    const groups = drawn.filter((item) => item.placed.rows.length);
    const after = (item: (typeof drawn)[number]) => item.x + item.width;

    expect(pills[1].x - after(pills[0])).toBe(METRICS.gapX);
    expect(groups[1].x - after(groups[0])).toBe(METRICS.groupX);
    expect(METRICS.groupX).toBeGreaterThan(METRICS.gapX);
  });

  it('prefers a split that fits to one nearer the ratio that does not', () => {
    const boxes = Array.from({ length: 12 }, (_, i) => leaf(`s${i}`, 100));
    const placed = pack(boxes, { width: 400, height: 400 }, METRICS);

    expect(placed.box).toBeNull();
    expect(placed.width).toBeLessThanOrEqual(400);
  });

  it('gives a merged chain one header row', () => {
    const chain: Box = {
      name: 'a',
      label: 50,
      merge: true,
      children: [{ name: 'a.b', label: 60, children: [leaf('a.b.c', 56)] }],
    };

    const separate = pack(
      [{ ...chain, merge: false }],
      { width: 800, height: 400 },
      METRICS,
    );

    const merged = pack([chain], { width: 800, height: 400 }, METRICS);
    const inner = merged.rows[0][0];

    expect(inner.indent).toBe(50);
    expect(merged.height).toBe(inner.height);
    expect(merged.height).toBeLessThan(separate.height);
    expect(merged.width).toBeGreaterThanOrEqual(110);
    expect(drawnIn(merged, METRICS)[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('packs the stress tree at the merged rung inside the dock', () => {
    const states = stressStates().map((state) => state.name ?? '');
    const placed = pack(stress(true), DOCK, METRICS);

    expect(states).toHaveLength(60);
    expect(states.filter((name) => !name.includes('.'))).toHaveLength(20);
    expect(Math.max(...states.map((name) => name.split('.').length))).toBe(6);
    expect(placed.width).toBeLessThanOrEqual(DOCK.width);
    expect(placed.height).toBeLessThanOrEqual(DOCK.height);
    expect(placed.rows.flat().some((item) => item.box === null)).toBe(true);
  });
});

describe('chooseRung', () => {
  const sizes: Record<Rung, { width: number; height: number }> = {
    large: { width: 2300, height: 330 },
    roomy: { width: 1850, height: 265 },
    expanded: { width: 1400, height: 200 },
    collapsed: { width: 1000, height: 200 },
    merged: { width: 900, height: 200 },
    truncated: { width: 800, height: 200 },
    small: { width: 700, height: 180 },
    pan: { width: 0, height: 0 },
  };

  const at = (width: number, previous?: Rung) =>
    chooseRung((rung) => sizes[rung], { width, height: 300 }, previous);

  it('stops at the first rung that fits', () => {
    expect(at(1500)).toBe('expanded');
    expect(at(1200)).toBe('collapsed');
    expect(at(850)).toBe('truncated');
    // Nothing fits, so the last rung is drawn and panned.
    expect(at(600)).toBe('pan');
  });

  it('restores a milder rung only with a tenth of the room to spare', () => {
    expect(at(1050, 'merged')).toBe('merged');
    expect(at(1100, 'merged')).toBe('merged');
    expect(at(1120, 'merged')).toBe('collapsed');
    expect(at(720, 'pan')).toBe('pan');
    expect(at(780, 'pan')).toBe('small');
  });
});

describe('the enlarged rungs', () => {
  const sizes: Record<Rung, Size> = {
    large: { width: 1000, height: 250 },
    roomy: { width: 800, height: 200 },
    expanded: { width: 600, height: 150 },
    collapsed: { width: 500, height: 150 },
    merged: { width: 400, height: 150 },
    truncated: { width: 300, height: 150 },
    small: { width: 200, height: 120 },
    pan: { width: 0, height: 0 },
  };

  const at = (viewport: Size, enlarge: boolean) =>
    chooseRung((rung) => sizes[rung], viewport, undefined, enlarge);

  it('are tried only when asked for', () => {
    expect(at({ width: 1230, height: 400 }, false)).toBe('expanded');
    expect(at({ width: 1230, height: 400 }, true)).toBe('large');
  });

  it('take the largest step that leaves a tenth of each axis as margin', () => {
    expect(at({ width: 1112, height: 400 }, true)).toBe('large');
    expect(at({ width: 1100, height: 400 }, true)).toBe('roomy');
    expect(at({ width: 1230, height: 270 }, true)).toBe('roomy');
    expect(at({ width: 880, height: 220 }, true)).toBe('expanded');
  });

  it('keep the spacing in proportion to the type, on the 4px grid', () => {
    for (const metrics of [ROOMY_METRICS, LARGE_METRICS]) {
      const scale = metrics.type / METRICS.type;

      for (const key of ['head', 'padX', 'padY', 'gapX', 'gapY'] as const) {
        expect(metrics[key] % 4).toBe(0);
        expect(metrics[key] / METRICS[key]).toBeCloseTo(scale, 1);
      }

      const placed = pack([sample()], MAXIMISED, metrics);

      expect(mostSlack(placed, metrics)).toBeLessThan(4);
      expect(leastCover(placed, metrics)).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe('truncateMiddle', () => {
  it('leaves a short segment alone', () => {
    expect(truncateMiddle('messagelist')).toBe('messagelist');
  });

  it('cuts a long segment to 24 characters, keeping both ends', () => {
    const cut = truncateMiddle('quarterlyReconciliationWorksheetOverview');

    expect(cut).toBe('quarterlyRec…eetOverview');
    expect(cut).toHaveLength(24);
  });
});

describe('placeBeside', () => {
  const bounds = { x: 8, y: 34, width: 1240, height: 266 };
  const size = { width: 320, height: 200 };

  it('sits after the anchor, level with its top', () => {
    expect(
      placeBeside({ x: 100, y: 60, width: 80, height: 24 }, size, bounds),
    ).toEqual({ x: 188, y: 60 });
  });

  it("lines up with the anchor's bottom when there is no room below", () => {
    expect(
      placeBeside({ x: 100, y: 240, width: 80, height: 24 }, size, bounds),
    ).toEqual({ x: 188, y: 64 });
  });

  it('flips before the anchor when there is no room after it', () => {
    expect(
      placeBeside({ x: 1100, y: 60, width: 80, height: 24 }, size, bounds),
    ).toEqual({ x: 772, y: 60 });
  });

  it('takes the side that covers least of what it should keep clear of', () => {
    const anchor = { x: 600, y: 60, width: 80, height: 24 };
    const edge = { x: 680, y: 66, width: 200, height: 12, weight: 20 };

    expect(placeBeside(anchor, size, bounds, [edge])).toEqual({
      x: 272,
      y: 60,
    });
    expect(placeBeside(anchor, size, bounds)).toEqual({ x: 688, y: 60 });

    // The popover is measured as a DOMRect, whose fields are getters on its prototype.
    const measured: typeof size = Object.create({
      get width() {
        return size.width;
      },
      get height() {
        return size.height;
      },
    });

    expect(placeBeside(anchor, measured, bounds, [edge])).toEqual({
      x: 272,
      y: 60,
    });
  });

  it('finds the one free place along the bounds when beside the anchor and every corner are taken', () => {
    const narrow = { x: 8, y: 34, width: 900, height: 266 };
    const anchor = { x: 560, y: 150, width: 80, height: 24, weight: 1000 };
    // Edges run from the anchor to both ends of the bounds, low on one side and high on the other.
    const low = { x: 640, y: 156, width: 268, height: 12, weight: 20 };
    const high = { x: 8, y: 40, width: 500, height: 12, weight: 20 };
    const at = placeBeside(anchor, size, narrow, [anchor, low, high]);

    expect(at.x + size.width).toBeLessThanOrEqual(anchor.x);
    expect(at.y).toBeGreaterThanOrEqual(high.y + high.height);
  });

  it('takes the far corner when the anchor spans the bounds', () => {
    expect(
      placeBeside({ x: 12, y: 40, width: 1230, height: 250 }, size, bounds),
    ).toEqual({
      x: 928,
      y: 100,
    });
  });
});
