import { describe, expect, it } from 'vitest';

import {
  centreView,
  clampView,
  fitView,
  overflows,
  revealView,
  zoomView,
  type Room,
} from '../element/viewport.ts';

const room = (over: Partial<Room> = {}): Room => ({
  width: 1000,
  height: 300,
  reserve: 0,
  slack: 0,
  foot: 0,
  rtl: false,
  ...over,
});

const small = { width: 400, height: 100 };

const large = { width: 1600, height: 500 };

describe('fitView', () => {
  it('centres a diagram that fits, on whole pixels', () => {
    expect(fitView(small, room())).toEqual({ x: 300, y: 100 });
    expect(fitView({ width: 401, height: 101 }, room())).toEqual({
      x: 300,
      y: 100,
    });
  });

  it("centres in the room left beside the popover's column", () => {
    expect(fitView(small, room({ reserve: 320 }))).toEqual({ x: 140, y: 100 });
    // Right to left the column is at the left, so the diagram keeps to the right.
    expect(fitView(small, room({ reserve: 320, rtl: true }))).toEqual({
      x: 460,
      y: 100,
    });
  });

  it('starts an axis the diagram overflows at its inline start', () => {
    expect(fitView(large, room())).toEqual({ x: 0, y: 0 });
    expect(fitView(large, room({ rtl: true }))).toEqual({ x: -600, y: 0 });
    expect(overflows(large, room())).toBe(true);
    expect(overflows(small, room())).toBe(false);
  });
});

describe('clampView', () => {
  it('keeps an axis the diagram fits on where the fit puts it', () => {
    expect(clampView({ x: -50, y: 40 }, small, room())).toEqual({
      x: 300,
      y: 100,
    });
  });

  it("stops at the diagram's edges, on whole pixels", () => {
    expect(clampView({ x: 80, y: 30 }, large, room())).toEqual({ x: 0, y: 0 });
    expect(clampView({ x: -900, y: -900 }, large, room())).toEqual({
      x: -600,
      y: -200,
    });
    expect(clampView({ x: -10.4, y: -20.6 }, large, room())).toEqual({
      x: -10,
      y: -21,
    });
  });

  it('lets a diagram that overflows be pulled up clear of the minimap', () => {
    const wide = { width: 1600, height: 200 };

    // It fits on the block axis, so it rests centred, and can be pulled up until its end clears the foot.
    expect(clampView({ x: 0, y: 900 }, wide, room({ foot: 84 })).y).toBe(50);
    expect(clampView({ x: 0, y: -900 }, wide, room({ foot: 84 })).y).toBe(16);
    expect(clampView({ x: 0, y: -900 }, large, room({ foot: 84 })).y).toBe(
      -284,
    );
    expect(clampView({ x: 0, y: -900 }, small, room({ foot: 84 })).y).toBe(100);
  });

  it('lets the inline end be pulled out from under the popover', () => {
    expect(clampView({ x: -2000, y: 0 }, large, room({ slack: 320 })).x).toBe(
      -920,
    );
    expect(
      clampView({ x: 900, y: 0 }, large, room({ slack: 320, rtl: true })).x,
    ).toBe(320);
  });
});

describe('revealView', () => {
  const view = { x: 0, y: 0 };

  it('leaves the view alone when the box is in it', () => {
    const rect = { x: 100, y: 100, width: 80, height: 24 };

    expect(revealView(view, rect, large, room())).toEqual(view);
  });

  it('pans the least that brings the box in, with a margin', () => {
    const rect = { x: 1400, y: 400, width: 80, height: 24 };

    expect(revealView(view, rect, large, room())).toEqual({ x: -492, y: -136 });
    expect(
      revealView(
        { x: -600, y: -200 },
        { ...rect, x: 20, y: 20 },
        large,
        room(),
      ),
    ).toEqual({ x: -8, y: -8 });
  });
});

describe('centreView and zoomView', () => {
  it("puts a box in the middle of the room, as far as the diagram's edges allow", () => {
    expect(
      centreView({ x: 760, y: 238, width: 80, height: 24 }, large, room()),
    ).toEqual({ x: -300, y: -100 });
    expect(
      centreView({ x: 0, y: 0, width: 80, height: 24 }, large, room()),
    ).toEqual({ x: 0, y: 0 });
  });

  it('holds the middle of the room still while the diagram changes size', () => {
    const next = { width: 2400, height: 750 };
    const zoomed = zoomView({ x: -300, y: -100 }, large, next, room());

    // The point that was under the middle of the room, (800, 250), is now at (1200, 375).
    expect(zoomed).toEqual({ x: -700, y: -225 });
  });
});
