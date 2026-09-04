import { defs } from './chrome.mjs';
import { txt, lines, box, arrow, keyRow } from './helpers.mjs';
import { ATLAS } from './census-atlas.mjs';

const P = 's14';

// ---------------------------------------------------------------------------
// DATA — nothing on this plate is hand-listed.  census-atlas.mjs introspects
// diagrams/generator/ and diagrams/data/ at build time: probes are the
// census-*.mjs files that WRITE a plate, tiers come from which basis.mjs
// primitive each one calls, and readers come from every data-plate URL the
// generator constructs.  It throws if a plate has anything other than exactly
// one writer, if a probe writes a plate that is not filed, if a drawing reads
// a plate that is not filed, or if the cabinet's plates disagree about the ref
// they were measured at.  This file holds placement, the short basis labels,
// and prose only.
// ---------------------------------------------------------------------------
const A = ATLAS;
const S = A.stats;
const MASTER = A.rows.find((r) => r.file === A.master);
const REST = A.rows.filter((r) => r.file !== A.master);
const MASTER_QUERIES = MASTER.queriedBy;
const COVER = A.drawings.find((d) => d.num === null);
const SHEETS = A.drawings.filter((d) => d.num !== null);
const OVERVIEW = A.queries[0];

// short drawing labels for the introspected basis strings; an unknown basis is
// a new kind of station and must be given a label, not silently drawn blank
const BASIS_SHORT = new Map([
  ['archive', 'archive + scc'],
  ['master plate', 'query · master plate'],
  ['master plate + git log', 'plate + git log'],
  ['installed archive', 'installed archive'],
  ['live registry', 'live registry'],
]);
for (const r of A.rows) {
  if (!BASIS_SHORT.has(r.basis)) throw new Error(`sheet 14: basis "${r.basis}" (${r.writer}) has no short label`);
}

const fmt = (v) => v.toLocaleString('en-US');
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen'];
const BASIS = `${A.ref} @ ${A.sha} · commit ${A.commitDate}`;

// ---------------------------------------------------------------------------
// GEOMETRY — four columns, left to right: the basis, the stations by tier,
// the plate cabinet, the sheet rack.  Station row i and drawer row i are the
// same probe, so every «writes» edge is horizontal and none of them cross.
// ---------------------------------------------------------------------------
const SX = 66, SW = 310;              // station column
const DX = 440, DW = 230;             // drawer (cabinet) column
const RX = 860, RW = 280;             // sheet rack column
const RH = 22;                        // row box height
const MY = 214;                       // the master row (archive → scc → master plate → cover)
const BUSX = 52, BUSY = 246;          // the master-plate bus, down the left margin
const RAILX = 38;                     // the one-basis rail

// tier bands: head label, then rows on a 30px pitch
const BANDS = [
  ['T1', 'T1 · PURE TREE — the archive measured once, or a query over the master plate'],
  ['T2', 'T2 · HISTORY — one git log over the same ref (historyLog); no working tree, no hard-coded today'],
  ['T3', 'T3 · EXECUTION — the ref materialized AND installed; the tree measures itself'],
];
const ROWY = new Map();
const HEADY = new Map();
{
  let y = 272;
  for (const [tier] of BANDS) {
    HEADY.set(tier, y - 14);
    if (tier === 'T3') y += 58;                     // room for the install-harness bar
    for (const r of REST.filter((x) => x.tier === tier)) { ROWY.set(r.file, y); y += 30; }
    y += 18;                                        // air between bands
  }
}
const LASTROW = Math.max(...ROWY.values());
const OVY = LASTROW + 44;                           // the query station that files nothing
const RELICY = OVY + 32;                            // the old regime's last instrument
const TABY = (i) => 272 + i * 36;                   // rack pitch, independent of the cabinet

// ---------------------------------------------------------------------------
// THE BASIS BLOCK + THE MASTER ROW
// ---------------------------------------------------------------------------
const basisBlock = `${box(SX, 96, SW, 84, 'sk fp2')}
${txt(SX + 10, 116, 'THE ONE BASIS', 'lblb')}
${lines(SX + 10, 132, [
  'materialize(ref) — basis.mjs',
  `git archive ${A.ref} @ ${A.sha}`,
  '| tar -x → tmpdir, relative walk',
  `${fmt(A.tracked)} tracked paths · ${A.commitDate}`,
], 'lbls', 'start', 13)}`;

