import { iso } from './helpers.mjs';

// A string with end studs: a 1×1 round plate seated on a stud at each end, its own stud on top, and a cord between those studs; fit, never massed.
export const CORD_CAP = { h: 8, r: 19, stud: { r: 12, h: 7 } };
/** The height from the stud a cap sits on to the top of the cap's own stud, where the cord leaves. */
export const capTop = (cap = CORD_CAP) => cap.h + cap.stud.h;
const SAG = 0.15, SAMPLES = 32;

/** A cord between two stud tops [x, y, z]: a quadratic from cap stud to cap stud, its control over the plan midpoint and below the higher end by SAG of the length that runs level. */
export function cordCurve(from, to, { sag = SAG, cap = CORD_CAP } = {}) {
  const A = [from[0], from[1], from[2] + capTop(cap)], B = [to[0], to[1], to[2] + capTop(cap)];
  const len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) || 1, fall = Math.abs(A[2] - B[2]);
  const C = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, Math.max(A[2], B[2]) - sag * len * (1 - fall / len)];
  const at = (t) => [0, 1, 2].map((k) => (1 - t) ** 2 * A[k] + 2 * t * (1 - t) * C[k] + t ** 2 * B[k]);
  return { from, to, cap, A, B, C, len, at, pts: Array.from({ length: SAMPLES + 1 }, (_, k) => at(k / SAMPLES)) };
}

function hull(pts) {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => list.reduce((h, p) => {
    while (h.length > 1 && cross(h.at(-2), h.at(-1), p) <= 0) h.pop();
    return [...h, p];
  }, []);
  return [...half(s).slice(0, -1), ...half([...s].reverse()).slice(0, -1)];
}
/** A cord's two caps as end masses {id, poly, box, end}: each its round plate, which the cord leaves from its stud above it. */
export function capMasses(curve, project = (P) => iso(...P), id = 'cap') {
  const { r, h } = curve.cap;
  return [curve.from, curve.to].flatMap(([x, y, z], k) => {
    const ring = (rr, zz) => Array.from({ length: 16 }, (_, a) => project([x + rr * Math.cos((a * Math.PI) / 8), y + rr * Math.sin((a * Math.PI) / 8), zz]));
    const drum = (rr, z0, z1, part) => ({ id: `${id} ${k ? 'at the runtime' : 'on the brick'}, its ${part}`, poly: hull([...ring(rr, z0), ...ring(rr, z1)]), box: { x: x - rr, y: y - rr, w: 2 * rr, d: 2 * rr, z0, h: z1 - z0 }, end: true });
    return [drum(r, z, z + h, 'plate')];
  });
}

const pointIn = ([px, py], poly) => [1, -1].some((s) => poly.every((a, i) => {
  const b = poly[(i + 1) % poly.length];
  return s * ((b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0])) >= 0;
}));
function edgeGap([px, py], poly) {
  return Math.min(...poly.map(([ax, ay], i) => {
    const [bx, by] = poly[(i + 1) % poly.length], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }));
}

/** The first mass {id, poly, box, end} a cord meets, or null: it misses every outline outright, but its own caps and one marked `end` it may cross above or in front of. */
export function cordHit(curve, masses, project = (P) => iso(...P)) {
  const all = [...capMasses(curve, project), ...masses];
  for (const P of curve.pts) {
    const c = project(P);
    for (const m of all) {
      if (!pointIn(c, m.poly) || edgeGap(c, m.poly) < 1) continue;
      const b = m.box, seen = P[0] >= b.x + b.w || P[1] >= b.y + b.d || P[2] >= b.z0 + b.h;
      if (!m.end || !seen) return m.id;
    }
  }
  return null;
}
/** Whether a cord clears every silhouette it does not end on. */
export const cordClear = (curve, masses, project) => !cordHit(curve, masses, project);

// The drawing kit at one stud pitch U over the plate's projection `pt(ox, oy, x, y, z)` (brick-iso's, in U-scaled units).
export function cordKit({ U = 40, pt }) {
  const K = U / 40, cap = { h: CORD_CAP.h * K, r: CORD_CAP.r * K, stud: { r: CORD_CAP.stud.r * K, h: CORD_CAP.stud.h * K } };
  const curve = (from, to, opts) => cordCurve(from, to, { ...opts, cap });
  // an upright cylinder of plan radius r from z0 to z1 at (x, y): its wall, then its top
  const drum = (ox, oy, x, y, r, z0, z1, wall, top) => {
    const [cx, cy] = pt(ox, oy, x, y, z1), [, by] = pt(ox, oy, x, y, z0);
    const rx = +(r * Math.SQRT2 * 0.866).toFixed(2), ry = +(r * Math.SQRT2 * 0.5).toFixed(2);
    return `<path d="M${cx - rx},${cy} L${cx - rx},${by} A${rx},${ry} 0 0 0 ${cx + rx},${by} L${cx + rx},${cy} Z" class="sk" style="fill:${wall}"/>
<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" class="sk" style="fill:${top}"/>`;
  };
  // a cap: a 1×1 round plate seated on its ringed stud, the ring kept round its foot, and its own stud on top, in ink on the kit's paper
  function capSvg(ox, oy, [x, y, z]) {
    const [fx, fy] = pt(ox, oy, x, y, z), g = 4 * K;
    const rx = +((cap.r + g) * Math.SQRT2 * 0.866).toFixed(2), ry = +((cap.r + g) * Math.SQRT2 * 0.5).toFixed(2);
    return [
      `<ellipse cx="${fx}" cy="${fy}" rx="${rx}" ry="${ry}" class="ska fnone"/>`,
      drum(ox, oy, x, y, cap.r, z, z + cap.h, 'var(--paper-2)', 'var(--paper)'),
      drum(ox, oy, x, y, cap.stud.r, z + cap.h, z + cap.h + cap.stud.h, 'var(--paper-2)', 'var(--paper-2)'),
    ].join('\n');
  }
  // the cord stranded: two close strokes along the curve, crossed at a fixed pitch
  function strandSvg(ox, oy, c, { gap = 1, pitch = 3.2 } = {}) {
    const pts = c.pts.map((P) => pt(ox, oy, ...P));
    const side = (sgn) => pts.map((p, k) => {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [+(p[0] - (sgn * gap * (b[1] - a[1])) / l).toFixed(1), +(p[1] + (sgn * gap * (b[0] - a[0])) / l).toFixed(1)];
    });
    const L = side(1), R = side(-1), ticks = [];
    for (let k = 1, run = 0; k < pts.length; k++) {
      run += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      if (run >= pitch) { run = 0; ticks.push(`M${L[k - 1]} L${R[k]}`); }
    }
    const line = (ps) => `M${ps.map((p) => p.join(',')).join(' L')}`;
    return `<path d="${line(L)} ${line(R)} ${ticks.join(' ')}" class="sk fnone" style="stroke-width:0.7"/>`;
  }
  /** A string with end studs from stud top `from` to stud top `to`, or along a curve already routed: both caps, then the cord over them. */
  function cord(ox, oy, from, to, opts = {}) {
    const c = opts.curve ?? curve(from, to, opts);
    return [capSvg(ox, oy, c.from), capSvg(ox, oy, c.to), strandSvg(ox, oy, c, opts)].join('\n');
  }
  return { cap, top: capTop(cap), curve, cord, capSvg, strandSvg };
}
