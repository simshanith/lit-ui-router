// THE ICON TABLE — every glyph the set draws, once, in one sprite idiom.
//
// Two families share it. The KEY ICONS: FORM's keys are a closed vocabulary
// (labels.mjs), so the set is closed too — twelve subjects, six projections
// and the one mode that is drawn. A card's key row references them, and so
// does every chip in the cover's key index. The LANE GLYPHS: the controls,
// hints and panel heads of the four cytoscape lanes (loop-walk, coupling-bench,
// register-graph, pipeline-graph). Their nodes are house sprites, not these.
//
// Three sources, one idiom. The projections are the house's own 16-grid
// glyphs. Every other drawing is a Lucide line icon (ISC), restroked: its
// 24-grid paths ride a `scale(2/3)` group inside the house's 16 viewBox, at a
// stroke of 1.95 that lands at 1.3 after the scale. `register` and `spine` are
// drawn here, natively on the 16 grid, because no stock set has a punched card
// or a family spine. The lane glyphs are lucide-static 1.48.0.
//
// The sprite is INLINE MARKUP, not a fetch. The app writes `ICON_SPRITE` into
// its shell through the generated module (emit-app.mjs → app/src/generated/
// icons.js); a flat page gets `spriteFor(body)` — the symbols it references
// and no others — from chrome.mjs's `page()`. No icon package, no runtime
// request.

/** A Lucide body, scaled off its 24 grid onto the house's 16. */
const lucide = (body) => `<g transform="scale(.666667)" stroke-width="1.95">${body}</g>`;

// The house's own 16-grid drawings: a `d`, and dots as round-capped stubs at
// whatever weight reads — the graph's three nodes are heavy, the register's
// nine holes are hairline or they close into one black square at 12px.
const house = (d, dots = '', dotWidth = 3.2) =>
  `<path stroke-width="1.3" d="${d}"/>` +
  (dots ? `<path stroke-width="${String(dotWidth)}" stroke-linecap="round" d="${dots}"/>` : '');

