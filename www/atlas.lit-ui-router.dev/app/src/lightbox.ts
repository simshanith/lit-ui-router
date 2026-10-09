/**
 * <atlas-lightbox> — the app's answer to every `.fill` button a fragment
 * carries. One instance serves the document: one figure is enlarged at a
 * time, and the scroll lock, the focus trap and the delegated click are
 * document-wide, so a second instance would only have to defer to the first.
 *
 * A plate (`.plate`, a static SVG) is cloned into the lightbox, which covers
 * the viewport and zooms and pans the copy with a CSS transform. A stage (a
 * lane's cytoscape graph, the bricks or the city in <model-viewer>) owns its
 * own camera, so it is enlarged in place as the `.is-filled` overlay and the
 * lightbox keeps only CLOSE and FULL SCREEN over it. Either way the box hears
 * `atlas-fill` and the window a `resize`, and `html.has-filled` locks the page.
 *
 * The enlarged figure is the url's `?enlarge=`, a dynamic param beside
 * `?focus`: the button pushes it, CLOSE and Escape take the entry back, Back
 * closes, and a deep link opens once the page is adopted.
 */
import type { UIRouter } from '@uirouter/core';
import { LitElement, css, html, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';

type Mode = 'plate' | 'stage';

interface Point {
  x: number;
  y: number;
}

const MAX_SCALE = 8;
const STEP = 1.5;
const PAN_STEP = 64;
// the bars float over the figure; a fitted plate sits between them
const INSET = { top: 56, right: 16, bottom: 64, left: 16 };

const tell = (box: Element): void => {
  box.dispatchEvent(new CustomEvent('atlas-fill', { bubbles: true }));
  window.dispatchEvent(new Event('resize'));
};

/** The focused element, read through open shadow roots. */
const deepActive = (): Element | null => {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
};

/** A figure's `?enlarge=` value: its own id, else its sheet section's. */
export const figureId = (box: Element): string => box.id || box.closest('section[id]')?.id || '';

const findFigure = (id: string): HTMLElement | null =>
  [...document.querySelectorAll<HTMLElement>('.fillable')].find((box) => figureId(box) === id) ?? null;

const FOCUSABLE =
  'a[href], button:not([disabled]):not([hidden]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export class AtlasLightbox extends LitElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
    mode: { reflect: true },
    label: { state: true },
    scale: { state: true },
    x: { state: true },
    y: { state: true },
    full: { state: true },
    canFull: { state: true },
    navigate: { attribute: false },
  };

  declare open: boolean;
  declare mode: Mode;
  declare label: string;
  declare scale: number;
  declare x: number;
  declare y: number;
  declare full: boolean;
  declare canFull: boolean;
  /** Moves the url to `?enlarge=id`, or off it; unset, the lightbox opens and closes directly. */
  declare navigate: ((id: string | null) => void) | undefined;

  #box: HTMLElement | null = null;
  #opener: HTMLElement | null = null;
  #size = { w: 1, h: 1 };
  #fitted = true;
  #pointers = new Map<number, Point>();
  #glide = false;
  #page: AbortController | undefined;

  constructor() {
    super();
    this.open = false;
    this.mode = 'plate';
    this.label = '';
    this.scale = 1;
    this.x = 0;
    this.y = 0;
    this.full = false;
    this.canFull = false;
    this.navigate = undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.canFull = document.fullscreenEnabled;
    this.#page = new AbortController();
    const signal = this.#page.signal;
    document.addEventListener('click', this.#onPageClick, { signal });
    document.addEventListener('keydown', this.#onKey, { signal, capture: true });
    document.addEventListener('fullscreenchange', this.#onFullscreen, { signal });
    window.addEventListener('resize', this.#onResize, { signal });
  }

  override disconnectedCallback(): void {
    this.#page?.abort();
    this.close(false);
    super.disconnectedCallback();
  }

  /** Enlarges the `.fillable` box `opener` belongs to. */
  show(box: HTMLElement, opener: HTMLElement | null): void {
    if (this.open) this.close(false);
    const svg = box.classList.contains('plate') ? box.querySelector('.figure-wrap > svg') : null;
    this.#box = box;
    this.#opener = opener;
    this.label = this.#labelFor(box);
    if (svg instanceof SVGSVGElement) {
      this.mode = 'plate';
      const copy = svg.cloneNode(true) as SVGSVGElement;
      const view = svg.viewBox.baseVal;
      const rect = svg.getBoundingClientRect();
      this.#size = view.width > 0 ? { w: view.width, h: view.height } : { w: rect.width, h: rect.height };
      copy.removeAttribute('style');
      copy.setAttribute('width', String(this.#size.w));
      copy.setAttribute('height', String(this.#size.h));
      this.replaceChildren(copy);
    } else {
      this.mode = 'stage';
      box.classList.add('is-filled');
      const fill = box.querySelector<HTMLElement>(':scope > .fill');
      if (fill) fill.hidden = true;
    }
    document.documentElement.classList.add('has-filled');
    this.open = true;
    this.#fitted = true;
    void this.updateComplete.then(() => {
      this.#fit(false);
      this.renderRoot.querySelector<HTMLElement>(this.mode === 'plate' ? '.view' : '.close')?.focus();
      tell(box);
    });
  }

  /** Puts the figure back and focus on the button that opened it. */
  close(restoreFocus = true): void {
    if (!this.open) return;
    const box = this.#box;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    this.open = false;
    this.replaceChildren();
    document.documentElement.classList.remove('has-filled');
    this.#pointers.clear();
    this.#box = null;
    if (!box) return;
    if (this.mode === 'stage') {
      box.classList.remove('is-filled');
      const fill = box.querySelector<HTMLElement>(':scope > .fill');
      if (fill) fill.hidden = false;
    }
    tell(box);
    if (restoreFocus && this.#opener?.isConnected) this.#opener.focus({ preventScroll: true });
    this.#opener = null;
  }

  /** Opens the figure `id` names, or closes; false when no figure in the page carries it. */
  sync(id: string | null): boolean {
    if (id === null) {
      this.close();
      return true;
    }
    const box = findFigure(id);
    if (!box) return false;
    if (!this.open || this.#box !== box) this.show(box, box.querySelector<HTMLElement>(':scope > .fill'));
    return true;
  }

  /** CLOSE, Escape and a second press of the button. */
  dismiss(): void {
    if (this.navigate) this.navigate(null);
    else this.close();
  }

  #labelFor(box: HTMLElement): string {
    const figno = box.closest('figure')?.querySelector('.figno')?.textContent?.trim();
    return figno ? `${figno}, enlarged` : 'the figure, enlarged';
  }

  // --- the page's listeners ------------------------------------------------

  #onPageClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest<HTMLElement>('.fill') ?? null;
    const box = button?.closest<HTMLElement>('.fillable');
    if (!button || !box) return;
    if (this.open && this.#box === box) this.dismiss();
    else if (this.navigate) this.navigate(figureId(box));
    else this.show(box, button);
  };

  #onKey = (event: KeyboardEvent): void => {
    if (!this.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dismiss();
      return;
    }
    if (event.key === 'Tab') {
      this.#trap(event);
      return;
    }
    if (this.mode !== 'plate' || event.altKey || event.ctrlKey || event.metaKey) return;
    if (deepActive()?.closest('button')) return; // a focused button keeps Enter, Space and its arrows
    this.#zoomKey(event);
  };

  #zoomKey(event: KeyboardEvent): void {
    const pan = event.shiftKey ? PAN_STEP * 4 : PAN_STEP;
    const moves: Record<string, () => void> = {
      ArrowLeft: () => this.#panBy(pan, 0, true),
      ArrowRight: () => this.#panBy(-pan, 0, true),
      ArrowUp: () => this.#panBy(0, pan, true),
      ArrowDown: () => this.#panBy(0, -pan, true),
      '+': () => this.#zoomStep(STEP),
      '=': () => this.#zoomStep(STEP),
      '-': () => this.#zoomStep(1 / STEP),
      '0': () => this.#fit(true),
      '1': () => this.#actual(),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
  }

  #trap(event: KeyboardEvent): void {
    const stops = this.#stops();
    if (stops.length === 0) return;
    event.preventDefault();
    const at = stops.indexOf(deepActive() as HTMLElement);
    const step = event.shiftKey ? -1 : 1;
    const next = at === -1 ? 0 : (at + step + stops.length) % stops.length;
    stops[next]?.focus();
  }

  /** Every stop Tab may reach while open: the lightbox's own, then a stage's. */
  #stops(): HTMLElement[] {
    const own = [...this.renderRoot.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const inBox =
      this.mode === 'stage' && this.#box
        ? [...this.#box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
            (el) => el.getClientRects().length > 0,
          )
        : [];
    return [...own, ...inBox];
  }

  #onFullscreen = (): void => {
    this.full = document.fullscreenElement !== null && this.open;
    if (this.#box) tell(this.#box);
  };

  #onResize = (): void => {
    if (!this.open || this.mode !== 'plate') return;
    if (this.#fitted) this.#fit(false);
    else this.#place(this.scale, this.x, this.y, false);
  };

  #toggleFull(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    // a stage stays in the page under the lightbox's bar, so the whole page goes
    const target = this.mode === 'plate' ? this : document.documentElement;
    target.requestFullscreen().catch(() => {
      this.canFull = false;
    });
  }

  // --- the camera ---------------------------------------------------------------

  #viewport(): { w: number; h: number } {
    const view = this.renderRoot.querySelector<HTMLElement>('.view');
    return { w: view?.clientWidth ?? window.innerWidth, h: view?.clientHeight ?? window.innerHeight };
  }

  #fitScale(): number {
    const { w, h } = this.#viewport();
    const room = {
      w: Math.max(w - INSET.left - INSET.right, 1),
      h: Math.max(h - INSET.top - INSET.bottom, 1),
    };
    return Math.min(room.w / this.#size.w, room.h / this.#size.h);
  }

  #minScale(): number {
    return Math.min(this.#fitScale(), 1) / 2;
  }

  #fit(glide: boolean): void {
    if (this.mode !== 'plate') return;
    const { w, h } = this.#viewport();
    const scale = this.#fitScale();
    const roomH = h - INSET.top - INSET.bottom;
    this.#place(
      scale,
      (w - this.#size.w * scale) / 2,
      INSET.top + (roomH - this.#size.h * scale) / 2,
      glide,
    );
    this.#fitted = true;
  }

  #actual(): void {
    const { w, h } = this.#viewport();
    this.#zoomAbout(1, { x: w / 2, y: h / 2 }, true);
  }

  #zoomStep(factor: number): void {
    const { w, h } = this.#viewport();
    this.#zoomAbout(this.scale * factor, { x: w / 2, y: h / 2 }, true);
  }

  /** Scales to `next`, keeping the figure point under `at` where it is. */
  #zoomAbout(next: number, at: Point, glide: boolean): void {
    const scale = Math.min(Math.max(next, this.#minScale()), MAX_SCALE);
    const k = scale / this.scale;
    this.#place(scale, at.x - (at.x - this.x) * k, at.y - (at.y - this.y) * k, glide);
    this.#fitted = false;
  }

  #panBy(dx: number, dy: number, glide: boolean): void {
    this.#place(this.scale, this.x + dx, this.y + dy, glide);
    this.#fitted = false;
  }

  /** Keeps a margin of the figure on screen whichever way it is pushed. */
  #place(scale: number, x: number, y: number, glide: boolean): void {
    const { w, h } = this.#viewport();
    const fw = this.#size.w * scale;
    const fh = this.#size.h * scale;
    const keep = 96;
    const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
    this.#glide = glide;
    this.scale = scale;
    this.x = clamp(x, Math.min(keep - fw, (w - fw) / 2), Math.max(w - keep, (w - fw) / 2));
    this.y = clamp(y, Math.min(keep - fh, (h - fh) / 2), Math.max(h - keep, (h - fh) / 2));
  }

  // --- pointer, wheel and pinch ---------------------------------------------

  #local(event: { clientX: number; clientY: number }): Point {
    const rect = this.renderRoot.querySelector('.view')?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  }

  #onWheel = {
    handleEvent: (event: WheelEvent): void => {
      event.preventDefault();
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
      // a trackpad pinch arrives as a ctrl-wheel with small deltas
      const rate = event.ctrlKey ? 0.01 : 0.0015;
      this.#zoomAbout(this.scale * Math.exp(-event.deltaY * unit * rate), this.#local(event), false);
    },
    passive: false,
  };

  #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const view = event.currentTarget as HTMLElement;
    // a drag pans; it never starts a text selection in the plate's lettering
    event.preventDefault();
    view.focus({ preventScroll: true });
    this.#pointers.set(event.pointerId, this.#local(event));
  };

  #onPointerMove = (event: PointerEvent): void => {
    const was = this.#pointers.get(event.pointerId);
    if (!was) return;
    const now = this.#local(event);
    const view = event.currentTarget as HTMLElement;
    // captured once it moves, so a still press on a plate's link stays a click
    if (!view.hasPointerCapture(event.pointerId)) view.setPointerCapture(event.pointerId);
    if (this.#pointers.size === 1) {
      this.#pointers.set(event.pointerId, now);
      this.#panBy(now.x - was.x, now.y - was.y, false);
      return;
    }
    const [a, b] = [...this.#pointers.values()];
    if (!a || !b) return;
    const before = { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d: Math.hypot(a.x - b.x, a.y - b.y) };
    this.#pointers.set(event.pointerId, now);
    const [c, d] = [...this.#pointers.values()];
    if (!c || !d) return;
    const mid = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 };
    const dist = Math.hypot(c.x - d.x, c.y - d.y);
    if (before.d > 0) this.#zoomAbout(this.scale * (dist / before.d), before.mid, false);
    this.#panBy(mid.x - before.mid.x, mid.y - before.mid.y, false);
  };

  #onPointerUp = (event: PointerEvent): void => {
    this.#pointers.delete(event.pointerId);
  };

  #onDoubleClick = (event: MouseEvent): void => {
    const factor = event.shiftKey || event.altKey ? 1 / 2 : 2;
    this.#zoomAbout(this.scale * factor, this.#local(event), true);
  };

  // --- render ----------------------------------------------------------------

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('open')) return;
    if (this.open) {
      this.setAttribute('role', 'dialog');
      this.setAttribute('aria-modal', 'true');
    } else {
      this.removeAttribute('role');
      this.removeAttribute('aria-modal');
      this.full = false;
    }
  }

  override render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing;
    const close = html`<button type="button" class="close" @click=${() => this.dismiss()}>
      CLOSE ✕
    </button>`;
    const full = this.canFull
      ? html`<button type="button" aria-pressed=${this.full ? 'true' : 'false'} @click=${() => this.#toggleFull()}>
          ${this.full ? 'EXIT FULL SCREEN' : 'FULL SCREEN ⛶'}
        </button>`
      : nothing;
    if (this.mode === 'stage') return html`<div class="bar" role="group" aria-label=${this.label}>${full}${close}</div>`;
    const glide = this.#glide ? 'glide' : '';
    return html`
      <div
        class="view"
        tabindex="0"
        role="img"
        aria-label="${this.label}: drag or use the arrow keys to pan, the wheel, a pinch or + and − to zoom"
        @wheel=${this.#onWheel}
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#onPointerUp}
        @pointercancel=${this.#onPointerUp}
        @dblclick=${this.#onDoubleClick}
      >
        <div
          class="zoom ${glide}"
          style="transform: translate(${this.x}px, ${this.y}px) scale(${this.scale})"
        >
          <slot></slot>
        </div>
      </div>
      <div class="bar top">
        <span class="label">${this.label.toUpperCase()}</span>
        <span class="end">${full}${close}</span>
      </div>
      <div class="bar bottom" role="group" aria-label="zoom">
        <button type="button" aria-label="zoom out" @click=${() => this.#zoomStep(1 / STEP)}>−</button>
        <output class="pct" aria-live="polite">${Math.round(this.scale * 100)}%</output>
        <button type="button" aria-label="zoom in" @click=${() => this.#zoomStep(STEP)}>+</button>
        <button type="button" aria-label="fit the figure to the window" @click=${() => this.#fit(true)}>
          FIT
        </button>
        <button type="button" aria-label="actual size" @click=${() => this.#actual()}>1:1</button>
      </div>
    `;
  }

  static override styles = css`
    :host {
      --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
      --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
      display: none;
    }
    :host([open]) {
      display: block;
      position: fixed;
      z-index: 70;
      font-family: var(--data);
      color: var(--ink);
      animation: arrive 0.16s ease-out;
    }
    :host([open][mode='plate']) {
      inset: 0;
      background: var(--paper);
    }
    :host([open][mode='stage']) {
      inset-block-start: 8px;
      inset-inline-end: 8px;
    }
    @keyframes arrive {
      from {
        opacity: 0;
      }
    }
    .view {
      position: absolute;
      inset: 0;
      overflow: clip;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      cursor: grab;
    }
    .view:active {
      cursor: grabbing;
    }
    /* inset: the view fills the viewport, so an outer ring would fall off it */
    .view:focus-visible {
      outline: max(2px, 0.08em) solid var(--accent);
      outline-offset: calc(-1 * max(2px, 0.08em));
    }
    /* physical: the script pans in x and y from the top-left corner */
    .zoom {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
    }
    ::slotted(svg) {
      display: block;
      max-width: none;
    }
    .bar {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .top {
      position: absolute;
      inset-block-start: 0;
      inset-inline: 0;
      justify-content: space-between;
      padding: 12px 16px;
      pointer-events: none;
      background: linear-gradient(var(--paper) 60%, transparent);
    }
    .top > * {
      pointer-events: auto;
    }
    .label {
      font-size: 10.5px;
      letter-spacing: 0.16em;
      color: var(--ink-soft);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
    .end {
      display: flex;
      gap: 6px;
      flex: none;
    }
    .bottom {
      position: absolute;
      inset-block-end: 16px;
      inset-inline: 0;
      width: fit-content;
      margin-inline: auto;
      padding: 4px;
      background: var(--paper);
      border: 1px solid var(--ink-soft);
    }
    button {
      font: inherit;
      font-size: 9.5px;
      font-weight: 600;
      letter-spacing: 0.16em;
      line-height: 1;
      color: var(--ink);
      background: var(--paper);
      border: 1px solid var(--ink);
      padding: 7px 9px;
      cursor: pointer;
      white-space: nowrap;
    }
    .bottom button {
      min-width: 32px;
    }
    button:focus-visible {
      background: var(--paper-2);
      outline: max(2px, 0.08em) solid var(--accent);
      outline-offset: 0.25em;
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover {
        background: var(--paper-2);
      }
    }
    button:active {
      transform: scale(0.97);
    }
    .pct {
      min-width: 44px;
      text-align: center;
      font-size: 10px;
      letter-spacing: 0.08em;
      font-variant-numeric: tabular-nums;
    }
    @media (prefers-reduced-motion: no-preference) {
      .zoom.glide {
        transition: transform 0.18s ease-out;
      }
      button {
        transition: transform 160ms var(--ease-out, ease-out);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host([open]) {
        animation: none;
      }
    }
  `;
}

