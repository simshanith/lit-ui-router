// SVG builders shared across sheets.

export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function txt(x, y, s, cls = 'lbl', anchor = 'start', extra = '') {
  return `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}" ${extra}>${esc(s)}</text>`;
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
<polygon points="${left}" class="${edge}" fill="var(--paper-2)"/>
<polygon points="${right}" class="${edge}" fill="${sideFill ?? `url(#${p}-hx)`}"/>
<polygon points="${top}" class="${edge} ${capCls}"/>
</g>`;
}

// Screen coords of an iso plan point (for labels/edges).
export function isoPt(ox, oy, x, y, z = 0) {
  const [sx, sy] = iso(x, y, z);
  return [ox + sx, oy + sy];
}

// Key row helper: small inline swatch svg + description.
export function keyRow(swatchSvg, desc) {
  return `<tr><td><svg viewBox="0 0 48 18" width="48" height="18" aria-hidden="true">${swatchSvg}</svg></td><td>${desc}</td></tr>`;
}
