// SVG builders shared across sheets.

// a package's registry page, the home the repo's README and docs site link
export const npmUrl = (name) => `https://npmx.dev/package/${name}`;

export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A link inside a plate: wraps lettering or a mark; outward, in a new tab, as the chrome's outward links are.
export const link = (href, inner) => `<a href="${href}" target="_blank" rel="noopener">${inner}</a>`;

export function txt(x, y, s, cls = 'lbl', anchor = 'start', extra = '') {
  return `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}" ${extra}>${esc(s)}</text>`;
}

// ---- schedule rows ----
// The data face has no fixed advance, so a row number can no longer be padded
// into the line: it gets its own end-anchored gutter, and the body starts at a
// fixed x. SCHED_NUM = two DIN digits at 9.5px; SCHED_BODY keeps the body's left
// edge exactly where the padded mono row put it.
export const SCHED_NUM = 14;
export const SCHED_BODY = 25;
export function schedTxt(x, y, [n, body], cls = 'lbls') {
  return txt(x + SCHED_NUM, y, String(n), cls, 'end')
    + '\n' + txt(x + SCHED_BODY, y, body, cls);
}

// ---- schedules ----
// A plate's register is a table under the drawing (chrome.mjs `scheduleTable`),
// never SVG text: head = column names, each row's first cell its number, a
// numeric cell passed as a number so the table sets it as a figure.
export function schedule(title, head, rows, total = '') {
  return { title, head, rows, total };
}

// A callout leader: dashed and faint from the lettering's edge, a landing dot
// on the thing it names — never a solid hairline, which reads as a road.
export function leader(x1, y1, x2, y2) {
  const f = (v) => Number(v).toFixed(1);
  return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" class="skf" stroke-dasharray="4 3"/><circle cx="${f(x2)}" cy="${f(y2)}" r="2" class="fis"/>`;
}

export function lines(x, y, arr, cls = 'lbl', anchor = 'start', lh = 13) {
  return arr.map((s, i) => txt(x, y + i * lh, s, cls, anchor)).join('\n');
}

export function box(x, y, w, h, cls = 'sk fp', rx = 0) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}"/>`;
}

// Labeled arrow along a path. mk: marker suffix (ai|aa|ar|as); p: sheet prefix.
export function arrow(p, d, mk = 'ai', cls = 'sk', dash = '') {
  return `<path d="${d}" class="${cls}" ${dash ? `stroke-dasharray="${dash}"` : ''} marker-end="url(#${p}-${mk})"/>`;
}

// ---- isometric projection ----
const C = 0.866, S = 0.5;
export const iso = (x, y, z = 0) => [(x - y) * C, (x + y) * S - z];

// A filled, stroked face. Every stroke class declares fill:none and CSS beats a
// presentation attribute, so the fill is its own element under the outline; a
// pattern fill gets the sheet's stone laid under it first (a hatch has no ground).
export function face(points, edge, fill) {
  return (fill.startsWith('url(') ? `<polygon points="${points}" fill="var(--paper-2)"/>\n` : '')
    + `<polygon points="${points}" fill="${fill}"/>\n<polygon points="${points}" class="${edge} fnone"/>`;
}

