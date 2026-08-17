// Shared drawing-sheet chrome: tokens, frame, title block.
// Light = graphite on vellum; dark = cyanotype. Three-state theming per artifact rules.

export const DATE = '2026-08-16';
export const PROJECT = 'THE ALTITUDE ATLAS';
export const CLIENT = 'lit-ui-router · simshanith';
export const TOTAL = 12;

export const CSS = `
:root {
  --ground: #E6E6DA;
  --paper: #F1F0E7;
  --paper-2: #E9E8DD;
  --ink: #2B302C;
  --ink-soft: #5C6259;
  --ink-faint: #9AA091;
  --line: #C6C8B6;
  --edge: #A9AB99;
  --accent: #2E5077;
  --accent-soft: #6E88A6;
  --red: #A63D2F;
  --green: #4C6B51;
  --halo: rgba(46, 80, 119, 0.10);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #0A1B34;
    --paper: #102A50;
    --paper-2: #0D2344;
    --ink: #D9E6F3;
    --ink-soft: #93A9C6;
    --ink-faint: #5F7899;
    --line: #23406B;
    --edge: #2E4C7C;
    --accent: #8FBCE9;
    --accent-soft: #5B84B4;
    --red: #E38C6F;
    --green: #8AB795;
    --halo: rgba(143, 188, 233, 0.12);
  }
}
:root[data-theme="dark"] {
  --ground: #0A1B34;
  --paper: #102A50;
  --paper-2: #0D2344;
  --ink: #D9E6F3;
  --ink-soft: #93A9C6;
  --ink-faint: #5F7899;
  --line: #23406B;
  --edge: #2E4C7C;
  --accent: #8FBCE9;
  --accent-soft: #5B84B4;
  --red: #E38C6F;
  --green: #8AB795;
  --halo: rgba(143, 188, 233, 0.12);
}

* { box-sizing: border-box; margin: 0; }
:root {
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --serif: "Charter", "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif;
}
body {
  background: var(--ground);
  color: var(--ink);
  font-family: var(--serif);
  padding: clamp(12px, 3vw, 40px);
  line-height: 1.5;
}

.sheet {
  position: relative;
  max-width: 1180px;
  margin: 0 auto 40px;
  background: var(--paper);
  border: 1.5px solid var(--ink);
  padding: 26px;
  box-shadow: 0 1px 0 var(--edge), 0 8px 28px rgba(0,0,0,0.08);
}
.sheet::before {
  content: "";
  position: absolute;
  inset: 8px;
  border: 1px solid var(--edge);
  pointer-events: none;
}
.sheet > * { position: relative; }

.sheet-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--ink);
  padding: 4px 2px 10px;
  margin-bottom: 18px;
}
.lettering, .sheet-head, .titleblock, .keyblock, .stat-bar {
  font-family: var(--mono);
}
.sheet-head .proj {
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--ink-soft);
}
.sheet-head .shno {
  font-size: 11px;
  letter-spacing: 0.14em;
  font-variant-numeric: tabular-nums;
}
.sheet-title {
  font-family: var(--mono);
  font-size: clamp(17px, 2.6vw, 23px);
  letter-spacing: 0.10em;
  font-weight: 600;
  text-wrap: balance;
  margin-bottom: 4px;
}
.sheet-sub {
  font-family: var(--mono);
  font-size: 11.5px;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
  margin-bottom: 16px;
}

.figure-wrap { overflow-x: auto; margin: 6px 0 18px; }
.figure-wrap svg { display: block; max-width: 100%; height: auto; min-width: 640px; margin: 0 auto; }
figure { margin: 0; }
figcaption {
  font-family: var(--serif);
  font-size: 14px;
  color: var(--ink-soft);
  max-width: 68ch;
  margin: 10px auto 0;
  font-style: italic;
}

.notes-grid {
  display: grid;
  grid-template-columns: minmax(260px, 3fr) minmax(200px, 2fr);
  gap: 22px;
  border-top: 1px solid var(--ink);
  padding-top: 16px;
  align-items: start;
}
@media (max-width: 720px) { .notes-grid { grid-template-columns: 1fr; } }
.notes h3, .keyblock h3 {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.18em;
  font-weight: 600;
  color: var(--ink-soft);
  margin-bottom: 8px;
}
.notes p {
  font-size: 15px;
  max-width: 62ch;
  margin-bottom: 9px;
}
.notes p strong { font-weight: 600; }
.notes p code, .gal-body code {
  font-family: var(--mono);
  font-size: 0.85em;
  background: var(--paper-2);
  border: 1px solid var(--line);
  padding: 0 4px;
  border-radius: 2px;
  white-space: nowrap;
}
.keyblock table { border-collapse: collapse; width: 100%; }
.keyblock td {
  font-size: 11px;
  letter-spacing: 0.03em;
  padding: 5px 8px 5px 0;
  border-bottom: 1px solid var(--line);
  vertical-align: middle;
}
.keyblock td:first-child { width: 58px; }
.keyblock svg { display: block; }

.titleblock {
  margin-top: 20px;
  margin-left: auto;
  width: min(460px, 100%);
  border: 1.5px solid var(--ink);
  display: grid;
  grid-template-columns: 1fr 1fr;
  font-variant-numeric: tabular-nums;
}
.titleblock > div {
  padding: 6px 10px 7px;
  border-top: 1px solid var(--ink);
  font-size: 11px;
  letter-spacing: 0.06em;
}
.titleblock > div:nth-child(-n+2) { border-top: none; }
.titleblock > div:nth-child(2n) { border-left: 1px solid var(--ink); }
.titleblock .span2 { grid-column: 1 / -1; border-left: none !important; }
.titleblock .fld {
  display: block;
  font-size: 8.5px;
  letter-spacing: 0.16em;
  color: var(--ink-soft);
  margin-bottom: 2px;
}

/* ---- SVG drawing classes ---- */
.sk   { stroke: var(--ink); fill: none; stroke-width: 1.3; }
.sk2  { stroke: var(--ink); fill: none; stroke-width: 2; }
.skf  { stroke: var(--line); fill: none; stroke-width: 1; }
.sks  { stroke: var(--ink-soft); fill: none; stroke-width: 1.1; }
.ska  { stroke: var(--accent); fill: none; stroke-width: 1.6; }
.skr  { stroke: var(--red); fill: none; stroke-width: 1.4; }
.skg  { stroke: var(--green); fill: none; stroke-width: 1.4; }
.fp   { fill: var(--paper); }
.fp2  { fill: var(--paper-2); }
.fi   { fill: var(--ink); }
.fis  { fill: var(--ink-soft); }
.fa   { fill: var(--accent); }
.fr   { fill: var(--red); }
.fg   { fill: var(--green); }
.fhalo{ fill: var(--halo); }
.fnone{ fill: none; }
text.lbl   { font-family: var(--mono); font-size: 11px; fill: var(--ink); letter-spacing: 0.05em; }
text.lblb  { font-family: var(--mono); font-size: 11.5px; font-weight: 600; fill: var(--ink); letter-spacing: 0.07em; }
text.lbls  { font-family: var(--mono); font-size: 9.5px; fill: var(--ink-soft); letter-spacing: 0.05em; }
text.lblf  { font-family: var(--mono); font-size: 9px; fill: var(--ink-faint); letter-spacing: 0.05em; }
text.lbla  { font-family: var(--mono); font-size: 11px; font-weight: 600; fill: var(--accent); letter-spacing: 0.07em; }
text.lblr  { font-family: var(--mono); font-size: 9.5px; fill: var(--red); letter-spacing: 0.05em; }
text.lblt  { font-family: var(--mono); font-size: 13px; font-weight: 600; fill: var(--ink); letter-spacing: 0.12em; }
text.serif { font-family: var(--serif); font-size: 13px; fill: var(--ink); }

@media (prefers-reduced-motion: no-preference) {
  .sheet { transition: box-shadow 0.2s; }
}
a { color: var(--accent); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;

// Marker defs (per-sheet id prefix keeps the gallery collision-free).
export function defs(p) {
  return `<defs>
  <marker id="${p}-ai" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="9" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,4 L0,8 z" class="fi"/>
  </marker>
  <marker id="${p}-aa" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="9" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,4 L0,8 z" class="fa"/>
  </marker>
  <marker id="${p}-ar" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="9" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,4 L0,8 z" class="fr"/>
  </marker>
  <marker id="${p}-as" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="9" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,4 L0,8 z" class="fis"/>
  </marker>
  <pattern id="${p}-hx" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="6" class="skf"/>
  </pattern>
  <pattern id="${p}-hd" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ink-soft)" stroke-width="1"/>
  </pattern>
  <pattern id="${p}-hr" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
    <line x1="0" y1="0" x2="0" y2="6" stroke="var(--red)" stroke-width="1" opacity="0.55"/>
  </pattern>
  <pattern id="${p}-ha" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" stroke-width="1" opacity="0.5"/>
  </pattern>
