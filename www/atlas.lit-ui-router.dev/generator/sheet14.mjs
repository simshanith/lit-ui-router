import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, schedTxt, keyRow, arrow } from './helpers.mjs';
import { assertPlots } from './iso-hidden.mjs';

const P = 's14';

// ---- census: every figure comes from www/atlas.lit-ui-router.dev/data/census-upstream.json ----
// census-upstream.mjs files the surveyor's pull requests, issues and browser bug
// reports in other projects' trackers since this repo's first commit, each with the
// home PRs, issues and commits that cite it; the engine note reads the ci graph plate.
const PLATE = JSON.parse(readFileSync(new URL('../data/census-upstream.json', import.meta.url), 'utf8'));
const GRAPH = JSON.parse(readFileSync(new URL('../data/census-plate.json', import.meta.url), 'utf8'));
const BASIS = `counted at ${PLATE.ref} @ ${PLATE.sha}`;
const fmt = (v) => v.toLocaleString('en-US');
const day = (iso) => String(iso).slice(0, 10);
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const TIMES = ['never', 'once', 'twice'];
const word = (n) => WORD[n] ?? fmt(n);
const plural = (n, one, many = `${one}s`) => `${word(n)} ${n === 1 ? one : many}`;
const nplural = (n, one, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`;
const times = (n) => TIMES[n] ?? `${word(n)} times`;

// ---- the plate, read and checked -------------------------------------------------
const SINCE = PLATE.window?.since, UNTIL = PLATE.window?.until;
if (!SINCE || !UNTIL) throw new Error('sheet 14: census-upstream.json carries no window.since / window.until');
const T0 = Date.parse(SINCE), T1 = Date.parse(UNTIL);
const KINDS = { pr: 'pull request', issue: 'issue', bug: 'bug report' };
const KIND_SHORT = { pr: 'PR', issue: 'issue', bug: 'bug' };
// merged and fixed land in the yard; closed is answered without landing; open stands
const STATE = { merged: 'landed', fixed: 'landed', closed: 'closed', open: 'open' };
const TRACKERS = ['github', 'bugzilla'];
const yardById = new Map(PLATE.yards.map((y) => {
  if (!TRACKERS.includes(y.host)) throw new Error(`sheet 14: yard ${y.id} stands on host "${y.host}", which the plate draws no yard for`);
  return [y.id, y];
}));
const CONS = PLATE.consignments.map((c) => {
  if (!KINDS[c.kind]) throw new Error(`sheet 14: consignment ${c.yard}#${c.number} has kind "${c.kind}", which the plate draws no glyph for`);
  if (!STATE[c.state]) throw new Error(`sheet 14: consignment ${c.yard}#${c.number} has state "${c.state}", which the plate draws no fill for`);
  if (!yardById.has(c.yard)) throw new Error(`sheet 14: consignment ${c.yard}#${c.number} moors to a yard the plate does not carry`);
  const t = Date.parse(c.createdAt);
  if (!(t >= T0 && t <= T1)) throw new Error(`sheet 14: consignment ${c.yard}#${c.number} (${c.createdAt}) falls outside the window`);
  for (const r of c.returns) {
    const rt = Date.parse(r.date);
    if (!(rt >= T0 && rt <= T1)) throw new Error(`sheet 14: return ${r.ref} (${r.date}) falls outside the window`);
  }
  return { ...c, t, fate: STATE[c.state] };
}).sort((a, b) => a.t - b.t || a.yard.localeCompare(b.yard) || a.number - b.number);
CONS.forEach((c, i) => { c.n = i + 1; });
const firstOf = (id) => CONS.find((c) => c.yard === id)?.t ?? Infinity;
const YARDS = PLATE.yards.map((y, i) => ({ ...y, i, first: firstOf(y.id), cons: CONS.filter((c) => c.yard === y.id) }))
  .sort((a, b) => a.first - b.first || a.i - b.i);
const BERTHS = YARDS.filter((y) => y.host === 'bugzilla');
if (BERTHS.some((b) => b.stars != null)) throw new Error('sheet 14: a bugzilla berth carries stars; the plate draws berths at the minimum footprint');

