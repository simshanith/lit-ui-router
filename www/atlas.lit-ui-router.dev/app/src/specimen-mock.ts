/**
 * The type specimen's mock sheet — its stylesheet and its markup.
 *
 * Split out of specimen.ts so the element reads as behaviour and this file
 * reads as the drawing. Both are strings: the CSS is injected into
 * `document.head` once (never re-parsed on a re-render), and the markup rides
 * `unsafeHTML` inside the mock's root, whose inline style carries the four
 * role tokens the switcher swaps.
 *
 * THE ROLE TOKENS, and the user's constraints on them:
 *   --display  the rail head (THE ALTITUDE ATLAS) — the atlas's own voice
 *   --title    the SHEET title (THE MEASURED CITY) and the title block's
 *              PROJECT / SHEET TITLE values. Split off --display because
 *              Eaglefeather reads well on the atlas name and less well on a
 *              sheet title: "not huge-ist fan of measured city with the s".
 *   --rail-title  the rail entries' TITLES (never their numbers): the data
 *              face by default, the sheet-title face when the user wants the
 *              sidebar nav to match ("maybe if the sidebar nav matched")
 *   --hand     the DRAWN BY value and ONE callout second line — NOWHERE ELSE.
 *              REV descriptions, figcaptions and every other callout are the
 *              DATA face: "i can tolerate arch. daughter sparingly but that's
 *              too much".
 *   --data     kickers, rail entries, crumb, schedule, key rows, title-block
 *              values, REV table, the stamp — tabular figures throughout
 *   --code     code identifiers only (schedule ids, <code> in the notes)
 *   --prose    the General Notes paragraph and the figcaption body — the only
 *              running text on a sheet, and the one role that is a system face
 *              (the Charter stack) by default
 * Sizes hang off --data-sz so the size stepper moves the whole ledger at once.
 * The COUNTED stamp is SQUARE and UNROTATED on purpose ("for now rather have
 * order"), and so is the chop.
 */

