// Shared drawing-sheet chrome: tokens, frame, title block.
// Light = graphite on vellum; dark = cyanotype. Three-state theming per artifact rules.

import { readFileSync } from 'node:fs';

// Title-block date = the census basis ref's commit date, never a hard-coded day
const PLATE = JSON.parse(readFileSync(new URL('../data/census-files.json', import.meta.url), 'utf8'));
export const DATE = PLATE.commitDate.slice(0, 10);
export const PROJECT = 'THE ALTITUDE ATLAS';
export const CLIENT = 'lit-ui-router · simshanith';
export const TOTAL = 14;

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
  --red-hatch: #A63D2F;
  --green: #4C6B51;
  --halo: rgba(46, 80, 119, 0.10);
  /* Annotation grey and the Cherokee-red chop. Declared for the whole set;
     read today only by the type specimen (app/src/specimen.ts). */
  --pencil: #7B8078;
  --cherokee: #9E3A2B;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #0A1B34;
    --paper: #102A50;
    --paper-2: #0B1F3E;
    --ink: #D9E6F3;
    --ink-soft: #93A9C6;
    --ink-faint: #6E88A8;
    --line: #23406B;
    --edge: #2E4C7C;
    --accent: #8FBCE9;
    --accent-soft: #5B84B4;
    /* fills keep the red red; the salmon survives as the hatch stroke */
    --red: #D96C55;
    --red-hatch: #E38C6F;
    --green: #8AB795;
    --halo: rgba(143, 188, 233, 0.12);
    --pencil: #7E97B8;
    --cherokee: #E0705A;
  }
}
:root[data-theme="dark"] {
  --ground: #0A1B34;
  --paper: #102A50;
  --paper-2: #0B1F3E;
  --ink: #D9E6F3;
  --ink-soft: #93A9C6;
  --ink-faint: #6E88A8;
  --line: #23406B;
  --edge: #2E4C7C;
  --accent: #8FBCE9;
  --accent-soft: #5B84B4;
  --red: #D96C55;
  --red-hatch: #E38C6F;
  --green: #8AB795;
  --halo: rgba(143, 188, 233, 0.12);
  --pencil: #7E97B8;
  --cherokee: #E0705A;
}

* { box-sizing: border-box; margin: 0; }
/* ---- THE TYPE ROLES ----
   Decided 2026-09-05 on the type specimen (app/src/specimen.ts, pairing
   5 · THE ATLAS SET). Each stack names the ADOBE FONTS family FIRST — it draws
   on the site, where generator/stage-site.mjs injects the kit — the Google
   Fonts stand-in SECOND, and a generic last. The artifact, and any host
   without the kit, resolves the second name; nothing is ever synthesised.
   Weight 600 is asked for wherever the plan said Demi: Adobe serves 400/700
   and CSS resolves a 600 request upward to 700, Google serves a real 600, so
   ONE number covers both hosts.

   --display  the atlas name, EVERYWHERE it is drawn: rail head, cover title,
              and the condensed wordmark's own name (.project-mark) in every
              sheet-head PROJECT line and title block PROJECT value
   --title    sheet titles, card and prose headings, rail entry titles
   --data     kickers, tracked caps, numbers, schedules, the title block
   --prose    running text, figcaptions, general notes, About. Source Serif
              is the one role whose two names are the SAME design under two
              releases: source-serif-pro from the kit on the site, Source
              Serif 4 from Google in the artifact.
   --code     code identifiers. Source Code Pro on BOTH hosts (2026-09-06):
              source-code-pro from the kit on the site, the same Slimbach
              design from Google in the artifact. Since 2026-09-06 the PLATES
              draw in --data too (see text.lbl* below): mono is reserved for
              code, and --mono survives only as the tail of this stack.
   --hand     P22 FLLW Eaglefeather Informal, MIXED CASE, on the title block's
              DRAWN BY value and at most one callout line per sheet — nowhere
              else. No Google stand-in by decision: off the kit it falls to
              --data, so the artifact loads nothing new.
   --serif    kept as an alias of --prose so nothing downstream breaks. */
