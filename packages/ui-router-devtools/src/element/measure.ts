const CHAR = 7.2;

let context: CanvasRenderingContext2D | null | undefined;

/** A label's width from a canvas, so packing needs no render; without one, from a per-character estimate. */
export const textWidth = (text: string, font: string): number => {
  context ??= globalThis.document?.createElement('canvas').getContext('2d');

  if (!context) return text.length * CHAR;
  context.font = font;

  return context.measureText(text).width;
};