export const SPECIMEN_CSS = `
/* The bench takes the content column whole, as every sheet does — no centred cap. */
.specimen { min-width: 0; }

/* --- the switcher ---------------------------------------------------------
   A GROUP WRAPS. Its widest row is the fourteen TITLE ARTICLE buttons, whose
   intrinsic run is 1120px: on a flex row that cannot break, that is 1120px of
   page at every viewport, and the document scrolled sideways from 1400 down.
   Wrapping inside the group is the only break point that does not shrink the
   buttons, whose labels ARE the specimen. The label stays on the first row and
   the seams are drawn on the buttons, pulled up a pixel so the last row's rule
   lands on the group's own border rather than beside it. */
.sp-controls { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: flex-start; margin-bottom: 10px; }
.sp-group { display: flex; flex-wrap: wrap; align-items: stretch; max-width: 100%; border: 1px solid var(--ink); background: var(--paper); }
.sp-group .sp-lbl { display: flex; align-items: center; font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.18em; color: var(--ink-faint); padding: 0 8px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); margin-bottom: -1px; }
.sp-group button { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.12em; color: var(--ink); background: var(--paper); border: 0; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); margin-bottom: -1px; padding: 6px 10px; cursor: pointer; }
.sp-group button:last-child { border-right: 0; }
.sp-group button:hover:not(:disabled) { background: var(--paper-2); }
.sp-group button.on { background: var(--accent); color: var(--paper); font-weight: 600; }
.sp-group button:disabled { color: var(--ink-faint); cursor: not-allowed; }
.sp-group .sp-num { display: flex; align-items: center; font-family: var(--mono); font-size: 10px; padding: 0 8px; border-right: 1px solid var(--line); font-variant-numeric: tabular-nums; }
.sp-note { font-family: var(--data); font-size: 10px; letter-spacing: 0.04em; line-height: 1.6; color: var(--ink-soft); margin-bottom: 14px; }
.sp-note b { color: var(--ink); letter-spacing: 0.14em; }

/* --- the readouts --------------------------------------------------------- */
.sp-read { margin-top: 22px; }
.sp-read h3 { font-family: var(--data); font-size: 9.5px; letter-spacing: 0.18em; color: var(--ink-soft); margin-bottom: 6px; font-weight: 600; }
.sp-tbl { border-collapse: collapse; font-family: var(--data); font-variant-numeric: tabular-nums; font-size: 10.5px; letter-spacing: 0.02em; }
.sp-tbl.num { font-variant-numeric: tabular-nums; }
.sp-tbl th { text-align: left; font-size: 8.5px; letter-spacing: 0.16em; color: var(--ink-faint); border-bottom: 1px solid var(--ink); padding: 0 14px 3px 0; font-weight: 600; }
.sp-tbl td { padding: 3px 14px 3px 0; border-bottom: 1px solid var(--line); vertical-align: baseline; }
.sp-tbl th.n, .sp-tbl td.n { text-align: right; }
.sp-tbl td.k { color: var(--accent); }
.sp-tbl td.dim { color: var(--ink-faint); }
.sp-tbl tr.d td { color: var(--ink); font-weight: 600; border-bottom: 0; border-top: 1px solid var(--ink); }
.sp-tbl td.got { font-weight: 600; }
.sp-tbl td.got.adobe { color: var(--green); }
.sp-tbl td.got.standin { color: var(--accent); }
.sp-tbl td.got.system { color: var(--red); }
.sp-foot { font-family: var(--data); font-size: 9.5px; line-height: 1.7; color: var(--ink-faint); max-width: 92ch; margin-top: 7px; }
.sp-foot code { font-size: 0.95em; background: var(--paper-2); border: 1px solid var(--line); padding: 0 3px; }

/* --- the mock sheet ------------------------------------------------------- */
.mock { --data-sz: 12px; }
.mock .shell { display: grid; grid-template-columns: 214px minmax(0, 1fr); background: var(--paper); border: 1.5px solid var(--ink); }
@media (max-width: 860px) { .mock .shell { grid-template-columns: 1fr; } }

/* rail as the drawing's left margin strip: index tabs */
.mock .m-rail { border-right: 1.5px solid var(--ink); background: var(--paper-2); display: flex; flex-direction: column; }
.mock .m-rail-head { padding: 12px 14px 10px; border-bottom: 1.5px solid var(--ink); }
.mock .m-rail-head .kicker { display: block; font-family: var(--data); font-size: calc(var(--data-sz) - 3px); letter-spacing: 0.22em; color: var(--ink-soft); text-transform: uppercase; }
.mock .m-rail-head h3 { font-family: var(--display); font-weight: var(--disp-wt); font-size: 15px; letter-spacing: var(--disp-ls); text-transform: uppercase; margin-top: 4px; line-height: 1.15; }
.mock .bands { margin-top: 8px; height: 7px; background:
  linear-gradient(var(--ink), var(--ink)) 0 0/100% 1px no-repeat,
  linear-gradient(var(--ink), var(--ink)) 0 3px/100% 1px no-repeat,
  linear-gradient(var(--ink), var(--ink)) 0 6px/70% 2px no-repeat; }
.mock .m-rail-sec { font-family: var(--data); font-size: calc(var(--data-sz) - 3.5px); letter-spacing: 0.2em; color: var(--ink-faint); padding: 12px 14px 4px; text-transform: uppercase; }
.mock .m-rail a { display: grid; grid-template-columns: 34px 1fr; gap: 6px; align-items: baseline; text-decoration: none; color: var(--ink-soft); padding: 4px 14px 4px 12px; border-left: 3px solid transparent; font-family: var(--data); font-size: var(--data-sz); letter-spacing: 0.04em; text-transform: uppercase; font-variant-numeric: tabular-nums; }
.mock .m-rail a .n { color: var(--accent); font-weight: 600; }
/* the RAIL TITLES knob: the data face by default, the sheet-title face when the
   user wants the sidebar nav to match the plate's title */
.mock .m-rail a .t { font-family: var(--rail-title); letter-spacing: var(--rail-title-ls); }
.mock .m-rail a.is-active { color: var(--ink); background: var(--paper); border-left-color: var(--ink); font-weight: 600; margin-right: -1.5px; border-right: 1.5px solid var(--paper); }
.mock .m-rail .foot { margin-top: auto; padding: 10px 14px 12px; border-top: 1px solid var(--line); display: flex; align-items: center; gap: 8px; font-family: var(--data); font-size: calc(var(--data-sz) - 2px); letter-spacing: 0.12em; color: var(--ink-faint); text-transform: uppercase; font-variant-numeric: tabular-nums; }
/* the chop: a SQUARE, unrotated */
.mock .chop { width: 12px; height: 12px; background: var(--cherokee); flex: none; }

.mock .m-body { padding: 0 22px 22px; min-width: 0; }
.mock .m-crumb { display: flex; flex-wrap: wrap; border-bottom: 1px solid var(--ink); font-family: var(--data); font-size: calc(var(--data-sz) - 1px); letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
.mock .m-crumb > * { padding: 7px 12px; border-right: 1px solid var(--line); text-decoration: none; color: inherit; }
.mock .m-crumb > *:first-child { padding-left: 0; }
.mock .m-crumb .of { color: var(--ink); font-weight: 600; }
.mock .m-crumb .end { margin-left: auto; border-right: 0; padding-right: 0; }
.mock .m-head { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; flex-wrap: wrap; padding: 10px 0 8px; }
.mock .m-head .proj { font-family: var(--data); font-size: calc(var(--data-sz) - 1px); letter-spacing: 0.18em; color: var(--ink-soft); text-transform: uppercase; }
.mock .m-head .shno { font-family: var(--data); font-size: var(--data-sz); letter-spacing: 0.14em; font-variant-numeric: tabular-nums; }
/* THE SHEET TITLE is its own role: the rail head keeps --display, this does not */
.mock .m-title { font-family: var(--title); font-weight: var(--title-wt); font-size: var(--title-sz); letter-spacing: var(--title-ls); text-transform: uppercase; line-height: 1.1; margin: 2px 0 6px; }
.mock .m-sub { font-family: var(--data); font-size: calc(var(--data-sz) + 0.5px); letter-spacing: 0.05em; color: var(--ink-soft); line-height: 1.5; max-width: 96ch; margin-bottom: 14px; }

.mock .m-plate { display: grid; grid-template-columns: minmax(0, 3fr) minmax(250px, 2fr); gap: 18px; align-items: start; }
@media (max-width: 860px) { .mock .m-plate { grid-template-columns: 1fr; } }
.mock .m-fig { border: 1px solid var(--edge); background: var(--paper); padding: 8px; }
.mock .m-fig svg { display: block; width: 100%; height: auto; }
.mock .m-fig text { fill: var(--ink); }
.mock .m-fig .lbla { font-family: var(--data); font-size: calc(var(--data-sz) - 0.5px); font-weight: 600; fill: var(--accent); letter-spacing: 0.07em; }
/* every callout but one is the DATA face */
.mock .m-fig .note { font-family: var(--data); font-size: calc(var(--data-sz) - 0.5px); fill: var(--ink-soft); letter-spacing: 0.03em; }
/* THE ONE HAND LINE on the drawing */
.mock .m-fig .note-hand { font-family: var(--hand); font-size: calc(var(--data-sz) + 1px); fill: var(--pencil); letter-spacing: 0; }
.mock .m-fig .lbls { font-family: var(--data); font-size: calc(var(--data-sz) - 1.5px); fill: var(--ink-soft); letter-spacing: 0.04em; }
.mock .m-fig .dim { font-family: var(--data); font-size: calc(var(--data-sz) - 1.5px); fill: var(--ink-soft); font-variant-numeric: tabular-nums; }
.mock .m-fig .sk { stroke: var(--ink); fill: none; stroke-width: 1.3; }
.mock .m-fig .sks { stroke: var(--pencil); fill: none; stroke-width: 1; }
.mock .m-fig .fr { fill: var(--red); }
.mock .m-fig .fp2 { fill: var(--paper-2); }
.mock .m-fig .fi { fill: var(--ink); }
.mock .m-fig .hx { stroke: var(--red); stroke-width: 1; opacity: 0.55; }
.mock .m-figcap { font-family: var(--prose); font-size: calc(var(--data-sz) + 0.5px); letter-spacing: 0.04em; color: var(--ink-faint); margin-top: 5px; }

/* schedule — tabular figures */
.mock .m-sched { width: 100%; border-collapse: collapse; font-family: var(--data); font-size: var(--data-sz); letter-spacing: 0.02em; font-variant-numeric: tabular-nums; }
.mock .m-sched caption { text-align: left; font-family: var(--data); font-size: calc(var(--data-sz) - 2px); letter-spacing: 0.18em; color: var(--ink-soft); text-transform: uppercase; padding: 0 0 5px; }
.mock .m-sched th { text-align: left; font-weight: 600; font-size: calc(var(--data-sz) - 2.5px); letter-spacing: 0.14em; color: var(--ink-faint); text-transform: uppercase; border-bottom: 1px solid var(--ink); padding: 0 6px 3px 0; }
.mock .m-sched td { padding: 3px 6px 3px 0; border-bottom: 1px solid var(--line); vertical-align: baseline; white-space: nowrap; }
.mock .m-sched td.num, .mock .m-sched th.num { text-align: right; }
.mock .m-sched td.id { font-family: var(--code); font-size: 0.9em; letter-spacing: 0; }
.mock .m-sched td.tier { color: var(--ink-soft); }
.mock .m-sched td.halt { color: var(--red); font-weight: 600; }
.mock .m-sched tr.total td { border-bottom: 0; border-top: 1px solid var(--ink); font-weight: 600; }

/* title block, with the square chop */
.mock .m-tb { margin-top: 14px; border: 1.5px solid var(--ink); display: grid; grid-template-columns: 1fr 1fr; font-family: var(--data); font-variant-numeric: tabular-nums; }
.mock .m-tb > div { padding: 5px 9px 6px; border-top: 1px solid var(--ink); font-size: var(--data-sz); letter-spacing: 0.04em; }
.mock .m-tb > div:nth-child(-n+2) { border-top: 0; }
.mock .m-tb > div:nth-child(2n) { border-left: 1px solid var(--ink); }
.mock .m-tb .span2 { grid-column: 1 / -1; border-left: 0 !important; }
.mock .m-tb .fld { display: block; font-family: var(--data); font-size: calc(var(--data-sz) - 3.5px); letter-spacing: 0.18em; color: var(--ink-soft); text-transform: uppercase; margin-bottom: 1px; }
.mock .m-tb .ttl { font-family: var(--title); font-weight: var(--title-wt); letter-spacing: calc(var(--title-ls) * 0.8); text-transform: uppercase; font-size: 13px; }
.mock .m-tb .sig { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
/* THE ONE HAND VALUE in the ledger */
.mock .m-tb .sig .hand { font-family: var(--hand); font-size: calc(var(--data-sz) + 1px); color: var(--pencil); letter-spacing: 0; }

/* the REV table — descriptions in the DATA face, never the hand */
.mock .m-rev { width: 100%; border-collapse: collapse; margin-top: 12px; font-family: var(--data); font-size: calc(var(--data-sz) - 0.5px); letter-spacing: 0.02em; font-variant-numeric: tabular-nums; }
.mock .m-rev caption { text-align: left; font-family: var(--data); font-size: calc(var(--data-sz) - 2px); letter-spacing: 0.18em; color: var(--ink-soft); text-transform: uppercase; padding: 0 0 5px; }
.mock .m-rev th { text-align: left; font-weight: 600; font-size: calc(var(--data-sz) - 2.5px); letter-spacing: 0.14em; color: var(--ink-faint); text-transform: uppercase; border-bottom: 1px solid var(--ink); padding: 0 8px 3px 0; }
.mock .m-rev td { padding: 4px 8px 4px 0; border-bottom: 1px solid var(--line); vertical-align: baseline; color: var(--ink-soft); line-height: 1.45; }
.mock .m-rev td.r { color: var(--ink); font-weight: 600; letter-spacing: 0.1em; white-space: nowrap; }
.mock .m-rev td.d { white-space: nowrap; }

/* the stamp: SQUARE and UNROTATED */
.mock .m-stamp { display: inline-block; margin-top: 12px; padding: 4px 9px; border: 1.5px solid var(--cherokee); color: var(--cherokee); font-family: var(--data); font-weight: 600; font-size: calc(var(--data-sz) - 1.5px); letter-spacing: 0.2em; text-transform: uppercase; font-variant-numeric: tabular-nums; }

.mock .m-notes { margin-top: 12px; max-width: 66ch; font-family: var(--prose); font-size: 14px; }
.mock .m-notes h4 { font-family: var(--data); font-size: calc(var(--data-sz) - 2px); letter-spacing: 0.18em; color: var(--ink-soft); text-transform: uppercase; margin-bottom: 4px; font-weight: 600; }
.mock .m-notes code { font-family: var(--code); font-size: 0.85em; background: var(--paper-2); border: 1px solid var(--line); padding: 0 4px; }

/* the cover card, once: index.html's .card rules, so the third THE is judged too */
.mock .m-cardwrap { margin-top: 14px; max-width: 300px; }
.mock .m-cardlbl { display: block; font-family: var(--data); font-size: calc(var(--data-sz) - 2px); letter-spacing: 0.18em; color: var(--ink-soft); text-transform: uppercase; margin-bottom: 6px; font-weight: 600; }
.mock .m-card { display: block; border: 1.5px solid var(--ink); background: var(--paper); padding: 14px 16px 15px; text-decoration: none; color: inherit; }
.mock .m-card .n { font-family: var(--data); font-size: 10px; letter-spacing: 0.14em; color: var(--accent); font-variant-numeric: tabular-nums; }
.mock .m-card h4 { font-family: var(--title); font-size: 15px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; margin: 5px 0 6px; }
.mock .m-card .alt { display: block; font-family: var(--data); font-size: 9px; letter-spacing: 0.14em; color: var(--ink-faint); text-transform: uppercase; margin-bottom: 6px; }
.mock .m-card p { font-family: var(--prose); font-size: 14px; color: var(--ink-soft); line-height: 1.45; margin: 0 0 6px; }
.mock .m-card .meta { font-family: var(--data); font-size: 9px; letter-spacing: 0.14em; color: var(--ink-faint); }

/* --- THE ARTICLE knob: the leading THE of every title ---------------------
   .art wraps the article wherever a title is drawn — rail entry, sheet head,
   title block, cover card — and .w is the word itself. The mock's root
   carries data-article / data-article-stack / data-article-rail and, for the
   catchword rows, --article-key (the ONE keyboard character HWT Catchwords maps
   the chosen THE to: the face has no GSUB, every catchword is keyed) and
   --article-scale (the size that lands its ink height on Exhibition's caps). */
/* SUP — the SHIPPED article: the word kept, drawn as a lowercase superior in
   the data face. No kit glyph is involved, so it draws the same everywhere;
   line-height 0 keeps it out of the title's line box. */
.mock[data-article="sup"] .art .w { font-family: var(--data); font-size: 0.6em; font-weight: 400; letter-spacing: 0; text-transform: lowercase; vertical-align: super; line-height: 0; color: var(--ink-soft); }
.mock[data-article="muted"] .art { color: var(--ink-soft); opacity: 0.55; }
/* cap-aligned: 0.7em caps sit 0.21 title-em lower, which is 0.3em of their own */
.mock[data-article="small"] .art { font-size: 0.7em; color: var(--ink-soft); vertical-align: 0.3em; }
.mock[data-article^="cw"] .art .w { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.mock[data-article^="cw"] .art::before { content: var(--article-key); font-family: "hwt-catchwords", var(--title); font-size: var(--article-scale, 1.075em); font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--ink-soft); margin-right: 0.22em; }
/* STACKED — the sheet head only: the catchword centred over the first word */
.mock[data-article^="cw"][data-article-stack="on"] .m-title .w1 { display: inline-block; position: relative; padding-top: calc(var(--article-scale, 1.075em) * 0.72); }
.mock[data-article^="cw"][data-article-stack="on"] .m-title .art { position: absolute; top: 0; left: 0; right: 0; text-align: center; line-height: 1; }
/* 0.65 of the inline size: the stacked word sits above the caps, so it can be smaller and still read */
.mock[data-article^="cw"][data-article-stack="on"] .m-title .art::before { font-size: calc(var(--article-scale, 1.075em) * 0.65); margin-right: 0; }
/* RAIL: OFF — the rail drops the article and keeps the title */
.mock[data-article-rail="off"] .m-rail .art { display: none; }
`;