</defs>`;
}

export function titleBlock(sheet) {
  return `<div class="titleblock" aria-label="title block">
  <div class="span2"><span class="fld">PROJECT</span>${PROJECT}</div>
  <div class="span2"><span class="fld">SHEET TITLE</span>${sheet.title}</div>
  <div><span class="fld">SCALE</span>${sheet.scale}</div>
  <div><span class="fld">FORM</span>${sheet.form}</div>
  <div><span class="fld">CLIENT</span>${CLIENT}</div>
  <div><span class="fld">DATE / REV</span>${DATE} · ${sheet.rev ?? 'A'}</div>
  <div><span class="fld">DRAWN BY</span>FABLE (CLAUDE, AI)</div>
  <div><span class="fld">SHEET</span>${sheet.num} OF ${TOTAL}</div>
</div>`;
}

export function sheetSection(sheet, { headline = true } = {}) {
  return `<section class="sheet" id="sheet-${sheet.num}" aria-label="Sheet ${sheet.num}: ${sheet.title}">
  <div class="sheet-head"><span class="proj">${PROJECT} — DRAWING SET</span><span class="shno">SHEET ${sheet.num} / ${TOTAL}</span></div>
  ${headline ? `<h2 class="sheet-title">${sheet.title}</h2>\n  <p class="sheet-sub">${sheet.sub}</p>` : ''}
  <figure>
    <div class="figure-wrap">${sheet.svg}</div>
    <figcaption>${sheet.caption}</figcaption>
  </figure>
  <div class="notes-grid">
    <div class="notes">
      <h3>GENERAL NOTES</h3>
      ${sheet.notes}
    </div>
    <div class="keyblock">
      <h3>KEY</h3>
      <table>${sheet.key}</table>
      ${titleBlock(sheet)}
    </div>
  </div>
</section>`;
}

export function page(title, body, { desc = '' } = {}) {
  return `<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
${desc ? `<meta name="description" content="${desc}">` : ''}
<style>${CSS}</style>
${body}`;
}
