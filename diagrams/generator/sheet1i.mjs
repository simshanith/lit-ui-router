// SHEET 1i — THE RENDER LOOP, WALKED: sheet 1's circuit with a pointer in it.
//
// Every figure on this page is imported from diagrams/data/census-loop.json,
// the plate generator/census-loop.mjs reads off the archive — this file holds
// the frame, the prose and the title block; generator/loop-walk.mjs holds the
// lane and its layout.
import { readFileSync } from 'node:fs';
import { PROJECT, TOTAL, articleTitle, titleBlock } from './chrome.mjs';
import { esc, keyRow } from './helpers.mjs';
import { LOOP as R, loopWalkLane } from './loop-walk.mjs';

const PLATE = JSON.parse(readFileSync(new URL('../data/census-loop.json', import.meta.url), 'utf8'));
const BASIS = `surveyed at ${PLATE.ref} @ ${PLATE.sha} (commit ${PLATE.commitDate.slice(0, 10)})`;
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = (n) => WORD[n] ?? String(n);
const K = R.byKind;
const WALK_OF = esc(R.walkOf);
const OVERLAYS = R.overlays.map(esc);

const KEY = [
  keyRow('<rect x="10" y="2" width="28" height="14" fill="none" stroke="var(--ink)" stroke-width="1.6"/>'
    + '<rect x="20" y="9" width="8" height="7" fill="var(--accent)" stroke="var(--ink)" stroke-width="1"/>',
    `a station on the route — ${R.onRing} of ${R.stations}`),
  keyRow('<line x1="12" y1="16" x2="14" y2="6" stroke="var(--ink)" stroke-width="1.4"/><line x1="36" y1="16" x2="34" y2="6" stroke="var(--ink)" stroke-width="1.4"/>'
    + '<rect x="11" y="2" width="26" height="5" fill="none" stroke="var(--ink)" stroke-width="1.4"/>',
    `an overlay inside the ring — ${OVERLAYS.join(', ')}`),
  keyRow('<line x1="4" y1="9" x2="44" y2="9" stroke="var(--ink)" stroke-width="2"/>',
    `a loop leg — ${K.loop} of ${R.legs}; ink once walked, faint before`),
  keyRow('<line x1="4" y1="9" x2="44" y2="9" stroke="var(--accent)" stroke-width="3"/>',
    'the leg lit by the current step'),
  keyRow('<line x1="4" y1="9" x2="44" y2="9" stroke="var(--ink-soft)" stroke-width="1.2" stroke-dasharray="4 3"/>',
    `an event rising or a hook tap — ${K.event} events, ${K.tap} taps`),
].join('\n');

