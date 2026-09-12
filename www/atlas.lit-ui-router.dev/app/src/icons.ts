/**
 * THE KEY ICONS — one drawing per key value, in one sprite, drawn once a page.
 *
 * FORM's keys are a closed vocabulary (generator/labels.mjs), so the icon set
 * is closed too: twelve subjects, six projections and the one mode that is
 * drawn. A card's key row references them, and so does every chip in the
 * cover's key index — which is what makes the index the legend for the cards.
 *
 * Three sources, one idiom. The projections are the house's own 16-grid
 * glyphs, unchanged. Ten subjects and the mode lamp are Lucide line icons
 * (ISC), restroked: their 24-grid paths ride a `scale(2/3)` group inside the
 * house's 16 viewBox, at a stroke of 1.95 that lands at 1.3 after the scale.
 * `register` and `spine` are drawn here, natively on the 16 grid, because no
 * stock set has a punched card or a family spine.
 *
 * The sprite is INLINE MARKUP, not a fetch: `ICON_SPRITE` goes into the app
 * shell (src/views.ts) and the prerendered one (prerender.ts), and cells
 * reference a symbol by id. No icon package, no runtime request.
 */

/** A Lucide body, scaled off its 24 grid onto the house's 16. */
const lucide = (body: string): string =>
  `<g transform="scale(.666667)" stroke-width="1.95">${body}</g>`;

/**
 * The house's own 16-grid drawings: a `d`, and dots as round-capped stubs at
 * whatever weight reads — the graph's three nodes are heavy, the register's
 * nine holes are hairline or they close into one black square at 12px.
 */
const house = (d: string, dots = '', dotWidth = 3.2): string =>
  `<path stroke-width="1.3" d="${d}"/>` +
  (dots ? `<path stroke-width="${String(dotWidth)}" stroke-linecap="round" d="${dots}"/>` : '');

/**
 * `key:value` → the symbol's body. Subjects and the mode lamp are Lucide
 * (`building`, `chart-scatter` — the names `building-2` and `scatter-chart`
 * were renamed upstream); `register` and `spine` are drawn here.
 */
const SHAPES: Record<string, string> = {
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

/** `isometric graph` → `ic-isometric-graph`. Values are unique across keys. */
const idFor = (value: string): string => `ic-${value.replace(/\s+/g, '-')}`;

/** The symbol id for a key's value, or undefined where nothing is drawn. */
export const iconId = (key: string, value: string): string | undefined =>
  `${key}:${value}` in SHAPES ? idFor(value) : undefined;

/** Every symbol, once. Goes in the shell; `display: none` would not resolve. */
export const ICON_SPRITE: string =
  '<svg class="icon-sprite" aria-hidden="true" focusable="false" width="0" height="0">' +
  Object.entries(SHAPES)
    .map(
      ([key, body]) =>
        `<symbol id="${idFor(key.slice(key.indexOf(':') + 1))}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>`,
    )
    .join('') +
  '</svg>';
