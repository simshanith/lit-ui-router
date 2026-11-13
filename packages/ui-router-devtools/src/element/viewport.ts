// The Map's viewport: where a packed layout sits in the room it is shown in. It reads no DOM.
import type { Size } from './pack.ts';
import type { Rect } from './route.ts';

/** The diagram's top-left corner measured from the room's, in whole pixels, so type and hairlines stay on the pixel grid. */
export interface View {
  x: number;
  y: number;
}

export interface Room extends Size {
  /** Kept free at the inline end, for the inspector popover's column. */
  reserve: number;
  /** How far past the room's inline end an overflowing diagram may be pulled, to bring it out from under the popover. */
  slack: number;
  /** How far past the room's block end an overflowing diagram may be pulled, to bring it out from under the minimap. */
  foot: number;
  rtl: boolean;
}

/** The margin kept around a box that is panned into view. */
const PAD = 12;

const within = (value: number, low: number, high: number): number =>
  Math.round(Math.min(high, Math.max(low, value)));

export const overflows = (size: Size, room: Size): boolean =>
  size.width > room.width || size.height > room.height;

/** The fitted view: the diagram in the middle of the room left beside the reserve, or at the start of an axis it overflows. */
export const fitView = (size: Size, room: Room): View => {
  const inline = Math.max(
    0,
    Math.round((room.width - room.reserve - size.width) / 2),
  );

  return {
    x: room.rtl ? room.width - size.width - inline : inline,
    y: Math.max(0, Math.round((room.height - size.height) / 2)),
  };
};

/**
 * Holds a view to what can be panned: an axis the diagram fits on stays fitted, and one it overflows stops at the diagram's edges.
 * A diagram that overflows either axis can also be pulled up by the room's foot.
 */
export const clampView = (view: View, size: Size, room: Room): View => {
  const fit = fitView(size, room);
  const spare = room.width - size.width;
  const foot = overflows(size, room) ? room.foot : 0;

  return {
    x:
      spare >= 0
        ? fit.x
        : within(
            view.x,
            spare - (room.rtl ? 0 : room.slack),
            room.rtl ? room.slack : 0,
          ),
    y: within(view.y, Math.min(fit.y, room.height - size.height - foot), fit.y),
  };
};

// How far to move one axis so a span lies inside the room; a span longer than the room shows its start.
const into = (low: number, length: number, room: number): number => {
  if (low < PAD) return PAD - low;

  const past = low + length - (room - PAD);

  return past > 0 ? -Math.min(past, low - PAD) : 0;
};

/** The view moved the least that brings a box of the diagram wholly into the room. */
export const revealView = (
  view: View,
  rect: Rect,
  size: Size,
  room: Room,
): View =>
  clampView(
    {
      x: view.x + into(view.x + rect.x, rect.width, room.width),
      y: view.y + into(view.y + rect.y, rect.height, room.height),
    },
    size,
    room,
  );

/** The view that puts a box of the diagram in the middle of the room, as far as the diagram's edges allow. */
export const centreView = (rect: Rect, size: Size, room: Room): View =>
  clampView(
    {
      x: room.width / 2 - rect.x - rect.width / 2,
      y: room.height / 2 - rect.y - rect.height / 2,
    },
    size,
    room,
  );

/** The view after the diagram changes size, with the point in the middle of the room held still. */
export const zoomView = (view: View, from: Size, to: Size, room: Room): View =>
  clampView(
    {
      x: room.width / 2 - ((room.width / 2 - view.x) * to.width) / from.width,
      y:
        room.height / 2 -
        ((room.height / 2 - view.y) * to.height) / from.height,
    },
    to,
    room,
  );
