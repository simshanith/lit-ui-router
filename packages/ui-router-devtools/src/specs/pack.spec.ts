import { describe, expect, it } from 'vitest';

import { stressStates } from '../../demo/stress.ts';
import {
  chooseRung,
  pack,
  splitRows,
  type Box,
  type Placed,
  type Rung,
} from '../element/pack.ts';
import { placeBeside } from '../element/popover.ts';
import { truncateMiddle } from '../notation.ts';

const METRICS = { head: 24, pad: 12, gap: 16 };

const leaf = (name: string, label = 80): Box => ({ name, label, children: [] });

const cell = (name: string, width: number): Placed => ({
  box: leaf(name, width),
  indent: 0,
  rows: [],
  width,
  height: 24,
});

const names = (placed: Placed): string[] =>
  placed.rows.flatMap((row) =>
    row.flatMap((item) => (item.box ? [item.box.name] : names(item))),
  );

// The sample app's tree: seven children under one root, two of them compounds.
const sample = (): Box => ({
  name: 'app',
  label: 60,
  children: [
    leaf('welcome', 90),
    leaf('home', 70),
    leaf('login', 70),
    leaf('notFound', 96),
    leaf('prefs', 110),
    {
      name: 'contacts',
      label: 100,
      children: [
        { name: 'contact', label: 90, children: [leaf('edit', 64)] },
        leaf('new', 64),
      ],
    },
    {
      name: 'mymessages',
      label: 120,
      children: [
        leaf('compose', 96),
        { name: 'messagelist', label: 120, children: [leaf('message', 100)] },
      ],
    },
  ],
});

describe('splitRows', () => {
  it('keeps declaration order and makes the widest row as narrow as it can', () => {
    const cells = [100, 20, 20, 100, 20, 20].map((width, index) =>
      cell(String(index), width),
    );

    const rows = splitRows(cells, 2, 10);

    expect(rows.map((row) => row.map((c) => c.box?.name))).toEqual([
      ['0', '1', '2'],
      ['3', '4', '5'],
    ]);
  });
});

describe('pack', () => {
  it('keeps every state once, in declaration order', () => {
    const placed = pack([sample()], { width: 1232, height: 256 }, METRICS);

    expect(names(placed)).toEqual([
      'welcome',
      'home',
      'login',
      'notFound',
      'prefs',
      'contacts',
      'mymessages',
    ]);
  });

  it('uses more rows for a taller viewport', () => {
    const wide = pack([sample()], { width: 1232, height: 256 }, METRICS);
    const tall = pack([sample()], { width: 600, height: 700 }, METRICS);

    expect(tall.rows.length).toBeGreaterThan(wide.rows.length);
    expect(tall.width / tall.height).toBeLessThan(wide.width / wide.height);
  });

  it('fits the dock and the maximised panel without stepping down', () => {
    for (const viewport of [
      { width: 1232, height: 256 },
      { width: 1232, height: 372 },
    ]) {
      const placed = pack([sample()], viewport, METRICS);

      expect(placed.width).toBeLessThanOrEqual(viewport.width);
      expect(placed.height).toBeLessThanOrEqual(viewport.height);
    }
  });

  it('stacks short boxes beside a tall one instead of leaving the row half empty', () => {
    const placed = pack([sample()], { width: 1232, height: 256 }, METRICS);
    const stacks = placed.rows.flat().filter((item) => item.box === null);

    expect(stacks.length).toBeGreaterThan(0);
    expect(stacks[0].rows.length).toBeGreaterThan(1);
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
      children: [{ name: 'a.b', label: 60, children: [leaf('a.b.c', 40)] }],
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
  });

  it('packs the stress tree, collapsed, inside the dock', () => {
    const states = stressStates().map((state) => state.name ?? '');
    const top = states.filter((name) => !name.includes('.'));

    const placed = pack(
      top.map((name) => leaf(name, 44 + name.length * 7)),
      { width: 1232, height: 256 },
      METRICS,
    );

    expect(states).toHaveLength(60);
    expect(top).toHaveLength(20);
    expect(Math.max(...states.map((name) => name.split('.').length))).toBe(6);
    expect(placed.width).toBeLessThanOrEqual(1232);
    expect(placed.height).toBeLessThanOrEqual(256);
    expect(placed.rows.length).toBeGreaterThan(1);
  });
});

describe('chooseRung', () => {
  const sizes: Record<Rung, { width: number; height: number }> = {
    expanded: { width: 1400, height: 200 },
    collapsed: { width: 1000, height: 200 },
    merged: { width: 900, height: 200 },
    truncated: { width: 800, height: 200 },
    small: { width: 700, height: 180 },
    tree: { width: 0, height: 0 },
  };

  const at = (width: number, previous?: Rung) =>
    chooseRung((rung) => sizes[rung], { width, height: 300 }, previous);

  it('stops at the first rung that fits', () => {
    expect(at(1500)).toBe('expanded');
    expect(at(1200)).toBe('collapsed');
    expect(at(850)).toBe('truncated');
    expect(at(600)).toBe('tree');
  });

  it('restores a milder rung only with a tenth of the room to spare', () => {
    expect(at(1050, 'merged')).toBe('merged');
    expect(at(1100, 'merged')).toBe('merged');
    expect(at(1120, 'merged')).toBe('collapsed');
    expect(at(720, 'tree')).toBe('tree');
    expect(at(780, 'tree')).toBe('small');
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

  it('takes the far corner when the anchor spans the bounds', () => {
    expect(
      placeBeside({ x: 12, y: 40, width: 1230, height: 250 }, size, bounds),
    ).toEqual({
      x: 928,
      y: 100,
    });
  });
});