// Isometric block at plan (x,y), footprint w×d, height h; ox/oy = screen origin offset.
// faces: top (paper), left (paper-2), right (hatch pattern). capCls fills the top instead.
// z0 raises the block off the ground (a mast drops from the near corner to the ground).
// sideFill overrides the right-face hatch (e.g. a red hatch for spec annexes).
export function isoBlock(p, ox, oy, x, y, w, d, h, { capCls = 'fp', edge = 'sk', z0 = 0, sideFill } = {}) {
  const pt = (px, py, pz) => {
    const [sx, sy] = iso(px, py, pz);
    return `${(ox + sx).toFixed(1)},${(oy + sy).toFixed(1)}`;
  };
  const t = z0 + h;
  const top = [pt(x, y, t), pt(x + w, y, t), pt(x + w, y + d, t), pt(x, y + d, t)].join(' ');
  const left = [pt(x, y + d, t), pt(x + w, y + d, t), pt(x + w, y + d, z0), pt(x, y + d, z0)].join(' ');
  const right = [pt(x + w, y, t), pt(x + w, y + d, t), pt(x + w, y + d, z0), pt(x + w, y, z0)].join(' ');
  const mast = z0 > 0
    ? `<line x1="${pt(x + w, y + d, z0).split(',')[0]}" y1="${pt(x + w, y + d, z0).split(',')[1]}" x2="${pt(x + w, y + d, 0).split(',')[0]}" y2="${pt(x + w, y + d, 0).split(',')[1]}" class="sks" stroke-dasharray="2 3"/>`
    : '';
  return `<g>${mast}
${face(left, edge, 'var(--paper-2)')}
${face(right, edge, sideFill ?? `url(#${p}-hx)`)}
<polygon points="${top}" class="${edge} ${capCls}"/>
</g>`;
}

// Screen coords of an iso plan point (for labels/edges).
export function isoPt(ox, oy, x, y, z = 0) {
  const [sx, sy] = iso(x, y, z);
  return [ox + sx, oy + sy];
}

// ---- the dimension kit ----
// The idiom's homes: the skill the kit follows, and the drawings the skill follows.
export const DIMENSIONAL = {
  skill: 'https://github.com/enesozturk/dimensional-drawing',
  apple: 'https://developer.apple.com/accessories/dimensional-drawings',
};
// Dimensional-drawing marks, in the chrome's own classes: a dimension line is
// `sks` with the soft arrowheads (`${p}-as`, both ends), an extension line is a
// `skf` hairline standing 3 off the feature and 5 past the dimension line, and
// the code is `lbld` lettering with a paper knockout. A span under 28 takes its
// arrowheads outside. Every code on a drawing is a row in a schedule.
const f1 = (v) => Number(v).toFixed(1);
const dimArrows = (p, a, b, span, axis) => {
  const [k1, k2] = axis === 'x' ? ['x', 'y'] : ['y', 'x'];
  const line = (u1, u2, v, mk) => `<line ${k1}1="${f1(u1)}" ${k2}1="${f1(v)}" ${k1}2="${f1(u2)}" ${k2}2="${f1(v)}" class="sks"${mk ? ` marker-end="url(#${p}-as)"` : ''}/>`;
  if (span >= 28) return `<line ${k1}1="${f1(a.u)}" ${k2}1="${f1(a.v)}" ${k1}2="${f1(b.u)}" ${k2}2="${f1(b.v)}" class="sks" marker-start="url(#${p}-as)" marker-end="url(#${p}-as)"/>`;
  return line(a.u - 13, a.u, a.v, true) + line(b.u + 13, b.u, b.v, true) + line(a.u, b.u, a.v, false);
};

/** A horizontal dimension from x1 to x2 along y; e1/e2 are the feature edges the extension lines leave from (null for none). */
export function dimH(p, x1, x2, y, e1, e2, label, { below = false, dx = 0, dy = 0, cls = 'lbld' } = {}) {
  const ext = [[x1, e1], [x2, e2]].filter(([, e]) => e != null).map(([x, e]) => {
    const s = Math.sign(y - e) || 1;
    return `<line x1="${f1(x)}" y1="${f1(e + s * 3)}" x2="${f1(x)}" y2="${f1(y + s * 5)}" class="skf"/>`;
  }).join('');
  return ext + dimArrows(p, { u: x1, v: y }, { u: x2, v: y }, x2 - x1, 'x')
    + txt(f1((x1 + x2) / 2 + dx), f1((below ? y + 13 : y - 4) + dy), label, cls, 'middle');
}

/** A vertical dimension from y1 to y2 along x; side 'l' or 'r' sets the code beside the line, none rotates it onto the line. */
export function dimV(p, y1, y2, x, e1, e2, label, { side = null, dx = 0, dy = 0, cls = 'lbld' } = {}) {
  const ext = [[y1, e1], [y2, e2]].filter(([, e]) => e != null).map(([y, e]) => {
    const s = Math.sign(x - e) || 1;
    return `<line x1="${f1(e + s * 3)}" y1="${f1(y)}" x2="${f1(x + s * 5)}" y2="${f1(y)}" class="skf"/>`;
  }).join('');
  const c = (y1 + y2) / 2;
  const code = side
    ? txt(f1(x + (side === 'r' ? 6 : -6) + dx), f1(c + 4 + dy), label, cls, side === 'r' ? 'start' : 'end')
    : txt(f1(x - 5 + dx), f1(c + dy), label, cls, 'middle', `transform="rotate(-90 ${f1(x - 5 + dx)} ${f1(c + dy)})"`);
  return ext + dimArrows(p, { u: y1, v: x }, { u: y2, v: x }, y2 - y1, 'y') + code;
}

/** A radius callout at a corner ('tl'|'tr'|'bl'|'br' of the box whose corner is at cx,cy), the leader len long. */
export function rad(cx, cy, r, corner, label, len = 22, cls = 'lbld') {
  const sx = corner.includes('l') ? -1 : 1, sy = corner.includes('t') ? -1 : 1;
  const px = cx - sx * r + sx * r * Math.SQRT1_2, py = cy - sy * r + sy * r * Math.SQRT1_2;
  const ex = px + sx * len, ey = py + sy * len;
  return leader(ex, ey, px, py) + txt(f1(ex + sx * 4), f1(ey + 4), label, cls, sx > 0 ? 'start' : 'end');
}

/** A boxed note number: the same number stands beside its note in the general notes. */
export function nb(x, y, n) {
  return `<rect x="${f1(x - 6)}" y="${f1(y - 6)}" width="12" height="12" class="sk fp"/>` + txt(f1(x), f1(y + 3.5), String(n), 'lbls', 'middle');
}

/** A detail circle: a phantom (dashed) ring with a leader to its label, which names the panel drawn larger elsewhere. */
export function detailRef(cx, cy, r, label, lx, ly, cls = 'lbls') {
  const a = Math.atan2(ly - cy, lx - cx);
  return `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" class="skf fnone" stroke-dasharray="6 3"/>`
    + `<line x1="${f1(cx + r * Math.cos(a))}" y1="${f1(cy + r * Math.sin(a))}" x2="${f1(lx)}" y2="${f1(ly)}" class="skf" stroke-dasharray="4 3"/>`
    + txt(f1(lx + (lx < cx ? -4 : 4)), f1(ly + 4), label, cls, lx < cx ? 'end' : 'start');
}

// Key row helper: small inline swatch svg + description.
export function keyRow(swatchSvg, desc) {
  return `<tr><td><svg viewBox="0 0 48 18" width="48" height="18" aria-hidden="true">${swatchSvg}</svg></td><td>${desc}</td></tr>`;
}