if (!customElements.get('atlas-lightbox')) customElements.define('atlas-lightbox', AtlasLightbox);

declare global {
  interface HTMLElementTagNameMap {
    'atlas-lightbox': AtlasLightbox;
  }
}

/** Waits up to a second of frames for a figure the page has not drawn yet. */
async function found(lightbox: AtlasLightbox, id: string): Promise<boolean> {
  for (let frame = 0; frame < 60; frame += 1) {
    if (lightbox.sync(id)) return true;
    await new Promise((done) => requestAnimationFrame(done));
  }
  return false;
}

/**
 * Seats the document's one lightbox and routes it: `?enlarge=` opens the
 * figure it names, and an id no figure carries is dropped from the url.
 */
export function installLightbox(router: UIRouter): AtlasLightbox {
  const lightbox = document.querySelector('atlas-lightbox') ?? document.createElement('atlas-lightbox');
  if (!lightbox.isConnected) document.body.append(lightbox);
  // true while the entry under this one is the same page without `?enlarge=`
  let ours = false;
  // both params are `inherit: false`, so each move carries the other
  const go = (enlarge: string | null, location: true | 'replace'): void => {
    const { focus } = router.globals.params;
    router.stateService.go('.', { enlarge, focus }, { location }).then(
      () => {},
      () => {}, // a superseded move is not an error here
    );
  };
  lightbox.navigate = (id) => {
    if (id !== null) {
      go(id, true);
      ours = true;
    } else if (ours) history.back();
    else go(null, 'replace');
  };
  const sync = async (id: string | null): Promise<void> => {
    if (id === null) lightbox.sync(null);
    if (id === null || (await found(lightbox, id))) return;
    if (router.globals.params.enlarge === id) go(null, 'replace');
  };
  router.transitionService.onSuccess({}, (transition) => {
    const id = (transition.params().enlarge as string | null | undefined) ?? null;
    const before = (transition.params('from').enlarge as string | null | undefined) ?? null;
    if (id === null) ours = false;
    // a step forward onto `?enlarge=` from the same page leaves that page beneath it
    else if (before === null && transition.from().name === transition.to().name) ours = true;
    void sync(id);
  });
  void sync((router.globals.params.enlarge as string | null | undefined) ?? null);
  return lightbox;
}