const rail = `<path d="M${SX + 4},180 L${RAILX},180 L${RAILX},${RELICY + 6}" class="sks" stroke-dasharray="4 4" opacity="0.65" fill="none"/>
${txt(RAILX - 6, (180 + RELICY) / 2, 'ONE BASIS — EVERY STATION RE-MATERIALIZES THIS REF', 'lblf', 'middle', `transform="rotate(-90 ${RAILX - 6} ${(180 + RELICY) / 2})"`)}`;

const masterRow = `${arrow(P, `M${SX + 120},180 L${SX + 120},${MY - 11}`)}
${box(SX, MY - 11, SW, RH, 'ska fp')}
${txt(SX + 10, MY + 4, MASTER.writer, 'lbla')}
${txt(SX + SW - 10, MY + 4, 'scc --by-file', 'lblf', 'end')}
${arrow(P, `M${SX + SW},${MY} L${DX - 4},${MY}`, 'aa', 'ska')}
<rect x="${DX}" y="${MY - 15}" width="${DW}" height="30" rx="4" class="ska" fill="url(#${P}-ha)"/>
${txt(DX + 10, MY - 2, A.master, 'lbla')}
${txt(DX + 10, MY + 10, `${fmt(A.masterRows)} rows — the one measurement`, 'lblf')}
${arrow(P, `M${DX + DW},${MY} L${RX - 4},${MY}`, 'aa', 'ska')}
${box(RX, MY - 11, RW, RH, 'ska fp')}
${txt(RX + 10, MY + 4, 'build.mjs — GALLERY COVER SURVEY', 'lbla')}
${txt(RX + RW - 10, MY + 4, `×${COVER.reads.length}`, 'lblf', 'end')}`;

// the hero: the master plate read back by every station that is a view of it
const stationY = (probeFile) => (probeFile === OVERVIEW.file ? OVY : ROWY.get(REST.find((r) => r.writer === probeFile).file));
const busStops = MASTER_QUERIES.map(stationY).sort((a, b) => a - b);
const BUSEND = busStops[busStops.length - 1];
const bus = `<path d="M${DX + 20},${MY + 15} L${DX + 20},${BUSY} L${BUSX},${BUSY} L${BUSX},${BUSEND}" class="ska" fill="none"/>
${busStops.map((y) => arrow(P, `M${BUSX},${y} L${SX - 4},${y}`, 'aa', 'ska')).join('\n')}
${txt(SX + 40, BUSY - 10, `reads — ${WORD[MASTER_QUERIES.length + 1]} consumers query the one measurement`, 'lbla')}`;

// ---------------------------------------------------------------------------
// STATIONS + DRAWERS
// ---------------------------------------------------------------------------
const bandHeads = BANDS.map(([tier, label]) => txt(SX, HEADY.get(tier), label, 'lblf')).join('\n');

const HARNESS_Y = HEADY.get('T3') + 16;
const harness = `${box(SX + 18, HARNESS_Y, SW - 18, 32, 'sk fp2')}
${txt(SX + 28, HARNESS_Y + 14, 'installDeps(basis) — THE INSTALL HARNESS', 'lbls')}
${txt(SX + 28, HARNESS_Y + 26, 'corepack pnpm --frozen-lockfile → .bin/turbo', 'lblf')}
<path d="M${SX + 26},${HARNESS_Y + 32} L${SX + 26},${ROWY.get(REST.filter((r) => r.tier === 'T3')[0].file) - 11}" class="sks" stroke-dasharray="3 3" fill="none"/>`;