:root {
  /* the system stack; since 2026-09-06 nothing reads it but --code's tail */
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --display: "p22-fllw-eaglefeather", "Josefin Sans", sans-serif;
  --title: "p22-flw-exhibition", "Josefin Sans", sans-serif;
  --data: "din-2014", "Barlow Semi Condensed", sans-serif;
  --prose: "source-serif-pro", "Source Serif 4", "Charter", "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif;
  --code: "source-code-pro", "Source Code Pro", var(--mono);
  --hand: "p22-fllw-eaglefeather-inf", var(--data);
  --serif: var(--prose);
}
body {
  background: var(--ground);
  color: var(--ink);
  font-family: var(--prose);
  padding: clamp(12px, 3vw, 40px);
  line-height: 1.5;
  /* what a sticky inset clears: the routed app raises it for its utility bar */
  --sticky-top: 12px;
}

/* THE SHEET. Full width at every viewport — no centred cap, so a widescreen
   shows the plate near its drawn size; the inner rule at 8 and the text at
   22 keep the double frame reading as one. Only running text keeps a measure. */
.sheet {
  position: relative;
  max-width: none;
  margin: 0 0 40px;
  background: var(--paper);
  border: 1.5px solid var(--ink);
  padding: 22px;
  /* paper on a light table casts no soft shadow: the 1px edge only */
  box-shadow: 0 1px 0 var(--edge);
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
/* The ledger. 11px of the data face carries the same cap-height as the 10.5px
   mono it replaces (specimen GLYPH SIZE readout, within 1%), so the sizes here
   step up by half a pixel rather than by eye. */
.lettering, .sheet-head, .titleblock, .keyblock, .stat-bar {
  font-family: var(--data);
  font-variant-numeric: tabular-nums;
}
.sheet-head .proj {
  font-size: 11.5px;
  letter-spacing: 0.14em;
  color: var(--ink-soft);
}
.sheet-head .shno {
  font-size: 11.5px;
  letter-spacing: 0.14em;
  font-variant-numeric: tabular-nums;
}
.sheet-title {
  font-family: var(--title);
  font-size: clamp(18px, 2.7vw, 24px);
  letter-spacing: 0.06em;
  font-weight: 600;
  text-wrap: balance;
  margin-bottom: 4px;
}
/* THE ARTICLE (T9, shipped 2026-09-06). Every sheet title begins with THE and
   the title face is unicase — no small cap, no alternate, nothing to demote it
   with. So the article is drawn as a superior in the DATA face: lowercase, 0.6em
   of the title, soft ink. It needs no kit face, so it is identical on the site,
   the flat set and the artifact. line-height 0 keeps the superior out of the
   title's line box. */
sup.art {
  font-family: var(--data);
  font-size: 0.6em;
  font-weight: 400;
  font-variant-numeric: normal;
  letter-spacing: 0;
  text-transform: lowercase;
  line-height: 0;
  color: var(--ink-soft);
  /* the sup carries its own no-break space (so the title reads "the MEASURED
     CITY" to a reader and never breaks after the article); this is the rest */
  margin-right: 0.1em;
}
/* THE CONDENSED WORDMARK — one of the atlas's TWO names for itself. The other
   is the full uppercase wordmark in the display face, which the rail head and
   the cover title carry plain. This one is the LEDGER name: the article as the
   data-face superior (sup.art, above) and the name in the display face
   (.project-mark, below). Two sites carry it — every sheet-head PROJECT line
   and the title block's PROJECT value — and both emit the same PROJECT_MARK,
   so it draws identically on every host.
   A kit catchword was tried for the article and dropped 2026-09-12. */
/* THE NAME, wherever the wordmark is drawn. The face travels with the MARK,
   not with the site: the sheet-head ledger line and the title block's PROJECT
   value both emit PROJECT_MARK, so both set ALTITUDE ATLAS in Eaglefeather at
   the weight the rail head and the cover title use.
   1.06em, MEASURED not guessed: Eaglefeather at the resolved 700 caps at 0.651
   of its em and DIN 2014 at 0.690, so 0.690/0.651 = 1.06 is the size at which
   the name's cap sits on the ledger's. In a sheet head that is 12.19px of
   display beside 11.5px of data — both cap at 7.94px — and the tail
   (" — DRAWING SET") keeps the ledger face at the line's own size. In a title
   block it is 14.31px inside the 13.5px .dsp, capping at 9.32px: the same cap
   the ledger face would have drawn there, a tenth under the sheet title's. */
.project-mark {
  font-family: var(--display);
  font-size: 1.06em;
  font-weight: 600;
}
.sheet-sub {
  font-family: var(--data);
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
  margin-bottom: 16px;
}

/* THE PLATE IS THE PAGE. It never shrinks below 1000px — under that width it
   scrolls in its own wrap like a drawing on a light table, and the wrap says so.
   Above that it grows with the column but is CONTAINED: the whole plate stays on
   one screen. An inline SVG letterboxes under max-height instead of shrinking,
   so the cap reaches it through max-width times the plate's own viewBox ratio
   (--plate-ar, written per sheet). */
.plate { position: relative; container-type: inline-size; margin: 20px 0 14px; --plate-cap: min(84vh, 1400px); }
.figure-wrap { overflow-x: auto; }
.figure-wrap svg { display: block; width: 100%; max-width: min(100%, calc(var(--plate-cap) * var(--plate-ar, 1.4))); height: auto; min-width: 1000px; margin: 0 auto; }
.plate::after {
  content: "SCROLL →";
  display: none;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 72px;
  padding: 6px 0 0;
  text-align: right;
  font-family: var(--data);
  font-size: 9.5px;
  letter-spacing: 0.16em;
  color: var(--ink-soft);
  background: linear-gradient(90deg, transparent, var(--paper) 70%);
  pointer-events: none;
  transition: opacity 0.2s;
}
@container (width < 1000px) { .plate::after { display: block; } }
/* at the end of the scroll the affordance steps aside — the plate's right edge is the point */
.plate[data-end]::after { opacity: 0; }
figure { margin: 0; }
figcaption {
  font-family: var(--prose);
  font-size: 14.5px;
  color: var(--ink-soft);
  max-width: 66ch;
  margin: 0;
  font-style: italic;
}
figcaption .figno {
  font-family: var(--data);
  font-style: normal;
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--ink-soft);
  margin-right: 10px;
}

