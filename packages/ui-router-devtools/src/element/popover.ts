import type { Point, Rect } from './route.ts';
import type { Size } from './pack.ts';

const GAP = 8;

// The measured stand-in for CSS anchor positioning: beside the anchor, level with its top or its bottom, else the far corner.
export const placeBeside = (anchor: Rect, size: Size, bounds: Rect): Point => {
  const right = bounds.x + bounds.width - size.width;
  const bottom = bounds.y + bounds.height - size.height;

  const xs = [anchor.x + anchor.width + GAP, anchor.x - GAP - size.width];
  const ys = [anchor.y, anchor.y + anchor.height - size.height];

  for (const x of xs)
    for (const y of ys)
      if (x >= bounds.x && x <= right && y >= bounds.y && y <= bottom)
        return { x, y };

  return { x: Math.max(bounds.x, right), y: Math.max(bounds.y, bottom) };
};