const stations = REST.map((r) => {
  const y = ROWY.get(r.file);
  return `${box(SX, y - 11, SW, RH)}
${box(SX, y - 11, 30, RH, 'sk fp2')}
${txt(SX + 15, y + 4, r.tier, 'lbls', 'middle')}
${txt(SX + 40, y + 4, r.writer, 'lbl')}
${txt(SX + SW - 8, y + 4, BASIS_SHORT.get(r.basis), 'lblf', 'end')}
${arrow(P, `M${SX + SW},${y} L${DX - 4},${y}`)}
${box(DX, y - 11, DW, RH, 'sk fp', 4)}
${txt(DX + 10, y + 4, r.file, 'lbl')}
${txt(DX + DW - 10, y + 4, `×${r.readers.length}`, 'lblf', 'end')}`;
}).join('\n');

// the two stations that file nothing at all
const OUT = `${box(SX, OVY - 11, SW, RH, 'sks fp2')}
${txt(SX + 10, OVY + 4, OVERVIEW.file, 'lbls')}
${txt(SX + SW - 8, OVY + 4, 'query · files nothing', 'lblf', 'end')}
${A.unwired.map((f, i) => `${box(SX, RELICY - 11 + i * 30, SW, RH, 'sks fnone')}
${txt(SX + 10, RELICY + 4 + i * 30, f, 'lblf')}
${txt(SX + SW - 8, RELICY + 4 + i * 30, 'imported by nothing', 'lblf', 'end')}
<line x1="${SX + 4}" y1="${RELICY - 11 + i * 30}" x2="${SX + SW - 4}" y2="${RELICY + 11 + i * 30}" class="skr" opacity="0.8"/>`).join('\n')}`;

// ---------------------------------------------------------------------------
// THE SHEET RACK + THE READ EDGES
// ---------------------------------------------------------------------------
const TABI = new Map(SHEETS.map((d, i) => [d.file, i]));
const rack = SHEETS.map((d, i) => {
  const y = TABY(i);
  return `${box(RX, y - 11, RW, RH, 'sk fp')}
${box(RX, y - 11, 40, RH, 'sk fp2')}
${txt(RX + 20, y + 4, `S${d.num}`, 'lbls', 'middle')}
${txt(RX + 50, y + 4, d.title, 'lbl')}
${txt(RX + RW - 10, y + 4, `×${d.reads.length}`, 'lblf', 'end')}`;
}).join('\n');

// one thin curve per (plate, drawing) pair; the schedule below carries the truth
const readEdges = A.plates.flatMap((p) => p.readers
  .filter((d) => TABI.has(d.file))
  .map((d) => {
    const y0 = ROWY.get(p.file) ?? MY;
    const y1 = TABY(TABI.get(d.file));
    return { span: Math.abs(y1 - y0), d: `M${DX + DW},${y0} C${DX + DW + 90},${y0} ${RX - 90},${y1} ${RX - 4},${y1}` };
  }))
  .sort((a, b) => b.span - a.span)
  .map((e) => `<path d="${e.d}" class="sks" opacity="0.5" fill="none" marker-end="url(#${P}-as)"/>`)
  .join('\n');

const readsN = A.plates.reduce((s, p) => s + p.readers.filter((d) => TABI.has(d.file)).length, 0);
const readLabel = `${txt((DX + DW + RX) / 2, 262, `reads — ${readsN} imports`, 'lblf', 'middle')}`;

// ---------------------------------------------------------------------------
// THE EXTERNAL INSTRUMENT LEDGER (from the plates' own PROV-O fields)
// ---------------------------------------------------------------------------
const TLY = TABY(SHEETS.length - 1) + 26;
const toolHalf = Math.ceil(A.tools.length / 2);
const toolsBox = `${box(RX, TLY, RW, 40 + toolHalf * 14, 'sk fnone')}
${txt(RX + 10, TLY + 18, `EXTERNAL INSTRUMENTS — ${A.tools.length}`, 'lbls')}
${txt(RX + 10, TLY + 30, 'from each plate’s wasAssociatedWith', 'lblf')}
${A.tools.map((t, i) => txt(RX + 10 + (i < toolHalf ? 0 : 140), TLY + 46 + (i % toolHalf) * 14, t.label.length > 21 ? `${t.label.slice(0, 20)}…` : t.label, 'lblf')).join('\n')}`;