/* ONE MEASURE, INSETS TO THE RIGHT. Running text in the left column; the key,
   the title block and the revisions are one inset strip that rides alongside
   whatever paragraph is on screen. The strip and its gutter are named because
   the notes' column count has to subtract them to know its own width. */
.notes-grid {
  --inset: 352px;
  --inset-gap: 24px;
  display: grid;
  grid-template-columns: minmax(0, 7fr) var(--inset);
  gap: var(--inset-gap);
  border-top: 1px solid var(--ink);
  padding-top: 16px;
  align-items: start;
}
@media (max-width: 1180px) { .notes-grid { grid-template-columns: minmax(0, 3fr) minmax(260px, 2fr); } }
@media (max-width: 720px) { .notes-grid { grid-template-columns: 1fr; } }
.keyblock { position: sticky; top: var(--sticky-top); }
@media (max-width: 720px) { .keyblock { position: static; } }
/* COLUMNS AT THE WIDTH THE PAPER GIVES. The count is an integer read off the
   paper itself — one column per 28rem of the notes cell, which is the grid
   less the inset strip and its gutter, both named above so the subtraction
   cannot drift from the track it is subtracting. The query hangs off
   .notes-grid because an element's own container-type does not feed its own
   properties; declared on .notes it would silently resolve against the
   viewport. Under 1180 the grid re-proportions and the cell is never wide
   enough to divide, so the count is simply 1 and no second formula is owed.
   Rounded to nearest, not down: rounding down cannot hold both ends at once —
   two columns at 1440 wants the divisor under 469px, three rather than four at
   2560 wants it over 514px. Nearest at 38rem takes both, and lands 4 at 3008,
   3 at 2560, 2 at 1440, with no column narrower than 447px or wider than 706
   between 1200 and 3400. The measure cap on the paragraph is the one guard the
   count cannot give: it bites only at a single column. */