/**
 * The mock sheet. Copy is sheet 7 rev E's own — real strings, so the pairings
 * are judged on the set's actual line lengths and figures.
 */
export const SPECIMEN_MOCK = `
<div class="shell">
  <nav class="m-rail" aria-label="mock drawing set">
    <div class="m-rail-head">
      <span class="kicker">Drawing set · lit-ui-router</span>
      <h3>The Altitude Atlas</h3>
      <div class="bands" aria-hidden="true"></div>
    </div>
    <p class="m-rail-sec">Sheets — ascent order</p>
    <a href="#" onclick="return false"><span class="n">3B</span><span class="t"><span class="art"><span class="w">The </span></span>Watched City</span></a>
    <a href="#" onclick="return false"><span class="n">4</span><span class="t"><span class="art"><span class="w">The </span></span>Family Spine</span></a>
    <a href="#" onclick="return false"><span class="n">5</span><span class="t"><span class="art"><span class="w">The </span></span>Design Space</span></a>
    <a href="#" onclick="return false"><span class="n">6</span><span class="t"><span class="art"><span class="w">The </span></span>Routing Strata</span></a>
    <a href="#" onclick="return false" class="is-active"><span class="n">7</span><span class="t"><span class="art"><span class="w">The </span></span>Measured City</span></a>
    <a href="#" onclick="return false"><span class="n">7A</span><span class="t"><span class="art"><span class="w">The </span></span>Shadow Survey</span></a>
    <a href="#" onclick="return false"><span class="n">7B</span><span class="t"><span class="art"><span class="w">The </span></span>Working City</span></a>
    <a href="#" onclick="return false"><span class="n">8</span><span class="t"><span class="art"><span class="w">The </span></span>Delivered City</span></a>
    <div class="foot"><span class="chop" aria-hidden="true"></span><span>Sheet 7 of 14 · rev E</span></div>
  </nav>
  <div class="m-body">
    <div class="m-crumb">
      <span>← Index</span>
      <span>Prev · 6</span>
      <span class="of">Sheet 7 of 14</span>
      <span>Next · 7A</span>
      <span>Standalone plate ↗</span>
      <span class="end">Plates read: census-city.json · see also 3</span>
    </div>
    <div class="m-head">
      <span class="proj">The Altitude Atlas — drawing set</span>
      <span class="shno">SHEET 7 / 14 · ALTITUDE 3½</span>
    </div>
    <h3 class="m-title"><span class="w1"><span class="art"><span class="w">The </span></span>Measured</span> City</h3>
    <p class="m-sub">Altitude 3½ — the same city as sheet 3, surveyed by mass · 32 members · 4 districts · counted at origin/main @ 185d414</p>
    <div class="m-plate">
      <div>
        <div class="m-fig">
          <svg viewBox="0 0 560 250" role="img" aria-label="a callout with a leader, an isometric block and a dimension string">
            <defs>
              <pattern id="sp-hx" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                <line x1="0" y1="0" x2="0" y2="6" class="hx"/>
              </pattern>
            </defs>
            <text x="14" y="22" class="lbla">lit-ui-router — THE PACKAGE THIS SET IS ABOUT</text>
            <text x="14" y="38" class="note">13 authored files · 1,383 sloc</text>
            <text x="14" y="58" class="note-hand">its annex is 2.9× the source</text>
            <g transform="translate(300,60)">
              <polygon points="0,60 60,30 120,60 60,90" class="fr"/>
              <polygon points="0,60 60,90 60,170 0,140" class="fp2 sk"/>
              <polygon points="60,90 120,60 120,140 60,170" class="fp2 sk"/>
              <polygon points="0,60 60,30 120,60 60,90" class="sk"/>
              <polygon points="130,120 170,100 210,120 170,140" fill="url(#sp-hx)" class="sk"/>
              <polygon points="130,120 170,140 170,160 130,140" class="fp2 sk"/>
              <polygon points="170,140 210,120 210,140 170,160" class="fp2 sk"/>
            </g>
            <path d="M 236 40 L 290 40 L 340 92" class="sks"/>
            <circle cx="340" cy="92" r="2.2" class="fi"/>
            <path d="M 300 246 L 420 246 M 300 240 L 300 250 M 420 240 L 420 250" class="sks"/>
            <text x="360" y="238" text-anchor="middle" class="dim">√sloc × 1.6 = 60 px</text>
            <text x="14" y="120" class="lbls">GATE SEVERITY — READ THE COLOUR, NOT THE HEIGHT</text>
            <rect x="14" y="130" width="22" height="10" class="fr"/><text x="42" y="139" class="lbls">halts a publish — 12</text>
            <rect x="14" y="146" width="22" height="10" fill="url(#sp-hx)" stroke="var(--red)"/><text x="42" y="155" class="lbls">stops the PR line — 9 · 14 · 19 · 23 · 26 · 28</text>
            <text x="14" y="190" class="note">annex — hatched, massed from spec files</text>
            <text x="14" y="208" class="note">no road is drawn that the repo does not carry</text>
            <path d="M 232 186 L 300 186 L 300 236 L 428 236 L 440 218" class="sks"/>
          </svg>
        </div>
        <p class="m-figcap">FIG. 7·1 — the package block, its hatched annex, and the massing rule that sizes both</p>
        <div class="m-notes">
          <h4>General notes</h4>
          <p><strong>Numbers by import, not by paste.</strong> Every count above and on the drawing is read from <code>www/atlas.lit-ui-router.dev/data/census-city.json</code>, the snapshot <code>census-city.mjs</code> writes out of the master per-file census; this file holds placement, tiers and prose only.</p>
        </div>
        <div class="m-cardwrap">
          <span class="m-cardlbl">Cover card — the same title, a third time</span>
          <a class="m-card" href="#" onclick="return false">
            <span class="n">SHEET 7 · REV F</span>
            <h4><span class="art"><span class="w">The </span></span>Measured City</h4>
            <span class="alt">WHOLE WORKSPACE</span>
            <p>The same city as sheet 3, surveyed by mass — 32 members, 4 districts, the annex hatched.</p>
            <span class="meta">MEASURED CITY · 1 PLATE</span>
          </a>
        </div>
      </div>
      <div>
        <table class="m-sched">
          <caption>Structure schedule — authored source per member</caption>
          <thead><tr><th class="num">№</th><th>Member</th><th class="num">Files</th><th class="num">Sloc</th><th class="num">Annex</th><th>Gate</th></tr></thead>
          <tbody>
            <tr><td class="num">1</td><td class="id">lit-ui-router</td><td class="num">13</td><td class="num">1,383</td><td class="num">4,068</td><td class="tier">line</td></tr>
            <tr><td class="num">5</td><td class="id">sample-app-shared</td><td class="num">37</td><td class="num">2,211</td><td class="num">—</td><td class="tier">line</td></tr>
            <tr><td class="num">11</td><td class="id">examples</td><td class="num">26</td><td class="num">2,404</td><td class="num">—</td><td class="tier">line</td></tr>
            <tr><td class="num">12</td><td class="id">@tools/release</td><td class="num">46</td><td class="num">2,140</td><td class="num">—</td><td class="halt">halt</td></tr>
            <tr><td class="num">30</td><td class="id">@tools/eslint-ts-parser</td><td class="num">1</td><td class="num">1</td><td class="num">—</td><td class="tier">report</td></tr>
            <tr><td class="num">32</td><td class="id">@tools/embed-heights</td><td class="num">4</td><td class="num">96</td><td class="num">—</td><td class="tier">report</td></tr>
            <tr class="total"><td></td><td>32 members</td><td class="num">221</td><td class="num">16,520</td><td class="num">14,105</td><td></td></tr>
          </tbody>
        </table>
        <div class="m-tb" aria-label="title block">
          <div class="span2"><span class="fld">Project</span><span class="ttl">The Altitude Atlas</span></div>
          <div class="span2"><span class="fld">Sheet title</span><span class="ttl"><span class="art"><span class="w">THE </span></span>MEASURED CITY</span></div>
          <div><span class="fld">Scale</span>WHOLE WORKSPACE</div>
          <div><span class="fld">Form</span>MEASURED CITY</div>
          <div><span class="fld">Basis</span>origin/main @ 185d414</div>
          <div><span class="fld">Date / rev</span>2026-09-04 · E</div>
          <div class="sig"><span><span class="fld">Drawn by</span><span class="hand">Fable (Claude, AI)</span></span></div>
          <div class="sig"><span><span class="fld">Sheet</span>7 OF 14</span><span class="chop" aria-hidden="true"></span></div>
        </div>
        <table class="m-rev">
          <caption>Revisions</caption>
          <thead><tr><th>Rev</th><th>Date</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td class="r">E</td><td class="d">2026-09-04</td><td>cabinet refresh after the 1.11.2 + mobx 1.0.0 releases — №32 @tools/embed-heights massed on the yard's middle row</td></tr>
            <tr><td class="r">D</td><td class="d">2026-08-31</td><td>recount: three new instruments massed, every sloc rebased on scc 4.0.0's Code count; the ruler moved about +0.9%</td></tr>
            <tr><td class="r">C</td><td class="d">2026-08-24</td><td>annex split out of the block and hatched; gate severity moved from height to colour</td></tr>
          </tbody>
        </table>
        <span class="m-stamp">Counted · 185d414</span>
      </div>
    </div>
  </div>
</div>
`;