const NOTES = `
<p><strong>Method — what is drawn, and from where.</strong> Everything on this page comes out of
<code>diagrams/data/census-loop.json</code>, the checked-in plate <code>generator/census-loop.mjs</code> reads off
a materialized archive of the ref — ${BASIS}. It is a T1 tree probe: nothing runs, ${word(R.files)} files under
<code>packages/lit-ui-router/src/</code> are read line by line. The plate carries the ${R.stations} stations of
sheet 1 (each anchored to the line where lit-ui-router implements it), the ${R.legs} legs between them (each with the
call or event that carries it), and the walk — ${R.steps} steps, ${R.evidence} evidence lines in all. Every
evidence entry is filed as <code>file:line</code> plus the verbatim source at that line, and the probe
<em>throws</em> if the line it was told to cite no longer reads what it expected: a refactor that moves a hook
breaks this plate rather than letting it narrate stale code. The lane cross-checks the plate at build time and
throws again if the walk names a leg that is not on it, a leg joins a station that is not on it, or the tallies
disagree with the lists.</p>
<p><strong>The walk, defined.</strong> One navigation: ${WALK_OF}. The steps are ordered by the source, not by
memory — the click handler's own guards and its <code>$state.go</code>, then core's sequence stated only through
the hooks lit-ui-router registers in it: <code>&lt;ui-view&gt;</code>'s <code>onBefore</code> (uiCanExit) and
<code>onSuccess</code> (uiOnParamsChanged), <code>uiSrefActive</code>'s <code>onStart</code> tap and its
<code>trans.promise</code>, <code>TransitionController</code>'s default <code>['onSuccess']</code>. No line of
<code>@uirouter/core</code> is cited, so where the machine itself moves — matching, resolving, writing the url —
the step says so and cites the wire lit-ui-router owns at that point. Step ${R.clickStep} is the click; step 1 is
the circuit at rest, because before any click the stations have already found each other by composed DOM
events, and that wiring is the only reason the click has anywhere to go.</p>
<p><strong>Layout — sheet 1's ring, computed at build time.</strong> The stations stand in sheet 1's own order
around a ring: location, core, the transition hall, the view with its child below it, Lit render, the document
with the link on it. The ${word(R.overlays.length)} stations sheet 1 draws elevated — ${OVERLAYS.join(' and ')}
— stand <em>inside</em> the ring here, because they are not on the route: sheet 1's key says "elevated = overlay",
and inside is the flat drawing's word for the same thing. Positions are computed here and drawn with cytoscape
<code>preset</code>: no physics, so a station is always in the same place when you come back to it. Loop legs
run straight; the legs that would otherwise be read as passing through a building bow clear of it.</p>
<p><strong>Sprites.</strong> ${word(R.stations).replace(/^./, (c) => c.toUpperCase())} skins, one per station,
authored to the house recipe — the girding frame drawn first and a semi-opaque wall washed over it, so the frame
reads through and the themed node body tints the building. The document keeps sheet 1's one metaphor break: it is
the only station that is not a building but a window with its DOM rising in plates, and the link is that topmost
plate alone. Both palettes are baked at build time and swapped with the page's theme, the register's pattern
exactly.</p>
<p><strong>What this shows that sheet 1 cannot.</strong> Sheet 1 proves the loop is a circuit; here it has an
order. The hall is tapped ${word(K.tap)} times by the overlays and
those taps fire at different bays — the perch hears <code>onStart</code> before any view has changed, the view
hears <code>onSuccess</code> after every view has — which is why <code>.active</code> can flip before the page
does. The two overlays never light a loop leg at all, in ${R.steps} steps. And the last step is honest about the
one leg this package does not own: core writes the url; lit-ui-router's part of that wire is the
<code>listen()</code> that carries the next back-button press in.</p>
<p><strong>What is editorial.</strong> The ring and where the overlays stand; the sprite drawings and the colours;
the narration sentences and this prose. The stations, the legs, the order of the steps, every line number, every
excerpt and every count are the plate's.</p>`;

export const sheet1i = {
  num: '1i',
  id: 'loop-walked',
  rev: 'A',
  title: 'THE RENDER LOOP, WALKED',
  scale: 'ONE PACKAGE',
  form: 'INTERACTIVE CIRCUIT',
  sub: `ALTITUDE 1 — sheet 1's circuit, stepped · one navigation walked leg by leg · ${R.stations} STATIONS · ${R.legs} LEGS · ${R.steps} STEPS · ${BASIS}`,
  caption: `The circuit, stood up and stepped. ${R.stations} stations and ${R.legs} legs, then one click — ${WALK_OF} — walked in ${R.steps} steps under the pointer, every step standing on the ${R.evidence} source lines the plate cites verbatim.`,
  notes: NOTES,
  key: KEY,
};

export function loopWalkedSection() {
  return `<section class="sheet lw" id="sheet-${sheet1i.num}" aria-label="Sheet ${sheet1i.num}: ${sheet1i.title}">
  <div class="sheet-head"><span class="proj">${PROJECT} — INTERACTIVE PLATE</span><span class="shno">SHEET ${sheet1i.num} / ${TOTAL}</span></div>
  <h2 class="sheet-title">${articleTitle(sheet1i.title)}</h2>
  <p class="sheet-sub">${sheet1i.sub}</p>
  ${loopWalkLane()}
  <figure><figcaption>${sheet1i.caption}</figcaption></figure>
  <div class="notes-grid">
    <div class="notes">
      <h3>GENERAL NOTES</h3>
      ${sheet1i.notes}
    </div>
    <div class="keyblock">
      <h3>KEY</h3>
      <table>${sheet1i.key}</table>
      ${titleBlock(sheet1i)}
    </div>
  </div>
</section>`;
}