// ---------------------------------------------------------------------------
// THE SCHEDULE — plate | tier | writer | basis | readers
// ---------------------------------------------------------------------------
const SY = RELICY + 70;
const SCOL = [46, 250, 292, 430, 590];
const SH = 60 + A.plates.length * 17 + 46;
const schedule = `${box(30, SY, 1100, SH, 'sk fnone')}
${txt(46, SY + 22, 'PLATE SCHEDULE — EVERY FILED PLATE, ITS ONE WRITER, AND EVERY DRAWING THAT READS IT', 'lbls')}
<line x1="30" y1="${SY + 32}" x2="1130" y2="${SY + 32}" class="sks" opacity="0.7"/>
${['PLATE', 'TIER', 'WRITER', 'BASIS', 'READ BY'].map((h, i) => txt(SCOL[i], SY + 48, h, 'lblf')).join('\n')}
${A.rows.map((r, i) => {
    const y = SY + 68 + i * 17;
    const readers = [...r.readers.map((d) => (d.num === null ? 'gallery cover' : `sheet ${d.num}`)),
      ...r.queriedBy.map((f) => f.replace('census-', '').replace('.mjs', ''))].join(', ')
      || 'filed, awaiting a drawing';
    return [r.file, r.tier, r.writer, r.basis, readers]
      .map((v, k) => txt(SCOL[k], y, v, k === 0 && r.file === A.master ? 'lbla' : k < 3 ? 'lbls' : 'lblf')).join('');
  }).join('\n')}
${txt(46, SY + SH - 18, `TOTALS — ${S.plates} plates · ${S.probes} probes (T1 ${S.byTier.T1} · T2 ${S.byTier.T2} · T3 ${S.byTier.T3}) · ${S.writes} writes · ${S.reads} reads · ${A.unread.length} plates unread · every plate pinned to ${BASIS} · graph: ${S.nodes} nodes / ${S.edges} edges`, 'lblf')}`;

const H = SY + SH + 30;

const ARIA = `The census pipeline drawn as a left-to-right flow of dataflow, not containment. `
  + `At far left one basis station: git archive ${A.ref} at ${A.sha} extracted to a temporary directory, ${fmt(A.tracked)} tracked paths, `
  + `with a dashed rail down the margin marking that every station re-materializes this same ref. `
  + `Next to it the master station ${MASTER.writer} runs one scc pass and files ${A.master}, ${fmt(A.masterRows)} rows — the one measurement. `
  + `An accent bus carries that plate back down the left margin into ${WORD[MASTER_QUERIES.length]} stations that are group-by queries over it, and straight right into the gallery cover: `
  + `the fan-out is the hero of the drawing. Below, ${S.probes - 1} further probe stations are grouped into three tiers — `
  + `${S.byTier.T1} pure-tree, ${S.byTier.T2} history, ${S.byTier.T3} execution, the last fed by an install harness running corepack pnpm with a frozen lockfile and the tree's own turbo binary. `
  + `Each station writes exactly one drawer of the plate cabinet in the middle column, so every writes edge is horizontal and none of them cross. `
  + `From the cabinet, ${readsN} thin read curves fan into a rack of ${SHEETS.length} numbered atlas sheets at the right. `
  + `Two stations file nothing: the overview query, which only prints, and ${A.unwired.join(', ')}, drawn struck through — a working-tree walker imported by nothing, the old regime's last instrument. `
  + `A plate schedule below lists all ${A.plates.length} plates with writer, tier, basis and readers.`;

const svg = `<svg viewBox="0 20 1160 ${H - 20}" role="img" aria-label="${ARIA}">
${defs(P)}

${txt(30, 46, 'THE SURVEY OFFICE — THE PIPELINE THAT DRAWS THIS ATLAS', 'lblt')}
${txt(30, 62, `one archive · ${S.probes} probe stations · ${S.plates} filed plates · ${S.drawings} drawings that read them — introspected from diagrams/generator/ at build time`, 'lbls')}
${txt(1130, 46, `${S.nodes} NODES · ${S.edges} EDGES`, 'lblb', 'end')}
${txt(1130, 62, `${S.writes} WRITES · ${S.reads} READS · ${S.imports} IMPORTS`, 'lbls', 'end')}

${rail}
${basisBlock}
${masterRow}
${bus}
${bandHeads}
${harness}
${stations}
${OUT}
${readEdges}
${readLabel}
${rack}
${toolsBox}

${schedule}
</svg>`;