// `key:value` → the symbol's body. Subjects and the mode lamp are Lucide
// (`building`, `chart-scatter` — the names `building-2` and `scatter-chart`
// were renamed upstream); `register` and `spine` are drawn here.
const KEYS = {
  'subject:city': lucide(
    '<path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M12 6h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/><path d="M8 6h.01"/><path d="M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/><rect x="4" y="2" width="16" height="20" rx="2"/>',
  ),
  'subject:circuit': lucide(
    '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  ),
  'subject:coupling': lucide(
    '<path d="M17 19a1 1 0 0 1-1-1v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1z"/><path d="M17 21v-2"/><path d="M19 14V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V10"/><path d="M21 21v-2"/><path d="M3 5V3"/><path d="M4 10a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2z"/><path d="M7 5V3"/>',
  ),
  'subject:map': lucide(
    '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  ),
  'subject:pipeline': lucide(
    '<rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/>',
  ),
  'subject:quarters': lucide(
    '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  ),
  // A punched card: the cut corner, and the holes the register is read off.
  // TWO rows of three, not three: at 14px a third row closes the grid up.
  'subject:register': house(
    'M2.6 2.6h7.9l2.9 2.6v8.2H2.6Z M10.5 2.6v2.6h2.9',
    'M4.9 8.4h0 M7.7 8.4h0 M10.5 8.4h0 M4.9 11.4h0 M7.7 11.4h0 M10.5 11.4h0',
    1.6,
  ),
  'subject:sample': lucide(
    '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/>',
  ),
  'subject:space': lucide(
    '<circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="18.5" cy="5.5" r=".5" fill="currentColor"/><circle cx="11.5" cy="11.5" r=".5" fill="currentColor"/><circle cx="7.5" cy="16.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="14.5" r=".5" fill="currentColor"/><path d="M3 3v16a2 2 0 0 0 2 2h16"/>',
  ),
  // The family spine: one bar, three ribs each side.
  'subject:spine': house('M8 2.2v11.6 M8 4.9H5.1 M8 8H5.1 M8 11.1H5.1 M8 4.9h2.9 M8 8h2.9 M8 11.1h2.9'),
  'subject:sprite': lucide(
    '<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>',
  ),
  'subject:survey': lucide(
    '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/>',
  ),
  // PROJECTION keeps the house glyphs it has always been drawn with.
  'projection:isometric': house('M8 1.8 14 5.3 8 8.8 2 5.3Z M2 5.3v5.4l6 3.5 6-3.5V5.3 M8 8.8v5.4'),
  'projection:plan': house('M2.5 2.5h11v11h-11z M6.2 2.5v11 M9.8 2.5v11 M2.5 6.2h11 M2.5 9.8h11'),
  'projection:graph': house('M8 3.8 3.6 12.2 M8 3.8 12.4 11.6', 'M8 3.8h0 M3.6 12.2h0 M12.4 11.6h0'),
  'projection:chart': house('M2.2 13.5h11.6 M3.8 13.5V8.8h2v4.7 M7 13.5V4.4h2v9.1 M10.2 13.5V6.9h2v6.6'),
  'projection:schematic': house('M5 5h6v6H5z M1.5 8H5 M11 8h3.5'),
  'projection:section': house(
    'M2.5 2.5h11v11h-11z M2.5 8h11 M2.6 11 5.1 8.5 M4.6 13.4 9.5 8.5 M8.4 13.4 13.3 8.5 M12.3 13.4 13.4 12.3',
  ),
  // MODE is a boolean: only the plate that answers a pointer carries a mark.
  'mode:interactive': lucide(
    '<path d="M14 4.1 12 6"/><path d="m5.1 8-2.9-.8"/><path d="m6 12-1.9 2"/><path d="M7.2 2.2 8 5.1"/><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"/>',
  ),
};

// The lane glyphs, keyed by Lucide name; none of these was renamed upstream.
const GLYPHS = {
  // 1i's walk: PREV, NEXT, RESET
  'chevron-left': lucide('<path d="m15 18-6-6 6-6"/>'),
  'chevron-right': lucide('<path d="m9 18 6-6-6-6"/>'),
  'rotate-ccw': lucide('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
  // FIT: the frame's four corners
  scan: lucide(
    '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
  ),
  // DRAG TO PAN · SCROLL TO ZOOM
  move: lucide(
    '<path d="M12 2v20"/><path d="m15 19-3 3-3-3"/><path d="m19 9 3 3-3 3"/><path d="M2 12h20"/><path d="m5 9-3 3 3 3"/><path d="m9 5 3-3 3 3"/>',
  ),
  mouse: lucide('<rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 6v4"/>'),
  // the toggles: PHANTOM SHROUD, TOOLS LEDGER
  ghost: lucide(
    '<path d="M15 10v1"/><path d="M7.528 20.472a1.6 1.6 0 012.277 0l1.057 1.056a1.6 1.6 0 002.276 0l1.057-1.056a1.6 1.6 0 012.277 0l1.114 1.114a1.4 1.4 0 002.414-1V10a8 8 0 00-16 0v10.586a1.4 1.4 0 002.414 1z"/><path d="M9 10v1"/>',
  ),
  wrench: lucide(
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
  ),
  // panel heads: THE WALK; ties in, ties out, both counts; what a task waits on
  footprints: lucide(
    '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/>',
  ),
  'arrow-down-to-line': lucide('<path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/>'),
  'arrow-up-from-line': lucide('<path d="m18 9-6-6-6 6"/><path d="M12 3v14"/><path d="M5 21h14"/>'),
  'arrow-down-up': lucide('<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/>'),
  hourglass: lucide(
    '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  ),
};

// `isometric graph` → `ic-isometric-graph`; key values are unique across keys.
const keyId = (key) => `ic-${key.slice(key.indexOf(':') + 1).replace(/\s+/g, '-')}`;

/** Symbol id → body, over both families. */
const SYMBOLS = new Map([
  ...Object.entries(KEYS).map(([key, body]) => [keyId(key), body]),
  ...Object.entries(GLYPHS).map(([name, body]) => [`gl-${name}`, body]),
]);

/** `key:value` → symbol id, for the key icons a card may reference. */
const KEY_IDS = Object.fromEntries(Object.keys(KEYS).map((key) => [key, keyId(key)]));

const symbol = (id) =>
  `<symbol id="${id}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${SYMBOLS.get(id)}</symbol>`;
const sprite = (ids) =>
  '<svg class="icon-sprite" aria-hidden="true" focusable="false" width="0" height="0">' +
  ids.map(symbol).join('') +
  '</svg>';

/** Every symbol, once — the app shell's sprite. `display: none` would not resolve. */
export const ICON_SPRITE = sprite([...SYMBOLS.keys()]);

const REF_RE = /#((?:ic|gl)-[a-z0-9-]+)/g;

/** The symbols a flat page's markup references, as one sprite; '' when none. */
export function spriteFor(body) {
  const ids = new Set([...String(body).matchAll(REF_RE)].map((m) => m[1]).filter((id) => SYMBOLS.has(id)));
  return ids.size ? sprite([...ids].sort()) : '';
}

/**
 * One glyph in a lane's chrome: 12px, `currentColor`, decorative, before its
 * label (`after` for NEXT, whose arrow points on). `name` is a Lucide name
 * from GLYPHS, or a key icon's `ic-…` id — a panel's at-rest head wears its
 * card's subject.
 */
export function glyph(name, { after = false } = {}) {
  const id = name.startsWith('ic-') ? name : `gl-${name}`;
  if (!SYMBOLS.has(id)) throw new Error(`icons: no symbol ${id}`);
  return `<svg class="gl lane${after ? ' after' : ''}" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;
}

const GENERATED = '// GENERATED by www/atlas.lit-ui-router.dev/generator/emit-app.mjs from generator/icons.mjs — do not edit.\n';

/** app/src/generated/icons.js: the sprite and the key-id table, as data. */
export const iconsModule = () =>
  GENERATED +
  `export const ICON_SPRITE = ${JSON.stringify(ICON_SPRITE)};\n` +
  `const KEY_IDS = ${JSON.stringify(KEY_IDS)};\n` +
  'export const iconId = (key, value) => KEY_IDS[`${key}:${value}`];\n';

/** app/src/generated/icons.d.ts */
export const ICONS_DTS =
  GENERATED +
  '/** Every symbol, once. Goes in the shell; `display: none` would not resolve. */\n' +
  'export declare const ICON_SPRITE: string;\n' +
  "/** The symbol id for a key's value, or undefined where nothing is drawn. */\n" +
  'export declare function iconId(key: string, value: string): string | undefined;\n';