.notes-grid { container-type: inline-size; }
.notes {
  column-count: calc((100cqw - var(--inset) - var(--inset-gap)) / 38rem);
  column-gap: 44px;
}
@media (max-width: 1180px) { .notes { column-count: 1; } }
.notes h3, .keyblock h3 {
  font-family: var(--data);
  font-size: 11px;
  letter-spacing: 0.18em;
  font-weight: 600;
  color: var(--ink-soft);
  margin-bottom: 8px;
}
/* the head rules the whole block, so it spans it — and is lettered to match */
.notes h3 {
  column-span: all;
  font-size: 12.5px;
  margin-bottom: 18px;
}
.notes p {
  font-family: var(--prose);
  font-size: 18px;
  line-height: 1.8;
  /* Only ever bites at one column: the count holds every wider layout under
     706px on its own, so this is the guard for the 1180–1440 band, where a
     lone column would otherwise run out to 91ch. */
  max-width: 74ch;
  margin-bottom: 2em;
}
.notes p strong { font-weight: 600; }
/* a paragraph's opening strong is a run-in head — give it its own line, but
   only where it opens the paragraph, never a strong caught mid-sentence. It
   never ends a column alone: a head is a promise about the text under it. */
.notes p > strong:first-child { display: block; break-after: avoid; }
/* every inline chip is the code face, not the UA's own monospace default */
code, kbd, samp { font-family: var(--code); }
.notes p code, .gal-body code {
  font-family: var(--code);
  font-size: 0.88em;
  background: var(--paper-2);
  /* fill only: at 14 chips in 15 lines a border made the paragraph a form */
  padding: 0 3px;
  border-radius: 2px;
  /* A chip breaks only when it would otherwise run off the column, and then at
     a space, never inside an identifier. */
  overflow-wrap: break-word;
  hyphens: none;
}
.keyblock table { border-collapse: collapse; width: 100%; }
.keyblock td {
  font-size: 11.5px;
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
  font-size: 11.5px;
  letter-spacing: 0.06em;
}
.titleblock > div:nth-child(-n+2) { border-top: none; }
.titleblock > div:nth-child(2n) { border-left: 1px solid var(--ink); }
.titleblock .span2 { grid-column: 1 / -1; border-left: none !important; }
.titleblock .fld {
  display: block;
  font-family: var(--data);
  font-size: 9.5px;
  letter-spacing: 0.16em;
  color: var(--ink-soft);
  margin-bottom: 2px;
}
/* The two values that carry the atlas's own name, and the sheet's. PROJECT is
   the CONDENSED wordmark, and its NAME is the display face — the same wordmark
   the sheet-head line above it now carries; only the article beside it is the
   ledger's. */
