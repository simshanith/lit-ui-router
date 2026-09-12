/**
 * THE FIELD — the cover's own geometry, behind the card grids.
 *
 * `<atlas-lattice>` fills its field wrapper and draws ONE wireframe cube
 * lattice on a canvas: a lattice of unit cubes on the ground, seen from a
 * projection that is deliberately NOT the plates' 30 degree isometric — a
 * turn about the vertical axis (one full turn every 240 s) under a 21 degree
 * pitch, orthographic, so the lattice reads as a different space from the
 * drawings it sits behind. The cubes are wide and the line is dotted, so the
 * field is a sparse measure rather than a mesh.
 *
 * CARD-ONLY. Each frame is clipped to the union of the whole `.card` rects,
 * so the lattice paints under the card — window AND text, the body's paper
 * being translucent — and nowhere else: the gaps between cards, and the empty
 * tracks of a short last row, stay ground. One field, one set of world
 * coordinates: a line that leaves one card enters the next on its true path.
 *
 * THE CANVAS IS ONE VIEWPORT TALL and sticky inside the field (see the CSS in
 * index.html), so a grid four screens long costs one screen of pixels. The
 * field still owns the geometry: the canvas's offset down the field is turned
 * into a translation of the lattice along the ground, taken modulo the cell,
 * which lands on the same infinite lattice — the same picture the tall canvas
 * would have drawn, at constant cost.
 *
 * No dependency and no three.js: three is loaded on demand for the city plate
 * and nowhere else, and the cover keeps it that way.
 */

const TAG = 'atlas-lattice';

/** one full turn about the vertical axis */
const TURN_MS = 240_000;
/** the pitch, well off the plates' isometric */
const PITCH = (21 * Math.PI) / 180;
/** the angle the still frame holds under `prefers-reduced-motion: reduce` */
const REST_YAW = (37 * Math.PI) / 180;
/** the cube: its footprint on the ground and its height, in css px */
const CELL = 220;
const RISE = 160;
/** cubes stacked, so LEVELS + 1 planes of lattice points */
const LEVELS = 2;
/** the house line: --ink, this faint, 1px, round joins */
const INK_ALPHA = 0.16;
/** dotted: a 1px dash under a round cap is a round point, every 4 px */
const DASH: [number, number] = [1, 3];

const SIN_P = Math.sin(PITCH);
const COS_P = Math.cos(PITCH);

interface Win {
  x: number;
  y: number;
  w: number;
  h: number;
}

class AtlasLattice extends HTMLElement {
  #canvas: HTMLCanvasElement | null = null;
  #ctx: CanvasRenderingContext2D | null = null;
  #raf = 0;
  #wins: Win[] = [];
  #measured = false;
  #ink = 'currentColor';
  #inkRead = false;
  #still = false;
  #inView = true;
  #lastOff = Number.NaN;
  #ro: ResizeObserver | null = null;
  #io: IntersectionObserver | null = null;
  #mo: MutationObserver | null = null;
  #themeMo: MutationObserver | null = null;
  #motion: MediaQueryList | null = null;
  #scheme: MediaQueryList | null = null;

  connectedCallback(): void {
    if (!this.#canvas) {
      const canvas = document.createElement('canvas');
      this.#canvas = canvas;
      this.#ctx = canvas.getContext('2d');
      this.append(canvas);
    }
    this.#motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.#scheme = matchMedia('(prefers-color-scheme: dark)');
    this.#still = this.#motion.matches;
    this.#motion.addEventListener('change', this.#onMotion);
    this.#scheme.addEventListener('change', this.#onTheme);
    this.#themeMo = new MutationObserver(this.#onTheme);
    this.#themeMo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    // The field's height moves when the grid reflows, and its width when the
    // window does: either way the window rects have to be read again.
    this.#ro = new ResizeObserver(this.#invalidate);
    this.#ro.observe(this);
    // A filter changes the card list without necessarily changing the height.
    const grid = this.parentElement?.querySelector('.cards');
    if (grid) {
      this.#mo = new MutationObserver(this.#invalidate);
      this.#mo.observe(grid, { childList: true, subtree: true });
    }
    this.#io = new IntersectionObserver(this.#onIntersect);
    this.#io.observe(this);
    document.addEventListener('visibilitychange', this.#onVisibility);
    this.#run();
  }

  disconnectedCallback(): void {
    this.#stop();
    this.#motion?.removeEventListener('change', this.#onMotion);
    this.#scheme?.removeEventListener('change', this.#onTheme);
    this.#themeMo?.disconnect();
    this.#ro?.disconnect();
    this.#mo?.disconnect();
    this.#io?.disconnect();
    document.removeEventListener('visibilitychange', this.#onVisibility);
    this.#themeMo = null;
    this.#ro = null;
    this.#mo = null;
    this.#io = null;
  }

  #invalidate = (): void => {
    this.#measured = false;
    this.#lastOff = Number.NaN;
  };

  #onMotion = (): void => {
    this.#still = this.#motion?.matches ?? false;
    this.#lastOff = Number.NaN;
    this.#run();
  };

