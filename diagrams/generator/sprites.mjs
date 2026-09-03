// Building sprites for the I7 cytoscape nodes — one per station type, filed as
// data: URIs for cytoscape `background-image`.  Direction is pinned in
// INITIATIVES.md: HZD x SC2K x Factorio building sprites as the general
// representation of a thing that does work.
//
// HARD CONSTRAINT (INITIATIVES.md sprite note): walls are TRANSLUCENT
// semi-opaque, never solid — every sprite draws its girding frame FIRST and
// then washes a semi-opaque wall over it, so the frame reads through and the
// themed node body behind the sprite tints the building.  Two palettes are
// emitted (graphite-on-vellum / cyanotype) and the page swaps them with the
// theme; strokes are the sheet's own ink, so a sprite never floats unlegible.

const PALETTES = {
  light: {
    ink: '#2B302C', soft: '#5C6259', faint: '#9AA091', accent: '#2E5077', red: '#A63D2F',
    wall: 'rgba(43,48,44,0.13)', roof: 'rgba(46,80,119,0.20)', glass: 'rgba(46,80,119,0.28)',
  },
  dark: {
    ink: '#D9E6F3', soft: '#93A9C6', faint: '#5F7899', accent: '#8FBCE9', red: '#E38C6F',
    wall: 'rgba(217,230,243,0.14)', roof: 'rgba(143,188,233,0.22)', glass: 'rgba(143,188,233,0.30)',
  },
};

const n = (v) => Number(v.toFixed(1));