// a return is a citation at its day: one wharf block per home item per day it cites;
// a squash commit `… (#N)` folds into the PR #N block the same consignment cites
const SQUASH = /\(#(\d+)\)$/;
const foldsInto = (c, r) => r.kind === 'commit' && c.returns.some((p) => p.kind === 'pr' && p.ref === `#${SQUASH.exec(r.title)?.[1]}`);
const FOLDED = CONS.reduce((a, c) => a + c.returns.filter((r) => foldsInto(c, r)).length, 0);
const HOME = new Map();
const ITEMS = new Map();
for (const c of CONS) for (const r of c.returns.filter((x) => !foldsInto(c, x))) {
  const key = `${r.ref}@${day(r.date)}`;
  if (!HOME.has(key)) HOME.set(key, { ...r, key, t: Date.parse(r.date), from: [] });
  HOME.get(key).from.push(c);
  if (!ITEMS.has(r.ref)) ITEMS.set(r.ref, { ...r, from: new Set() });
  ITEMS.get(r.ref).from.add(c);
}
const RETURNS = [...HOME.values()].sort((a, b) => a.t - b.t || a.ref.localeCompare(b.ref));

// the engine lane the berths stand for, off the ci graph plate
const MAIN = GRAPH.pipelines['ci:main'];
if (!MAIN) throw new Error('sheet 14: census-plate.json carries no ci:main pipeline');
const ENGINE_TASKS = [...new Set(Object.values(MAIN.cells).flatMap((cells) => Object.keys(cells)))].filter((t) => t.includes('test:engines'));
const ENGINE_PKGS = Object.entries(MAIN.cells).filter(([, cells]) => ENGINE_TASKS.some((t) => cells[t] === 'r')).map(([pkg]) => pkg).sort();
if (!ENGINE_TASKS.length || !ENGINE_PKGS.length) throw new Error('sheet 14: no package in census-plate.json runs test:engines, and the berths say the engine lane runs on these engines');

// ---- roll-ups the prose, the verdict and the schedule read ------------------------
const LANDED = CONS.filter((c) => c.fate === 'landed').length;
const OPEN = CONS.filter((c) => c.fate === 'open').length;
const CLOSED = CONS.filter((c) => c.fate === 'closed').length;
const RETURNED = CONS.filter((c) => c.returns.length > 0).length;
const WORKS = YARDS.filter((y) => y.cons.length > 0);
for (const c of CONS) c.home = c.returns.filter((r) => !foldsInto(c, r)).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
const MOST = [...CONS].sort((a, b) => b.home.length - a.home.length || a.t - b.t)[0];
const EARLY = CONS.flatMap((c) => c.home.filter((r) => Date.parse(r.date) < c.t).map((r) => [c, r]));
const ITEM_KINDS = Object.fromEntries(['pr', 'issue', 'commit'].map((k) => [k, [...ITEMS.values()].filter((r) => r.kind === k).length]));
const BYKIND = Object.fromEntries(Object.keys(KINDS).map((k) => [k, CONS.filter((c) => c.kind === k).length]));
const BUSIEST = [...WORKS].sort((a, b) => b.cons.length - a.cons.length || a.first - b.first);
const TOP = BUSIEST[0];
if (TOP && BUSIEST[1] && BUSIEST[1].cons.length === TOP.cons.length) TOP.tied = BUSIEST.filter((y) => y.cons.length === TOP.cons.length);
const CITED = [...ITEMS.values()].sort((a, b) => b.from.size - a.from.size)[0];
if (CITED && [...ITEMS.values()].filter((r) => r.from.size === CITED.from.size).length > 1) CITED.tied = true;
const PRIOR = PLATE.prior;
const LEDGER = `BEFORE THE CITY — ${nplural(PRIOR.prs, 'pull request')} (${fmt(PRIOR.merged)} merged) and ${nplural(PRIOR.issues, 'issue')} to ${nplural(PRIOR.repos, 'repository', 'repositories')}, ${PRIOR.first.slice(0, 4)}–${PRIOR.last.slice(0, 4)}`;

// ---- type measure: DIN at the plate's sizes, for truncation and slot widths -------
const EM = { lbl: 11.5, lblb: 11.5, lbls: 10.5, lblf: 10, lbla: 11, lblr: 9.5 };
const TRACK = { lblb: 0.07, lbla: 0.07 };
const glyph = (ch) => (/[A-Z0-9#★%]/.test(ch) ? 0.6 : /[mwMW]/.test(ch) ? 0.75 : /[ .,:;'|il!·()-]/.test(ch) ? 0.3 : 0.52);
const tw = (s, cls = 'lbls') => [...s].reduce((a, ch) => a + glyph(ch) + (TRACK[cls] ?? 0.05), 0) * EM[cls];
const fit = (s, w, cls = 'lbls') => {
  if (tw(s, cls) <= w) return s;
  let out = s;
  while (out.length > 1 && tw(`${out}…`, cls) > w) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
};

// ---- geometry ---------------------------------------------------------------------
const W = 1400, RX0 = 170, RX1 = 1340;
const X = (t) => RX0 + ((t - T0) / (T1 - T0)) * (RX1 - RX0);
// greedy lanes: an item takes the first lane whose last occupant ends before it starts
const lanes = (items, span) => {
  const ends = [];
  for (const it of items) {
    const [a, b] = span(it);
    let l = ends.findIndex((e) => e + 4 <= a);
    if (l === -1) { l = ends.length; ends.push(b); } else ends[l] = b;
    it.lane = l;
  }
  return ends.length;
};

// THE NORTH BANK — one yard per work, slots sized to the widest line they letter
const YL = 128, YY = 182, YH = 38, RT = 300;
const MIN_W = 40, K_W = 18;
const footW = (stars) => (stars == null ? MIN_W : MIN_W + K_W * Math.log10(Math.max(1, stars)));
const host = (y) => (y.host === 'github' ? y.id.split('/')[0] : y.id);
const work = (y) => (y.host === 'github' ? y.id : y.name);
const dl = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K` : String(n));
const yardLines = (y) => [
  [host(y), 'lblf'],
  [y.name, 'lblb'],
  ...(y.host === 'bugzilla'
    ? [[nplural(y.cons.length, 'report') + ' filed', 'lbls']]
    : [[`★ ${fmt(y.stars)}`, 'lbls'], ...(y.weeklyDownloads != null ? [[`${dl(y.weeklyDownloads)} / wk`, 'lblf']] : [])]),
];
for (const y of YARDS) {
  y.w = footW(y.stars);
  y.lines = yardLines(y);
  y.slot = Math.max(y.w, ...y.lines.map(([s, c]) => tw(s, c))) + 6;
}
const SLOTS = YARDS.reduce((a, y) => a + y.slot, 0);
const GAP = (RX1 + 20 - RX0 + 30 - SLOTS) / (YARDS.length - 1);
if (GAP < 14) throw new Error(`sheet 14: the north bank holds ${YARDS.length} yards in ${fmt(Math.round(SLOTS))} of lettering; the gap between them falls to ${GAP.toFixed(1)}`);
{
  let x = RX0 - 30;
  for (const y of YARDS) {
    y.x = x + (y.slot - y.w) / 2;
    y.cx = y.x + y.w / 2;
    x += y.slot + GAP;
  }
}
assertPlots('sheet 14', YARDS.map((y) => ({ n: y.i, name: y.name, part: 'yard', x: y.x, y: YY, w: y.w, d: YH })));

// THE RIVER — every consignment a crate at its day, stacked where days crowd
const CR = 7, BADGE_DX = 10;
const badgeW = (c) => tw(String(c.n), 'lbls');
for (const c of CONS) c.x = X(c.t);
const RLANES = lanes(CONS, (c) => [c.x - CR, c.x + BADGE_DX + badgeW(c)]);
const LP = 24;
const RIV_T = RT, RIV_B = RT + 22 + RLANES * LP;
for (const c of CONS) c.y = RIV_T + 20 + c.lane * LP;
assertPlots('sheet 14', CONS.map((c) => ({ n: `c${c.n}`, name: `${c.yard}#${c.number}`, part: 'crate', x: c.x - CR, y: c.y - CR, w: 2 * CR + BADGE_DX + badgeW(c), d: 2 * CR })));

// THE SOUTH BANK — month ticks, then the wharf with one block per return
const months = [];
{
  const d = new Date(T0);
  let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  for (;;) {
    if (m > 11) { m = 0; y += 1; }
    const t = Date.UTC(y, m, 1);
    if (t > T1) break;
    months.push(t);
    m += 1;
  }
}
const WY = RIV_B + 44;
const RB_H = 16;
for (const r of RETURNS) { r.label = r.ref; r.w = tw(r.label, 'lbls') + 10; r.x = X(r.t); }
const WLANES = lanes(RETURNS, (r) => [r.x - r.w / 2, r.x + r.w / 2]);
for (const r of RETURNS) r.y = WY + 14 + r.lane * (RB_H + 8);
const WH = 14 + WLANES * (RB_H + 8) + 6;
assertPlots('sheet 14', RETURNS.map((r) => ({ n: r.key, name: r.label, part: 'return', x: r.x - r.w / 2, y: r.y, w: r.w, d: RB_H })));

// ---- drawing ----------------------------------------------------------------------
const glyphOf = (kind, fate, x, y) => {
  const cls = fate === 'landed' ? 'sk fi' : 'sk fp';
  const dash = fate === 'open' ? ' stroke-dasharray="2.5 2"' : '';
  if (kind === 'pr') return `<rect x="${(x - CR).toFixed(1)}" y="${(y - 5).toFixed(1)}" width="${2 * CR}" height="10" class="${cls}"${dash}/>`;
  if (kind === 'issue') return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${CR - 1}" class="${cls}"${dash}/>`;
  const pts = [0, 1, 2, 3, 4, 5].map((k) => {
    const a = (Math.PI / 3) * k;
    return `${(x + CR * Math.cos(a)).toFixed(1)},${(y + CR * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${pts}" class="${cls}"${dash}/>`;
};

const yardSvg = YARDS.map((y) => {
  const x = y.x.toFixed(1), w = y.w.toFixed(1);
  const mass = y.host === 'bugzilla'
    ? `<rect x="${x}" y="${YY}" width="${w}" height="${YH}" class="sks fp" stroke-dasharray="4 3"/>`
    : `<rect x="${x}" y="${YY}" width="${w}" height="${YH}" class="fp2"/><rect x="${x}" y="${YY}" width="${w}" height="${YH}" fill="url(#${P}-hx)"/><rect x="${x}" y="${YY}" width="${w}" height="${YH}" class="sk fnone"/>`;
  const label = y.lines.map(([s, c], i) => txt(y.cx.toFixed(1), YL + i * 13 - (y.lines.length - 3) * 13, s, c, 'middle')).join('\n');
  const pier = y.cons.length
    ? `<line x1="${y.cx.toFixed(1)}" y1="${YY + YH}" x2="${y.cx.toFixed(1)}" y2="${RT}" class="sk"/>`
    : '';
  return `${mass}\n${label}\n${pier}`;
}).join('\n');

const BX0 = Math.min(...BERTHS.map((b) => b.x)), BX1 = Math.max(...BERTHS.map((b) => b.x + b.w));
const engineNote = BERTHS.length ? `
<line x1="${BX0.toFixed(1)}" y1="${YY + YH + 10}" x2="${BX1.toFixed(1)}" y2="${YY + YH + 10}" class="skf"/>
${txt(BX1.toFixed(1), YY + YH + 26, `the main lane's ${ENGINE_TASKS.join(', ')}`, 'lblf', 'end')}
${txt(BX1.toFixed(1), YY + YH + 39, `runs on ${BERTHS.length === 1 ? 'this engine' : `these ${word(BERTHS.length)} engines`},`, 'lblf', 'end')}
${txt(BX1.toFixed(1), YY + YH + 52, `in ${plural(ENGINE_PKGS.length, 'package')}`, 'lblf', 'end')}` : '';

const yardOf = (c) => YARDS.find((y) => y.id === c.yard);
const moorings = CONS.map((c) => {
  const y = yardOf(c);
  return `<line x1="${y.cx.toFixed(1)}" y1="${RT}" x2="${c.x.toFixed(1)}" y2="${(c.y - CR).toFixed(1)}" class="sks"/>`;
}).join('\n');

const roads = RETURNS.flatMap((r) => r.from.map((c) =>
  arrow(P, `M${c.x.toFixed(1)},${(c.y + CR).toFixed(1)} L${r.x.toFixed(1)},${(r.y - 2).toFixed(1)}`, 'as', 'skf'))).join('\n');

const crates = CONS.map((c) => `${glyphOf(c.kind, c.fate, c.x, c.y)}
${txt((c.x + BADGE_DX).toFixed(1), (c.y + 3.6).toFixed(1), String(c.n), 'lbls')}`).join('\n');

const river = `<rect x="${RX0 - 30}" y="${RIV_T}" width="${RX1 + 20 - (RX0 - 30)}" height="${RIV_B - RIV_T}" class="fp2"/>
<line x1="${RX0 - 30}" y1="${RIV_T}" x2="${RX1 + 20}" y2="${RIV_T}" class="sk"/>
<line x1="${RX0 - 30}" y1="${RIV_B}" x2="${RX1 + 20}" y2="${RIV_B}" class="sk"/>
${arrow(P, `M${RX1 - 60},${RIV_B - 8} L${RX1 + 12},${RIV_B - 8}`, 'as', 'sks')}
${txt(RX1 - 66, RIV_B - 4.5, 'TIME', 'lblf', 'end')}
${months.map((t) => {
    const x = X(t).toFixed(1);
    const lab = new Date(t).toISOString().slice(2, 7).replace(/^/, "'");
    return `<line x1="${x}" y1="${RIV_B}" x2="${x}" y2="${RIV_B + 6}" class="sk"/>${txt(x, RIV_B + 19, lab, 'lblf', 'middle')}`;
  }).join('\n')}`;

const wharf = `<rect x="${RX0 - 30}" y="${WY}" width="${RX1 + 20 - (RX0 - 30)}" height="${WH}" class="sk fp"/>
${RETURNS.map((r) => `<rect x="${(r.x - r.w / 2).toFixed(1)}" y="${r.y}" width="${r.w.toFixed(1)}" height="${RB_H}" class="sk fp2"/>
${txt(r.x.toFixed(1), r.y + 11.8, r.label, 'lbls', 'middle')}`).join('\n')}`;

const BANK_X = 40;
const banks = `
${txt(BANK_X, YY + 10, 'NORTH BANK', 'lblb')}
${txt(BANK_X, YY + 24, 'the commons', 'lblf')}
${txt(BANK_X, (RIV_T + RIV_B) / 2 - 3, 'THE RIVER', 'lblb')}
${txt(BANK_X, (RIV_T + RIV_B) / 2 + 11, 'time, west → east', 'lblf')}
${txt(BANK_X, WY + 14, 'SOUTH BANK', 'lblb')}
${txt(BANK_X, WY + 28, 'the city’s wharf', 'lblf')}`;

// ---- schedule ---------------------------------------------------------------------
const COL = { date: 83, yard: 160, kind: 330, num: 374, title: 434, state: 1090, ret: 1150 };
const TITLE_W = COL.state - COL.title - 14;
const SY = WY + WH + 40;
const schedRow = (c, i) => {
  const y = SY + 52 + i * 17;
  const y0 = yardOf(c);
  return [
    schedTxt(58, y, [c.n, day(c.createdAt)], 'lbls'),
    txt(COL.yard, y, fit(work(y0), COL.kind - COL.yard - 10), 'lbls'),
    txt(COL.kind, y, KIND_SHORT[c.kind], 'lbls'),
    txt(COL.num, y, `#${c.number}`, 'lbls'),
    txt(COL.title, y, fit(c.title, TITLE_W), 'lbls'),
    txt(COL.state, y, c.state, c.fate === 'landed' ? 'lbl' : 'lbls'),
    txt(COL.ret, y, c.home.length ? fit(`→ ${c.home.map((r) => r.ref).join(', ')}`, 1350 - COL.ret) : '—', 'lbls'),
  ].join('');
};
const SH = 74 + CONS.length * 17;
const schedule = `<rect x="40" y="${SY}" width="1320" height="${SH}" class="sk fp"/>
${txt(58, SY + 22, 'CONSIGNMENT SCHEDULE — date filed · work · kind · number in its tracker · title · state · returns home', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1360" y2="${SY + 32}" class="skf"/>
${CONS.map(schedRow).join('\n')}
${txt(58, SY + 58 + CONS.length * 17, `TOTAL — ${nplural(CONS.length, 'consignment')} · ${nplural(BYKIND.pr, 'PR')} · ${nplural(BYKIND.issue, 'issue')} · ${nplural(BYKIND.bug, 'bug')} · ${LANDED} merged or fixed, ${CLOSED} closed, ${OPEN} open · ${nplural(RETURNS.length, 'block')} on the wharf · window ${day(SINCE)} → ${day(UNTIL)} · ${BASIS}`, 'lbls')}`;

// ---- assemble ---------------------------------------------------------------------
const H = SY + SH + 30;
const yardsWord = plural(WORKS.length, 'work');
const consWord = plural(CONS.length, 'consignment');
export const SHEET14_VERDICT = `${nplural(CONS.length, 'consignment')} to ${nplural(WORKS.length, 'work')}, ${fmt(LANDED)} merged, ${fmt(RETURNED)} returned home`;

const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="A plan map of the open-source commons around lit-ui-router, drawn as a river of time. A river band runs west to east across the plate from ${day(SINCE)}, the repository's first commit, to ${day(UNTIL)}, with month ticks lettered along its south bank. On the north bank stand ${plural(YARDS.length, 'yard')}, one per upstream work, in the order the city first sent them anything; a yard's footprint grows with the logarithm of its GitHub stars, and ${BERTHS.length ? `${plural(BERTHS.length, 'browser bug tracker')}, ${BERTHS.map((b) => b.name).join(' and ')}, stand at the east end as dashed berths at the minimum footprint, each lettered ${BERTHS.map((b) => nplural(b.cons.length, 'report') + ' filed').join(' and ')}` : 'no bug tracker stands among them'}. On the river float ${consWord}, each a crate at the day it was filed and moored by a line to its yard: a rectangle for a pull request, a circle for an issue, a hexagon for a bug report; filled in ink where it merged, outlined where it closed, dashed where it stands open. ${fmt(LANDED)} are filled. On the south bank the city's wharf carries ${plural(RETURNS.length, 'block')}, one per home pull request, issue or commit that cites a consignment, and a faint road with an arrowhead crosses the river from each consignment to each of its returns${MOST && MOST.returns.length > 1 ? `; the roads from ${yardOf(MOST).name} #${MOST.number} cross ${times(MOST.home.length)}` : ''}. A ledger above the river counts the work sent before the city existed, and a schedule below lists every consignment.">
${defs(P)}

<rect x="40" y="24" width="600" height="42" class="skf fnone"/>
${txt(52, 41, 'THE UPSTREAM WORKS — WHAT THE CITY SENDS ACROSS THE RIVER, AND WHAT COMES HOME', 'lbls')}
${txt(52, 56, 'north bank, the works the city builds on · the river, time · south bank, the city', 'lblf')}

${txt(1360, 34, `TIME RUNS EAST — ${day(SINCE)}, the first commit, to ${day(UNTIL)} · one crate per consignment, at the day it was filed`, 'lbls', 'end')}
${txt(1360, 48, `yard footprint grows with log₁₀ of stars · ★ GitHub stars · npm downloads per week · ${BASIS}`, 'lblf', 'end')}
${txt(1360, 62, 'a road across the river = a return: a home PR, issue or commit that cites the consignment', 'lblf', 'end')}

${txt(40, 96, LEDGER, 'lbl')}

${river}
${moorings}
${roads}
${crates}
${yardSvg}
${engineNote}
${wharf}
${banks}
${schedule}
</svg>`;

const topLine = TOP
  ? TOP.tied
    ? `${TOP.tied.map(work).join(' and ')} each take ${plural(TOP.cons.length, 'consignment')}, the most of any work`
    : `${work(TOP)} takes the most, ${plural(TOP.cons.length, 'consignment')}`
  : 'no work takes a consignment';

export const sheet14 = {
  num: 14, id: 'upstream', rev: 'A',
  title: 'THE UPSTREAM WORKS',
  sub: `ALTITUDE 14 — the city among the commons it builds on · ${consWord} to ${yardsWord} since the first commit, ${fmt(LANDED)} merged, ${fmt(RETURNED)} returned home · ${BASIS}`,
  scale: 'CITY × COMMONS',
  form: 'UPSTREAM WORKS',
  svg,
  caption: `Every other sheet draws the city; this one draws what the city sends out. Across a river of time from the first commit, ${consWord} — pull requests, issues and bug reports filed in other projects' trackers — sit at the day they were filed, moored to the works on the north bank, and roads cross back to the ${plural(RETURNS.length, 'home pull request, issue or commit', 'home pull requests, issues and commits')} that cite them on the city's wharf.`,
  notes: `
<p><strong>Method — one probe, one plate.</strong> Every figure on this sheet is read at build time from <code>www/atlas.lit-ui-router.dev/data/census-upstream.json</code>, ${BASIS}. The probe lists what the surveyor (<code>${PLATE.surveyor.login}</code>) files in other projects' trackers — pull requests and issues on GitHub, bug reports on the browser engines' Bugzillas — from ${day(SINCE)}, this repository's first commit on <code>main</code>, to ${day(UNTIL)}. A <em>consignment</em> is one of those filings. A <em>return</em> is a pull request, issue or commit of this repository that cites a consignment: the place the upstream work comes back into the city. Stars and weekly npm downloads are read from GitHub and the npm registry for each work the plate carries. The berths' note is read from <code>census-plate.json</code>, the ci graph plate: the packages whose <code>ci:main</code> graph runs a real ${ENGINE_TASKS.map((t) => `<code>${t}</code>`).join(', ')} task.</p>
<p><strong>The river is time.</strong> The river's x axis runs from ${day(SINCE)} at the west to ${day(UNTIL)} at the east, one tick per calendar month, and every crate and every wharf block sits at its own day: a crate at the day the consignment was filed, a block at the day its return landed. Where days crowd, crates stack across the river and blocks along the wharf, so nothing moves off its date. The yards on the north bank stand in the order the city first sent each of them a consignment, not by size, so the bank reads west to east in the same order as the river; a yard's footprint grows with the base-ten logarithm of its stars. A crate's shape is its kind and its fill its state: ink where it merged or was fixed, an outline where it closed unmerged, a dashed outline where it stands open.</p>
<p><strong>What the plate reads.</strong> ${consWord[0].toUpperCase() + consWord.slice(1)} to ${yardsWord}: ${nplural(BYKIND.pr, 'pull request')}, ${nplural(BYKIND.issue, 'issue')} and ${nplural(BYKIND.bug, 'bug report')}. ${fmt(LANDED)} merged or fixed, ${fmt(CLOSED)} closed and ${fmt(OPEN)} open. ${topLine}. ${fmt(RETURNED)} of the ${fmt(CONS.length)} have come home, and ${nplural(CONS.length - RETURNED, 'consignment')} ${CONS.length - RETURNED === 1 ? 'has' : 'have'} no return: ${CONS.filter((c) => !c.returns.length).map((c) => `${work(yardOf(c))} #${c.number}`).join(', ')}. The wharf holds ${plural(RETURNS.length, 'block')} for ${plural(ITEMS.size, 'home item')} — ${nplural(ITEM_KINDS.pr, 'pull request')} and ${nplural(ITEM_KINDS.issue, 'issue')}${ITEM_KINDS.commit ? `, and ${nplural(ITEM_KINDS.commit, 'commit')} lettered by sha` : ''}. A squash commit whose subject ends in a pull request's number folds into that pull request's block when the same consignment cites both: ${nplural(FOLDED, 'commit')} ${FOLDED === 1 ? 'folds' : 'fold'} this way. ${MOST ? `${work(yardOf(MOST))} #${MOST.number} comes home the most, ${times(MOST.home.length)}, from ${day(MOST.home[0].date)} to ${day(MOST.home.at(-1).date)}` : ''}${CITED && CITED.from.size > 1 && !CITED.tied ? `; ${CITED.ref}, ${CITED.title}, is cited by ${plural(CITED.from.size, 'consignment')}, the most of any home item` : ''}.${EARLY.length ? ` A return is dated by the citing text's own day, so a road can run west: ${EARLY.map(([c, r]) => `${r.ref} (${day(r.date)}) cites ${work(yardOf(c))} #${c.number} (${day(c.createdAt)})`).join('; ')} — in each the home text is the older one, and the upstream filing is named in it.` : ''}</p>
${BERTHS.length ? `<p><strong>The berths.</strong> ${BERTHS.map((b) => `${b.name} (${b.id}) reads ${nplural(b.cons.length, 'report')} filed`).join(', and ')}. They stand on the bank because the suite runs on these engines: ${ENGINE_TASKS.map((t) => `<code>${t}</code>`).join(', ')} is a real task in ${plural(ENGINE_PKGS.length, 'package')} of the <code>ci:main</code> graph — ${ENGINE_PKGS.map((p) => `<code>${p}</code>`).join(', ')}.</p>` : ''}
<p><strong>Before the city.</strong> The surveyor's ledger reaches back past this repository: ${nplural(PRIOR.prs, 'pull request')}, ${fmt(PRIOR.merged)} of them merged, and ${nplural(PRIOR.issues, 'issue')}, filed in ${nplural(PRIOR.repos, 'repository', 'repositories')} from ${PRIOR.first} to ${PRIOR.last}. The plate counts them as one line, above the river's west end, and draws none of them.</p>`,
  key: [
    keyRow('<rect x="6" y="3" width="36" height="12" class="fp2"/><rect x="6" y="3" width="36" height="12" fill="url(#s14-hx)"/><rect x="6" y="3" width="36" height="12" class="sk fnone"/>', 'yard — one upstream work · width grows with log₁₀ stars'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="sks fnone" stroke-dasharray="4 3"/>', 'berth — a browser bug tracker'),
    keyRow('<rect x="17" y="4" width="14" height="10" class="sk fi"/>', 'pull request, merged'),
    keyRow('<circle cx="24" cy="9" r="6" class="sk fp"/>', 'issue, closed'),
    keyRow('<circle cx="24" cy="9" r="6" class="sk fp" stroke-dasharray="2.5 2"/>', 'open — dashed outline, any kind'),
    keyRow('<polygon points="31,9 27.5,15.1 20.5,15.1 17,9 20.5,2.9 27.5,2.9" class="sk fp"/>', 'bug report — a hexagon'),
    keyRow('<line x1="24" y1="1" x2="24" y2="17" class="sks"/>', 'mooring — a consignment to its yard'),
    keyRow('<path d="M24,1 L24,15" class="skf" marker-end="url(#s14-as)"/>', 'road — a consignment to a return home'),
    keyRow('<rect x="10" y="2" width="28" height="14" class="sk fp2"/><text x="24" y="13" class="lbls" text-anchor="middle" font-size="9">#N</text>', 'return — a home PR, issue or commit, on the wharf'),
  ].join('\n'),
};