  #onTheme = (): void => {
    this.#inkRead = false;
    this.#lastOff = Number.NaN;
  };

  #onIntersect = (entries: IntersectionObserverEntry[]): void => {
    this.#inView = entries[entries.length - 1]?.isIntersecting ?? true;
    this.#run();
  };

  #onVisibility = (): void => {
    this.#run();
  };

  /** The loop runs only while the field is on screen and the tab is shown. */
  #run(): void {
    if (this.isConnected && this.#inView && !document.hidden) {
      if (this.#raf === 0) this.#raf = requestAnimationFrame(this.#frame);
    } else this.#stop();
  }

  #stop(): void {
    if (this.#raf !== 0) cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  #frame = (now: number): void => {
    this.#raf = requestAnimationFrame(this.#frame);
    this.#draw(now);
  };

  /** The cards, in the field's own coordinates. */
  #measure(): void {
    const field = this.getBoundingClientRect();
    const boxes = this.parentElement?.querySelectorAll('.card') ?? [];
    this.#wins = Array.from(boxes, (box) => {
      const rect = box.getBoundingClientRect();
      return {
        x: rect.left - field.left,
        y: rect.top - field.top,
        w: rect.width,
        h: rect.height,
      };
    });
    this.#measured = true;
  }

  #draw(now: number): void {
    const canvas = this.#canvas;
    const ctx = this.#ctx;
    if (!canvas || !ctx) return;
    const here = canvas.getBoundingClientRect();
    const field = this.getBoundingClientRect();
    const w = here.width;
    const h = here.height;
    if (w < 1 || h < 1) return;
    // how far down the field the sticky canvas currently sits
    const off = here.top - field.top;
    if (this.#still && off === this.#lastOff && this.#measured) return;
    this.#lastOff = off;
    if (!this.#measured) this.#measure();
    if (!this.#inkRead) {
      this.#ink = getComputedStyle(this).color;
      this.#inkRead = true;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (this.#wins.length === 0) return;

    ctx.save();
    ctx.beginPath();
    for (const win of this.#wins) ctx.rect(win.x, win.y - off, win.w, win.h);
    ctx.clip();

    const yaw = this.#still ? REST_YAW : ((now % TURN_MS) / TURN_MS) * Math.PI * 2;
    const ca = Math.cos(yaw);
    const sa = Math.sin(yaw);
    const cx = w / 2;
    const cy = h / 2;
    // The canvas is a moving window on a field-anchored lattice. Ask the
    // ground for the translation that puts the lattice where the field wants
    // it, then drop the whole cells: the lattice maps onto itself, so the
    // picture is the field's, and the index range stays the canvas's.
    const ry0 = -off / SIN_P;
    const ox = (ry0 * sa) % CELL;
    const oy = (ry0 * ca) % CELL;
    // far enough out that the lattice covers the canvas at every yaw
    const reach = Math.hypot(cx, (cy + LEVELS * RISE * COS_P) / SIN_P);
    const n = Math.ceil(reach / CELL) + 1;

    const px = (x: number, y: number): number => cx + (x * ca - y * sa);
    const py = (x: number, y: number, z: number): number =>
      cy + (x * sa + y * ca) * SIN_P - z * COS_P;

    ctx.beginPath();
    const lo = -n * CELL;
    const hi = n * CELL;
    for (let k = 0; k <= LEVELS; k++) {
      const z = k * RISE;
      for (let i = -n; i <= n; i++) {
        const at = i * CELL;
        // the two ground families, each one straight line end to end
        ctx.moveTo(px(lo + ox, at + oy), py(lo + ox, at + oy, z));
        ctx.lineTo(px(hi + ox, at + oy), py(hi + ox, at + oy, z));
        ctx.moveTo(px(at + ox, lo + oy), py(at + ox, lo + oy, z));
        ctx.lineTo(px(at + ox, hi + oy), py(at + ox, hi + oy, z));
      }
    }
    // the cubes' uprights, the only family worth culling: one per lattice
    // point on the ground, and most of them fall outside the canvas
    const top = LEVELS * RISE * COS_P;
    for (let i = -n; i <= n; i++) {
      const x = i * CELL + ox;
      for (let j = -n; j <= n; j++) {
        const y = j * CELL + oy;
        const sx = px(x, y);
        if (sx < -1 || sx > w + 1) continue;
        const sy = py(x, y, 0);
        if (sy < -1 - top || sy > h + 1) continue;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy - top);
      }
    }
    ctx.globalAlpha = INK_ALPHA;
    ctx.strokeStyle = this.#ink;
    // The dash phase is fixed, so the dots never crawl frame to frame; they
    // slide along a segment only as the turn changes its length.
    ctx.setLineDash(DASH);
    ctx.lineDashOffset = 0;
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }
}

/** Client only: the tag is inert markup until this runs. */
export function installLattice(): void {
  if (!customElements.get(TAG)) customElements.define(TAG, AtlasLattice);
}