function kit(p) {
  const line = (x1, y1, x2, y2, stroke, w = 1, dash = '') =>
    `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const rect = (x, y, w, h, fill, stroke = 'none', sw = 1.4, dash = '') =>
    `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const poly = (pts, fill, stroke = 'none', sw = 1.4) =>
    `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;

  // the girding frame: posts and floor plates, drawn UNDER the wall wash
  const girder = (x, y, w, h, cols, rows) => {
    let s = '';
    for (let i = 1; i < cols; i += 1) s += line(x + (w * i) / cols, y, x + (w * i) / cols, y + h, p.soft, 1);
    for (let j = 1; j < rows; j += 1) s += line(x, y + (h * j) / rows, x + w, y + (h * j) / rows, p.soft, 1);
    return s;
  };
  // frame, then semi-opaque wall, then the outline: the house wall recipe
  const shell = (x, y, w, h, cols = 3, rows = 2, fill = p.wall) =>
    girder(x, y, w, h, cols, rows) + rect(x, y, w, h, fill) + rect(x, y, w, h, 'none', p.ink, 1.4);
  const ground = line(5, 43.5, 43, 43.5, p.faint, 1.2);
  const pips = (count, x, y) => {
    let s = '';
    for (let i = 0; i < count; i += 1) s += rect(x + i * 5, y, 3.2, 3.2, p.accent);
    return s;
  };
  return { line, rect, poly, girder, shell, ground, pips };
}

// Each sprite is a 48x48 elevation: base plinth, girded walls, a roof, and one
// tell that says what the building does.
function bodies(p) {
  const { line, rect, poly, shell, ground, pips } = kit(p);

  // a probe station: hut + roof + tripod mast; the tier sets its height and tell
  const station = (floors, tell) => {
    const h = 8 + floors * 7;
    const y = 41 - h;
    return ground
      + line(24, y - 11, 24, y, p.soft, 1.1)                              // mast
      + poly(`24,${n(y - 13)} 27,${n(y - 8)} 21,${n(y - 8)}`, p.glass, p.ink, 1.2)
      + shell(11, y, 26, h, 3, floors)
      + poly(`9,${n(y)} 24,${n(y - 6)} 39,${n(y)}`, p.roof, p.ink, 1.4)   // roof
      + rect(21, 33, 6, 8, p.glass, p.ink, 1.2)                           // door
      + tell(y, h)
      + pips(floors, 12, 42.5);
  };

  return {
    // the archive basis: a strongroom, one door, strata banding
    basis: ground
      + shell(7, 18, 34, 25, 4, 3)
      + poly('5,18 24,7 43,18', p.roof, p.ink, 1.5)
      + line(5, 18, 43, 18, p.ink, 1.5)
      + rect(19, 29, 10, 14, p.glass, p.ink, 1.3)
      + rect(22.4, 34.5, 3.2, 3.2, p.accent)
      + rect(21, 11.5, 6, 4, p.wall, p.ink, 1.2),

    // T1 pure tree: one floor, a level staff read off the archive
    'probe-T1': station(1, (y) => line(38, y + 2, 38, 41, p.accent, 1.6)),
    // T2 history: two floors, a clock face on the gable
    'probe-T2': station(2, (y) => `<circle cx="24" cy="${n(y + 5)}" r="3.4" fill="${p.glass}" stroke="${p.ink}" stroke-width="1.2"/>`
      + line(24, y + 5, 24, y + 2.6, p.ink, 1.1) + line(24, y + 5, 26, y + 5, p.ink, 1.1)),
    // T3 execution: three floors, a working stack — the tree measures itself
    'probe-T3': station(3, (y) => rect(31, y - 9, 5, 10, p.wall, p.ink, 1.3)
      + `<circle cx="33.5" cy="${n(y - 13)}" r="2.6" fill="${p.glass}"/><circle cx="30" cy="${n(y - 17)}" r="1.8" fill="${p.glass}"/>`),

    // a query station files nothing: an open-sided shed with a lens
    'probe-query': ground
      + shell(11, 24, 26, 17, 3, 2)
      + poly('9,24 24,17 39,24', p.roof, p.ink, 1.4)
      + rect(14, 30, 20, 11, 'none', p.soft, 1.2, '3 3')
      + `<circle cx="24" cy="30.5" r="4.6" fill="${p.glass}" stroke="${p.ink}" stroke-width="1.3"/>`
      + line(24, 30.5, 34, 30.5, p.accent, 1.4),

    // the old regime's last instrument: frame only, no wall, struck through
    'probe-unwired': ground
      + rect(11, 24, 26, 17, 'none', p.faint, 1.3, '3 3')
      + line(11, 32.5, 37, 32.5, p.faint, 1, '3 3')
      + line(24, 24, 24, 41, p.faint, 1, '3 3')
      + line(13, 43, 35, 22, p.red, 1.6),

    // a filed plate: a drawer cabinet with one drawer pulled
    plate: ground
      + shell(11, 13, 26, 28, 2, 4)
      + rect(11, 13, 26, 3, p.roof)
      + line(15, 20, 33, 20, p.soft, 1.3)
      + line(15, 34, 33, 34, p.soft, 1.3)
      + rect(8, 24, 30, 7, p.glass, p.ink, 1.3)
      + line(18, 27.5, 28, 27.5, p.ink, 1.3),

    // the master plate: taller cabinet, accent front, the fan-out drawn on it
    'plate-master': ground
      + shell(9, 9, 30, 32, 2, 5)
      + rect(9, 9, 30, 3.5, p.roof)
      + rect(9, 9, 30, 32, 'none', p.accent, 1.8)
      + rect(6, 20, 36, 8, p.glass, p.accent, 1.6)
      + line(16, 24, 32, 24, p.accent, 1.4)
      + line(39, 24, 45, 15, p.accent, 1.2) + line(39, 24, 46, 24, p.accent, 1.2) + line(39, 24, 45, 33, p.accent, 1.2)
      + line(14, 34.5, 34, 34.5, p.soft, 1.2)
      + line(14, 15, 34, 15, p.soft, 1.2),

    // a finished drawing: a board on legs with a title block in the corner
    sheet: ground
      + line(14, 40, 18, 43, p.ink, 1.4) + line(34, 40, 30, 43, p.ink, 1.4)
      + poly('9,12 39,8 41,36 11,40', p.wall, p.ink, 1.4)
      + line(12, 17.6, 38.2, 14.2, p.soft, 1)
      + line(12.6, 23.6, 38.7, 20.2, p.soft, 1)
      + line(13.2, 29.6, 39.2, 26.2, p.soft, 1)
      + poly('27,29.6 39.2,28 39.7,35.2 27.6,36.6', p.glass, p.accent, 1.3),

    // a shared instrument in the yard: a theodolite on its tripod
    'tool-instrument': ground
      + line(24, 26, 15, 43, p.ink, 1.3) + line(24, 26, 33, 43, p.ink, 1.3) + line(24, 26, 24, 43, p.soft, 1.1)
      + rect(17, 17, 14, 10, p.wall, p.ink, 1.4)
      + line(17, 22, 31, 22, p.soft, 1)
      + rect(29, 19, 8, 4, p.glass, p.ink, 1.2)
      + `<circle cx="24" cy="14" r="2.6" fill="${p.glass}" stroke="${p.accent}" stroke-width="1.3"/>`,

    // an external instrument: a crate off the yard, with an aerial
    'tool-external': ground
      + line(24, 12, 24, 20, p.soft, 1.1)
      + line(24, 12, 20, 8, p.accent, 1.2) + line(24, 12, 28, 8, p.accent, 1.2)
      + shell(12, 20, 24, 21, 3, 2)
      + line(12, 20, 36, 41, p.soft, 1) + line(36, 20, 12, 41, p.soft, 1)
      + rect(12, 20, 24, 4, p.roof),
  };
}

const uri = (body) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">${body}</svg>`)}`;

// { light: { kind: data-uri }, dark: { … } } — the page picks by theme.
export const SPRITES = Object.fromEntries(
  Object.entries(PALETTES).map(([theme, p]) => [theme, Object.fromEntries(Object.entries(bodies(p)).map(([k, b]) => [k, uri(b)]))]),
);

export const SPRITE_KINDS = Object.keys(bodies(PALETTES.light));

// Raw SVG (not a data: URI) for the legend swatches, which live in the DOM and
// can take the page's own tokens instead of a baked palette.
export const spriteSvg = (kind, theme = 'light') =>
  `<svg viewBox="0 0 48 48" width="26" height="26" aria-hidden="true">${bodies(PALETTES[theme])[kind]}</svg>`;
