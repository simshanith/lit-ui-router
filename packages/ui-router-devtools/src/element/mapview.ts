// The Map's viewport in the panel: the keys, drags and wheel that move it, and the minimap.
import { html, nothing, svg, type TemplateResult } from 'lit';
import type { DevtoolsPanel } from './panel.ts';
import type { NestedLayout } from './nested.ts';
import type { Size } from './pack.ts';
import { overflows, type View } from './viewport.ts';

/** How far one press of Shift and an arrow key pans. */
const PAN_STEP = 48;

const PAN_KEYS: ReadonlyMap<string, View> = new Map([
  ['ArrowLeft', { x: PAN_STEP, y: 0 }],
  ['ArrowRight', { x: -PAN_STEP, y: 0 }],
  ['ArrowUp', { x: 0, y: PAN_STEP }],
  ['ArrowDown', { x: 0, y: -PAN_STEP }],
]);

const ZOOM_KEYS: ReadonlyMap<string, number> = new Map([
  ['+', 1],
  ['=', 1],
  ['-', -1],
]);

// Shift with an arrow key pans, plus and minus change the type step, and 0 fits; the plain arrow keys stay the tree's.
export const viewKey = (
  host: DevtoolsPanel,
  layout: NestedLayout,
  event: KeyboardEvent,
): boolean => {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;

  const pan = event.shiftKey ? PAN_KEYS.get(event.key) : undefined;
  const zoom = ZOOM_KEYS.get(event.key);

  if (pan) {
    const view = host._viewOf(layout);
    host._panTo(layout, { x: view.x + pan.x, y: view.y + pan.y }, true);
  } else if (zoom) host._zoomBy(layout, zoom);
  else if (event.key === '0') host._fit();
  else return false;

  return true;
};

// Capture keeps a drag going past the element's edge; a pointer that is already gone cannot be captured, and the drag then ends at the edge.
const capture = (element: Element, event: PointerEvent): void => {
  try {
    element.setPointerCapture(event.pointerId);
  } catch {
    // the moves still arrive while the pointer is over the element
  }
};

/** A drag has to move this far before it pans, so a click still selects. */
const DRAG = 4;

/** Pans by a drag on the Map, from empty space or from a box. */
export const startPan = (host: DevtoolsPanel, event: PointerEvent): void => {
  const layout = host._nested();
  // SAFETY: the listener is on the Map viewport's own element
  const scroller = event.currentTarget as HTMLElement;

  if (!layout || event.button !== 0 || !host._pans(layout)) return;

  const from = host._viewOf(layout);
  let dragging = false;

  const move = (to: PointerEvent) => {
    const x = to.clientX - event.clientX;
    const y = to.clientY - event.clientY;

    if (!dragging && Math.hypot(x, y) < DRAG) return;

    if (!dragging) {
      dragging = true;
      scroller.toggleAttribute('data-panning', true);
    }

    host._panTo(layout, { x: from.x + x, y: from.y + y }, false);
  };

  const swallow = (click: Event) => click.stopPropagation();

  // The drag is followed on the window, so it goes on when the pointer leaves the Map.
  const end = () => {
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', end);
    removeEventListener('pointercancel', end);
    scroller.removeAttribute('data-panning');

    if (!dragging) return;

    // The click that ends a drag selects nothing.
    scroller.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => scroller.removeEventListener('click', swallow, true));
  };

  addEventListener('pointermove', move);
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
};

const wheeled = new WeakMap<DevtoolsPanel, number>();

/** How much wheel travel with Control or Command held changes the type step once. */
const NOTCH = 48;

/**
 * The wheel pans the Map while there is more of it that way, and past its edge scrolls the page as any scroller would.
 * With Control or Command held, which is also what a pinch sends, it changes the type step.
 */
export const wheelPan = (host: DevtoolsPanel, event: WheelEvent): void => {
  const layout = host._nested();

  if (!layout) return;

  const lines = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;

  if (event.ctrlKey || event.metaKey) {
    const total = (wheeled.get(host) ?? 0) + event.deltaY * lines;
    const steps = Math.trunc(total / NOTCH);

    event.preventDefault();
    wheeled.set(host, total - steps * NOTCH);

    if (steps) host._zoomBy(layout, -Math.sign(steps));

    return;
  }

  const view = host._viewOf(layout);

  const moved = host._panTo(
    layout,
    { x: view.x - event.deltaX * lines, y: view.y - event.deltaY * lines },
    false,
  );

  if (moved) event.preventDefault();
};

/** The largest the minimap is drawn. */
const MINI = { width: 144, height: 60 };

/** The room the minimap takes at the block end, its frame and margin included; the diagram can be pulled clear of it. */
export const MINI_FOOT = 84;

// A thumbnail of the whole layout with the part in view outlined, drawn only while the layout overflows the room.
// A press or a drag on it puts that point in the middle of the room. It is a pointer's shortcut, so it is hidden from assistive technology.
export const renderMinimap = (
  host: DevtoolsPanel,
  layout: NestedLayout,
  view: View,
  room: Size,
): TemplateResult | typeof nothing => {
  const { placed, rects, open } = layout;

  if (!overflows(placed, room)) return nothing;

  const scale = Math.min(
    MINI.width / placed.width,
    MINI.height / placed.height,
  );

  const width = Math.ceil(placed.width * scale);
  const height = Math.ceil(placed.height * scale);

  // The part of the diagram in the room, held to the thumbnail's own outline.
  const left = Math.min(width - 2, Math.max(0, -view.x * scale));
  const top = Math.min(height - 2, Math.max(0, -view.y * scale));

  const centre = (event: PointerEvent) => {
    // SAFETY: the listener is on the minimap's own element
    const box = (event.currentTarget as Element).getBoundingClientRect();

    host._panTo(
      layout,
      {
        x: room.width / 2 - (event.clientX - box.x) / scale,
        y: room.height / 2 - (event.clientY - box.y) / scale,
      },
      false,
    );
  };

  const press = (event: PointerEvent) => {
    // SAFETY: the listener is on the minimap's own element
    capture(event.currentTarget as Element, event);
    event.stopPropagation();
    centre(event);
  };

  const drag = (event: PointerEvent) => {
    if (event.buttons & 1) centre(event);
  };

  return html`<svg
    class="minimap"
    aria-hidden="true"
    width=${width}
    height=${height}
    viewBox="0 0 ${width} ${height}"
    @pointerdown=${press}
    @pointermove=${drag}
  >
    ${[...rects].map(
      ([name, rect]) =>
        svg`<rect
          class="${host._depthClass(name)} ${open.has(name) ? 'open' : ''} ${name === host._model.current.name ? 'current' : ''}"
          x=${rect.x * scale}
          y=${rect.y * scale}
          width=${rect.width * scale}
          height=${rect.height * scale}
        />`,
    )}
    <rect
      class="window"
      x=${left + 0.5}
      y=${top + 0.5}
      width=${Math.max(1, Math.min(width, left + room.width * scale) - left - 1)}
      height=${Math.max(1, Math.min(height, top + room.height * scale) - top - 1)}
    />
  </svg>`;
};
