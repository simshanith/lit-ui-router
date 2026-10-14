import { iso } from './helpers.mjs';

// A string with end studs: a round 1×1 cap a plate tall on a stud at each end and a cord between their tops, fit and never massed.
export const CORD_CAP = { h: 8, r: 15 };
const SAG = 0.15, SAMPLES = 32;

/** A cord between two stud tops [x, y, z]: a quadratic cap top to cap top, its control over the plan midpoint and below the higher cap by SAG of the length that runs level. */
export function cordCurve(from, to, { sag = SAG, cap = CORD_CAP } = {}) {
  const A = [from[0], from[1], from[2] + cap.h], B = [to[0], to[1], to[2] + cap.h];
  const len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) || 1, fall = Math.abs(A[2] - B[2]);
  const C = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, Math.max(A[2], B[2]) - sag * len * (1 - fall / len)];
  const at = (t) => [0, 1, 2].map((k) => (1 - t) ** 2 * A[k] + 2 * t * (1 - t) * C[k] + t ** 2 * B[k]);
  return { from, to, A, B, C, len, at, pts: Array.from({ length: SAMPLES + 1 }, (_, k) => at(k / SAMPLES)) };
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

/** The first mass {id, poly, box, end} a cord meets, or null: it misses every outline outright, but one marked `end` it may cross above or in front of. */
export function cordHit(curve, masses, project = (P) => iso(...P)) {
  for (const P of curve.pts) {
    const c = project(P);
    for (const m of masses) {
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
  const K = U / 40, cap = { h: CORD_CAP.h * K, r: CORD_CAP.r * K };
  const curve = (from, to, opts) => cordCurve(from, to, { ...opts, cap });
  // a round cap seated on its stud: a wall and a top, in ink on paper
  function capSvg(ox, oy, [x, y, z]) {
    const [cx, cy] = pt(ox, oy, x, y, z + cap.h), [, by] = pt(ox, oy, x, y, z);
    const rx = +(cap.r * Math.SQRT2 * 0.866).toFixed(2), ry = +(cap.r * Math.SQRT2 * 0.5).toFixed(2);
    return `<path d="M${cx - rx},${cy} L${cx - rx},${by} A${rx},${ry} 0 0 0 ${cx + rx},${by} L${cx + rx},${cy} Z" class="sk" style="fill:var(--paper-2)"/>
<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" class="sk fp"/>`;
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
  return { cap, curve, cord, capSvg, strandSvg };
}