.titleblock .dsp {
  font-family: var(--display);
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.10em;
}
.titleblock .ttl {
  font-family: var(--title);
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
/* THE ARTICLE, INLINE — the title block's SHEET TITLE field ALONE. A ledger
   field is read as a value, not as a headline, so here the word is set at the
   value's own size on its own baseline in the data face, rather than lifted
   into a superior. Its own class, so it can never reach sup.art. */
.titleblock .ttl .art-inline {
  font-family: var(--data);
  font-size: inherit;
  font-weight: 400;
  font-variant-numeric: normal;
  text-transform: lowercase;
  letter-spacing: 0.02em;
  color: var(--ink-soft);
  vertical-align: baseline;
}
/* DRAWN BY: the one signed value, in the hand, in mixed case — never tracked
   caps. Sized up from the .dsp 13.5px because Eaglefeather Informal runs a
   smaller cap for its em. */
.titleblock .hand {
  font-family: var(--hand);
  font-size: 16px;
  letter-spacing: 0.02em;
  text-transform: none;
}
/* The chop: a plain square in the Cherokee red, unrotated — the corner stamp,
   not a jaunty sticker. It sits at the right edge of the SHEET cell. */
.titleblock .sh { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.titleblock .chop {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  margin-right: 2px;
  border: 1.5px solid var(--cherokee);
  box-shadow: inset 0 0 0 1.5px var(--paper), inset 0 0 0 4px var(--cherokee);
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
/* THE PLATES DRAW IN THE DATA FACE (2026-09-06). Mono is reserved for code.
   DIN is a strict contraction of the system mono at these sizes — median -26%,
   nothing grows — and every label is start- or end-anchored, so the lettering
   only opens air. Sizes, weights, fills and tracking are unchanged. */
text.lbl   { font-family: var(--data); font-variant-numeric: tabular-nums; font-size: 11.5px; fill: var(--ink); letter-spacing: 0.05em; }
text.lblb  { font-family: var(--data); font-variant-numeric: tabular-nums; font-size: 11.5px; font-weight: 600; fill: var(--ink); letter-spacing: 0.07em; }
text.lbls  { font-family: var(--data); font-variant-numeric: tabular-nums; font-size: 10.5px; fill: var(--ink-soft); letter-spacing: 0.05em; }
text.lblf  { font-family: var(--data); font-variant-numeric: tabular-nums; font-size: 10px; fill: var(--ink-faint); letter-spacing: 0.05em; }
text.lbla  { font-family: var(--data); font-variant-numeric: tabular-nums; font-size: 11px; font-weight: 600; fill: var(--accent); letter-spacing: 0.07em; }
text.lblr  { font-family: var(--data); font-variant-numeric: tabular-nums; font-size: 9.5px; fill: var(--red); letter-spacing: 0.05em; }
text.lblt  { font-family: var(--data); font-variant-numeric: tabular-nums; font-size: 13px; font-weight: 600; fill: var(--ink); letter-spacing: 0.12em; }
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
    <line x1="0" y1="0" x2="0" y2="6" stroke="var(--red-hatch)" stroke-width="1" opacity="0.55"/>
  </pattern>
  <pattern id="${p}-ha" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" stroke-width="1" opacity="0.5"/>
  </pattern>
</defs>`;
}

/**
 * A title with its leading THE drawn as the article superior (see `sup.art`).
 * The manifest titles stay frozen — this is a RENDER transform, applied
 * wherever a title is printed in full. Twin in the app: `articleTitle` in
 * app/src/views.ts and app/prerender.ts; keep the three in lockstep.
 */
export const articleTitle = (title = '') =>
  String(title).replace(/^THE\s+/, '<sup class="art">the&nbsp;</sup>');

/**
 * The same transform for the TITLE BLOCK's SHEET TITLE field ALONE: the word on
 * the baseline at the value's own size in the data face (`.art-inline`).
 */
export const articleTitleInline = (title = '') =>
  String(title).replace(/^THE\s+/, '<span class="art-inline">the&nbsp;</span>');

/**
 * The project name AS DRAWN — the condensed wordmark (see `.project-mark`).
 * Plain `PROJECT` stays for `<title>`, aria names and the rail's wordmark.
 * Twins in the app: `PROJECT_MARK` in app/src/views.ts and app/prerender.ts.
 */
export const PROJECT_MARK = PROJECT.replace(
  /^THE\s+(.+)$/,
  '<sup class="art">the&nbsp;</sup><span class="project-mark">$1</span>',
);

export function titleBlock(sheet) {
  return `<div class="titleblock" aria-label="title block">
  <div class="span2"><span class="fld">PROJECT</span><span class="dsp">${PROJECT_MARK}</span></div>
  <div class="span2"><span class="fld">SHEET TITLE</span><span class="ttl">${articleTitleInline(sheet.title)}</span></div>
  <div><span class="fld">SCALE</span>${sheet.scale}</div>
  <div><span class="fld">FORM</span>${sheet.form}</div>
  <div><span class="fld">CLIENT</span>${CLIENT}</div>
  <div><span class="fld">DATE / REV</span>${DATE} · ${sheet.rev ?? 'A'}</div>
  <div><span class="fld">DRAWN BY</span><span class="hand">Fable (Claude, AI)</span></div>
  <div class="sh"><span><span class="fld">${sheet.appendix ? 'APPENDIX' : 'SHEET'}</span>${sheet.num}${sheet.appendix ? '' : ` OF ${TOTAL}`}</span><span class="chop" aria-hidden="true"></span></div>
</div>`;
}

// the plate's own aspect ratio, read off its viewBox, so the contain cap can be
// spent on max-width (CSS cannot reach an inline SVG's width through max-height)
export function plateRatio(svg) {
  const m = /viewBox="\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/.exec(svg ?? '');
  return m && Number(m[2]) > 0 ? (Number(m[1]) / Number(m[2])).toFixed(4) : null;
}

export function sheetSection(sheet, { headline = true } = {}) {
  const ar = plateRatio(sheet.svg);
  return `<section class="sheet" id="sheet-${sheet.num}" aria-label="${sheet.appendix ? 'Appendix' : 'Sheet'} ${sheet.num}: ${sheet.title}">
  <div class="sheet-head"><span class="proj">${PROJECT_MARK} — DRAWING SET</span><span class="shno">${sheet.head ?? `SHEET ${sheet.num} / ${TOTAL}`}</span></div>
  ${headline ? `<h2 class="sheet-title">${articleTitle(sheet.title)}</h2>\n  <p class="sheet-sub">${sheet.sub}</p>` : ''}
  <figure>
    <div class="plate"${ar ? ` style="--plate-ar:${ar}"` : ''}><div class="figure-wrap">${sheet.svg}</div></div>
    <figcaption><span class="figno">FIG. ${sheet.num}</span>${sheet.caption}</figcaption>
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

// The scrolled plate marks its end so the SCROLL → fade clears the drawing's
// right edge. The app's <atlas-plate> keeps the same rule in views.ts.
export const PLATE_END_SCRIPT = `document.addEventListener('scroll', (e) => {
  const w = e.target;
  if (!(w instanceof Element) || !w.classList.contains('figure-wrap')) return;
  w.parentElement?.toggleAttribute('data-end', w.scrollLeft + w.clientWidth >= w.scrollWidth - 1);
}, true);`;

// HTML only — `<wbr>` is not an SVG element, so this runs over rendered pages
// and fragments, never over a plate's `<text>`. A path-shaped chip breaks after
// its slash rather than mid-identifier; the chip's own text is untouched.
export const chipBreaks = (html) =>
  String(html).replace(/(<code\b[^>]*>)([^<]*)(<\/code>)/g, (m, open, text, close) =>
    text.includes('/') ? open + text.replace(/\/(?!<wbr>)/g, '/<wbr>') + close : m);

export function page(title, body, { desc = '' } = {}) {
  return `<meta charset="utf-8">
<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
${desc ? `<meta name="description" content="${desc}">` : ''}
<style>${CSS}</style>
${chipBreaks(body)}
<script>${PLATE_END_SCRIPT}</script>`;
}
