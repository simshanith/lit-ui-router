// Hidden-line support for the isometric plates.
//
// Two faults made every mass on these plates see-through, so rear edges read
// straight through the front of a building:
//
//   1. isoBlock paints its side faces with a `fill` PRESENTATION ATTRIBUTE while
//      carrying a stroke class — and every stroke class in chrome.mjs declares
//      `fill: none`.  A CSS declaration outranks a presentation attribute, so the
//      faces were never filled at all.  `solidFaces` restates each face fill as an
//      inline style, which does outrank the class.
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