export const sheet14 = {
  num: 14, id: 'pipeline', rev: 'A',
  title: 'THE SURVEY OFFICE',
  sub: `ALTITUDE 3½ — the atlas measuring itself · ${S.probes} probes, ${S.plates} plates, ${S.drawings} drawings · every station, plate and edge on this sheet introspected from diagrams/generator/ at build time · all plates pinned to ${BASIS} · REV A ${A.commitDate}: first printing — the instrument drawn by itself`,
  scale: 'THE CENSUS PIPELINE',
  form: 'FLOW GRAPH',
  svg,
  caption: `The instrument drawn by its own instrument: ${S.probes} probe stations over three tiers write ${S.plates} filed plates, which ${S.drawings} drawings read — and the one that matters most is read ${WORD[MASTER_QUERIES.length + 1]} times over. Nothing here is hand-listed: the stations are the generator files that write a plate, the tiers are the basis primitive each one calls, and the edges are the plate URLs the sheets construct.`,
  notes: `
<p><strong>Method — the sheet surveys its own drawer.</strong> Every station, drawer, tab and edge on this plate is introspected at build time by <code>diagrams/generator/census-atlas.mjs</code>: a probe is any <code>census-*.mjs</code> that <em>writes</em> a plate; a shared instrument is one the probes <em>import</em> (there are ${WORD[S.instruments]} — <code>basis.mjs</code> and <code>census-query.mjs</code>); a tier is decided by which basis primitive the source actually calls — <code>materialize</code> alone is T1, <code>historyLog</code> is T2, <code>installDeps</code> is T3; and a reader is any generator file that constructs the plate's URL. The introspection <em>throws</em> rather than draws if a plate has anything but exactly one writer, if a probe names a plate that is not filed, if a drawing reads a plate nothing writes, or — the claim this sheet makes loudest — if the ${S.plates} filed plates disagree about the ref they were measured at. They do not: all ${S.plates} are pinned to ${BASIS}. What is editorial here is what is editorial on every sheet: placement, the short basis labels, and this prose.</p>
<p><strong>The hero is the fan-out.</strong> One <code>scc --by-file</code> pass over the archive produces <code>${A.master}</code>, ${fmt(A.masterRows)} rows of per-file measurement, and ${WORD[MASTER_QUERIES.length + 1]} things read it: ${WORD[MASTER_QUERIES.length]} stations that are group-by queries over the same rows — ${MASTER_QUERIES.map((f) => `<code>${f}</code>`).join(', ')} — plus the gallery cover. That is the architecture's whole argument in one edge bundle: the city census, the yard census, the brick census, the weather map and the steam channel cannot disagree about how many files there are, because there is only one count. Cross-sheet totals reconcile by construction, not by discipline.</p>
<p><strong>Three tiers, and what each one costs.</strong> ${WORD[S.byTier.T1]} stations are T1 — the archive measured once, or a query over that measurement. ${WORD[S.byTier.T2]} are T2: one <code>git log</code> over the same ref, with the window and «today» derived from the ref's own commit date. ${WORD[S.byTier.T3]} are T3, and they are the expensive half of the office: the archive is not just extracted but <em>installed</em> — <code>corepack pnpm install --frozen-lockfile</code>, then the tree's own <code>node_modules/.bin/turbo</code> invoked directly — so that turbo dry-runs, node_modules closures, vite and rolldown builds all measure the ref rather than a checkout. The harness bar above the T3 band is the only sub-instrument drawn, because it is the only one that changes what a measurement <em>means</em>.</p>
<p><strong>Five faults of the old regime, and the answer to each.</strong> Before this pipeline: (1) the basis was whatever was checked out, with hand-rolled skip lists per probe — answered by one <code>git archive</code> per ref, the tracked set exactly as git defines it; (2) member lists were frozen 30-entry arrays that predated a package's graduation, with <code>existsSync</code> guards that let a missing directory count as zero — answered by discovering members from the archive's own workspace file; (3) numbers travelled by clipboard, printed by a probe and pasted into a sheet — answered by filed plates and lookups that throw on a missing row; (4) time was hard-coded, so re-running today still aged files against last August — answered by deriving every date from the measured commit; (5) inputs came from out of band — a dead scratch clone, vanished <code>tmp/</code> generators, npm dates typed by hand — answered by ${WORD[S.byTier.T3]} scripted execution probes and a registry probe. The one relic still in the drawer is drawn struck through: <code>${A.unwired.join(', ')}</code>, a working-tree walker imported by nothing and writing no plate.</p>
<p><strong>What the drawing does not show, and the schedule does.</strong> With ${S.plates} drawers and ${SHEETS.length} reading sheets, a complete edge render would be unreadable, so the drawing keeps the shape — one horizontal <em>writes</em> edge per station, a bundled accent bus for the master plate, thin curves for the rest — and the plate schedule carries the facts: writer, tier, basis and every reader, for all ${S.plates} plates. Two counts are worth reading off it. Zero plates are unread: every filed measurement is on a drawing somewhere, which was not true of this pipeline a week ago. And ${WORD[S.unplated]} of the atlas's ${S.sheetFiles} sheets still have no plate behind them — ${A.unplated.map((n) => `sheet ${n}`).join(', ')} — because they draw arguments, mechanisms and metering that no census produces. This sheet is honestly among them: it has no plate of its own; it reads the generator.</p>
<p><strong>Why a flow graph and not a city.</strong> Sheet 3 refuses to draw a task manager as a place, and the same refusal applies here. A pipeline's truth is dataflow — ref to archive to measurement to plate to drawing — and the lego/containment vocabulary the atlas uses elsewhere would encode a claim about <em>what contains what</em>, which is exactly the wrong claim about a pipeline. The vocabulary that fits is the one the atlas already owns: probes as survey instruments, snapshots as filed plates, sheets as finished drawings. Tier is station type; the cabinet is a cabinet; the rack is a rack. The node and edge arrays behind this drawing (${S.nodes} nodes over ${WORD[Object.keys(S.byKind).length]} kinds, ${S.edges} edges over writes, reads and imports) are also the data model the interactive lane will mount — the picture is a query, not a hand-drawing.</p>`,
  key: [
    keyRow('<rect x="4" y="3" width="10" height="12" class="sk fp2"/><rect x="14" y="3" width="30" height="12" class="sk fp"/>', 'probe station — tier tag, then the source file that writes one plate'),
    keyRow('<rect x="4" y="3" width="40" height="12" class="ska fp"/>', 'the master station and the master plate — one measurement, many views'),
    keyRow('<rect x="4" y="3" width="40" height="12" class="sk fp" rx="4"/>', 'a filed plate — one drawer of diagrams/data/'),
    keyRow('<rect x="4" y="3" width="10" height="12" class="sk fp2"/><rect x="14" y="3" width="30" height="12" class="sk fp"/><line x1="4" y1="15" x2="44" y2="15" class="sk"/>', 'sheet rack — a numbered atlas drawing that reads a plate'),
    keyRow(`<line x1="4" y1="9" x2="40" y2="9" class="sk" marker-end="url(#${P}-ai)"/>`, 'writes — a station files its one plate'),
    keyRow(`<line x1="4" y1="9" x2="40" y2="9" class="ska" marker-end="url(#${P}-aa)"/>`, 'reads the master plate — the fan-out bus'),
    keyRow(`<path d="M4,9 C16,9 28,9 40,9" class="sks" opacity="0.5" fill="none" marker-end="url(#${P}-as)"/>`, 'reads — a drawing imports a plate'),
    keyRow('<line x1="4" y1="9" x2="40" y2="9" class="sks" stroke-dasharray="4 4"/>', 'shares the basis — same ref, re-materialized'),
    keyRow('<rect x="4" y="3" width="40" height="12" class="sks fnone"/><line x1="4" y1="3" x2="44" y2="15" class="skr"/>', 'struck — files no plate and nothing imports it'),
  ].join('\n'),
};
