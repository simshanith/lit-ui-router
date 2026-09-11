// Hidden-line support for the isometric plates.
//
// Two faults made every mass on these plates see-through, so rear edges read
// straight through the front of a building:
//
//   1. isoBlock USED TO paint its side faces with a `fill` PRESENTATION ATTRIBUTE
//      while carrying a stroke class — and every stroke class in chrome.mjs
//      declares `fill: none`.  A CSS declaration outranks a presentation
//      attribute, so the faces were never filled at all.  Since 2026-09-06
//      helpers.mjs's face() writes the fill as its own element; `solidFaces`
//      stays for any face a sheet still writes the old way (a no-op otherwise).
//   2. The hatch patterns are bare line tiles with no ground, so even a face that
//      IS filled with one lets the drawing behind it through between the marks.
//      `solidFaces` lays the sheet's own --paper-2 stone under a patterned face.
//
// `depthSort` is the other half: opaque faces only occlude if the masses are
// painted back to front.  For axis-aligned blocks under this projection a plan-axis
// separating plane settles the order outright — the box on the far side of x (or of
// y) is always the box further from the eye — so the order is a topological sort of
// that relation, not a distance guess.

const FACE = /<polygon points="([^"]+)" class="([^"]*)" fill="([^"]+)"\/>/g;

// Give isoBlock's side faces a fill the class cannot cancel; back patterns with stone.
export const solidFaces = (svg) => svg.replace(FACE, (_m, pts, cls, fill) =>
  (fill.startsWith('url(') ? `<polygon points="${pts}" stroke="none" style="fill:var(--paper-2)"/>` : '')
  + `<polygon points="${pts}" class="${cls}" style="fill:${fill}"/>`);

// Back to front. Masses are plan rects {x, y, w, d, ...}; extra fields ride along.
export function depthSort(masses) {
  const n = masses.length;
  const key = (m) => m.x + m.w + m.y + m.d;
  const behind = (a, b) => a.x + a.w <= b.x + 1e-9 || a.y + a.d <= b.y + 1e-9;
  const adj = masses.map(() => []);
  const indeg = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (behind(masses[i], masses[j]) && !behind(masses[j], masses[i])) { adj[i].push(j); indeg[j]++; }
    }
  }
  const out = [];
  const ready = [...masses.keys()].filter((i) => indeg[i] === 0);
  while (ready.length) {
    ready.sort((a, b) => key(masses[a]) - key(masses[b]));
    const i = ready.shift();
    out.push(i);
    for (const j of adj[i]) if (--indeg[j] === 0) ready.push(j);
  }
  // a cyclic overlap cannot be ordered; fall back to near-corner depth for the rest
  const left = [...masses.keys()].filter((i) => !out.includes(i)).sort((a, b) => key(masses[a]) - key(masses[b]));
  return [...out, ...left].map((i) => masses[i]);
}

// ---- the plot assertion ---------------------------------------------------------
//
// The city sheets hand-place every member, but the FOOTPRINT drawn at that point is
// data-driven (side ∝ √sloc, spec annex ∝ √specSloc set AG beyond it), so a census
// refresh can walk a fixed coordinate into its neighbour — T53.  Same posture as the
// missing-member throws: the drawing may not ship overlapped.
//
// The test is on the GROUND rects.  Both projections these sheets use — the isometric
// of helpers.mjs and 7A's straight-down plan — are affine and invertible, so two
// ground rects intersect in the drawing exactly when they intersect in plan; what a
// taller mass hides above the ground is occlusion, drawn on purpose.  depthSort wants
// the same disjointness: overlapping footprints have no separating plane to sort on.
const f1 = (v) => v.toFixed(1);
export function assertPlots(sheet, plots) {
  for (let i = 0; i < plots.length; i++) {
    for (let j = i + 1; j < plots.length; j++) {
      const a = plots[i], b = plots[j];
      if (a.n === b.n) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y);
      if (ox <= 0 || oy <= 0) continue;
      throw new Error(`${sheet}: plots overlap — ${a.n} ${a.name} ${a.part} `
        + `[${f1(a.x)} ${f1(a.y)} → ${f1(a.x + a.w)} ${f1(a.y + a.d)}] intersects `
        + `${b.n} ${b.name} ${b.part} [${f1(b.x)} ${f1(b.y)} → ${f1(b.x + b.w)} ${f1(b.y + b.d)}] `
        + `by ${f1(ox)} × ${f1(oy)} units; recompose this sheet's PLACED table (DESIGN-REVIEW §T53)`);
    }
  }
}

// One member's drawn ground rects: the src block, and the spec annex where it has one.
export const plotsOf = ({ n, name, x, y, s, sa, ax, ay }) => [
  { n, name, part: 'block', x, y, w: s, d: s },
  ...(sa ? [{ n, name, part: 'annex', x: ax, y: ay, w: sa, d: sa }] : []),
];
