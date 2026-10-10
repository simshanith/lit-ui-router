import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, schedTxt, keyRow, arrow } from './helpers.mjs';
import { assertPlots } from './iso-hidden.mjs';

const P = 's14';

// ---- census: every figure comes from www/atlas.lit-ui-router.dev/data/census-upstream.json ----
// census-upstream.mjs files every external GitHub issue or PR and Bugzilla bug the
// city's own record cites, each with the home PRs, issues and commits that cite it;
// the berths' engine note reads the ci graph plate.
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
const cap = (s) => `${s[0].toUpperCase()}${s.slice(1)}`;

// ---- the plate, read and checked -------------------------------------------------
const SINCE = PLATE.window?.since, UNTIL = PLATE.window?.until;
if (!SINCE || !UNTIL) throw new Error('sheet 14: census-upstream.json carries no window.since / window.until');
const T0 = Date.parse(SINCE), T1 = Date.parse(UNTIL);
const KINDS = { pr: 'pull request', issue: 'issue', bug: 'bug report' };
const KIND_SHORT = { pr: 'PR', issue: 'issue', bug: 'bug' };
// merged and fixed land in the yard; closed is answered without landing; open stands;
// missing is cited at home and no longer readable upstream, so it carries no day
const STATE = { merged: 'landed', fixed: 'landed', closed: 'closed', open: 'open', missing: 'missing' };
const NO_DAY = -8.64e15;
const TRACKERS = ['github', 'bugzilla'];
const yardById = new Map(PLATE.yards.map((y) => {
  if (!TRACKERS.includes(y.host)) throw new Error(`sheet 14: yard ${y.id} stands on host "${y.host}", which the plate draws no yard for`);
  return [y.id, y];
}));
const ALL = PLATE.consignments.map((c) => {
  const id = `${c.yard}#${c.number}`;
  if (!KINDS[c.kind]) throw new Error(`sheet 14: consignment ${id} has kind "${c.kind}", which the plate draws no glyph for`);
  if (!STATE[c.state]) throw new Error(`sheet 14: consignment ${id} has state "${c.state}", which the plate draws no fill for`);
  if (!yardById.has(c.yard)) throw new Error(`sheet 14: consignment ${id} moors to a yard the plate does not carry`);
  if (typeof c.sent !== 'boolean' || typeof c.inWindow !== 'boolean' || typeof c.tracked !== 'boolean') throw new Error(`sheet 14: consignment ${id} carries no boolean sent / inWindow / tracked`);
  if (c.returns.some((r) => r.kind !== 'commit' && typeof r.external !== 'boolean')) throw new Error(`sheet 14: a return of ${id} carries no boolean external`);
  if (c.tracked !== c.returns.some((r) => r.external === true)) throw new Error(`sheet 14: consignment ${id} reads tracked ${c.tracked}, and its returns say otherwise`);
  const t = c.createdAt ? Date.parse(c.createdAt) : NO_DAY;
  if (t === NO_DAY && (c.inWindow || c.state !== 'missing')) throw new Error(`sheet 14: consignment ${id} carries no createdAt`);
  if (c.inWindow && !(t >= T0 && t <= T1)) throw new Error(`sheet 14: consignment ${id} (${c.createdAt}) is marked in the window and falls outside it`);
  if (!c.inWindow && t >= T0) throw new Error(`sheet 14: consignment ${id} (${c.createdAt}) is marked before the window and falls inside it`);
  for (const r of c.returns) {
    const rt = Date.parse(r.date);
    if (!(rt >= T0 && rt <= T1)) throw new Error(`sheet 14: return ${r.ref} (${r.date}) falls outside the window`);
  }
  return { ...c, t, fate: STATE[c.state], title: c.title ?? 'no longer readable upstream' };
});
const byDay = (a, b) => a.t - b.t || a.yard.localeCompare(b.yard) || a.number - b.number;
// on the river, numbered by day; the ones cited from before the first commit after them
const CONS = ALL.filter((c) => c.inWindow).sort(byDay);
const OFF = ALL.filter((c) => !c.inWindow && c.fate !== 'missing').sort(byDay);
const GONE = ALL.filter((c) => c.fate === 'missing').sort(byDay);
[...CONS, ...OFF, ...GONE].forEach((c, i) => { c.n = i + 1; });
const EVERY = [...CONS, ...OFF, ...GONE];
const DRAWN = [...CONS, ...OFF];
const firstOf = (id) => Math.min(...EVERY.filter((c) => c.yard === id).map((c) => c.t));
const YARDS = PLATE.yards.map((y, i) => ({ ...y, i, first: firstOf(y.id), cons: EVERY.filter((c) => c.yard === y.id) }))
  .sort((a, b) => (a.host === 'bugzilla') - (b.host === 'bugzilla') || a.first - b.first || a.i - b.i);
const BERTHS = YARDS.filter((y) => y.host === 'bugzilla');
if (BERTHS.some((b) => b.stars != null)) throw new Error('sheet 14: a bugzilla berth carries stars; the plate draws berths at the minimum footprint');

// a return is a citation at its day: one wharf block per home item per day it cites;
// a squash commit `… (#N)` folds into the PR #N block the same consignment cites
const SQUASH = /\(#(\d+)\)$/;
const foldsInto = (c, r) => r.kind === 'commit' && c.returns.some((p) => p.kind === 'pr' && p.ref === `#${SQUASH.exec(r.title)?.[1]}`);
const FOLDED = EVERY.reduce((a, c) => a + c.returns.filter((r) => foldsInto(c, r)).length, 0);
const HOME = new Map();
const ITEMS = new Map();
for (const c of EVERY) {
  c.home = c.returns.filter((r) => !foldsInto(c, r)).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  for (const r of c.home) {
    const key = `${r.ref}@${day(r.date)}`;
    if (!HOME.has(key)) HOME.set(key, { ...r, key, t: Date.parse(r.date), from: [] });
    HOME.get(key).from.push(c);
    if (!ITEMS.has(r.ref)) ITEMS.set(r.ref, { ...r, from: new Set() });
    ITEMS.get(r.ref).from.add(c);
  }
}
const RETURNS = [...HOME.values()].sort((a, b) => a.t - b.t || a.ref.localeCompare(b.ref));
const LABELLED = [...ITEMS.values()].filter((r) => r.external === true).length;

// the engine lane the berths stand for, off the ci graph plate
const MAIN = GRAPH.pipelines['ci:main'];
if (!MAIN) throw new Error('sheet 14: census-plate.json carries no ci:main pipeline');
const ENGINE_TASKS = [...new Set(Object.values(MAIN.cells).flatMap((cells) => Object.keys(cells)))].filter((t) => t.includes('test:engines'));
const ENGINE_PKGS = Object.entries(MAIN.cells).filter(([, cells]) => ENGINE_TASKS.some((t) => cells[t] === 'r')).map(([pkg]) => pkg).sort();
if (!ENGINE_TASKS.length || !ENGINE_PKGS.length) throw new Error('sheet 14: no package in census-plate.json runs test:engines, and the berths say the engine lane runs on these engines');

// ---- roll-ups the prose, the verdict and the schedule read ------------------------
const count = (f) => EVERY.filter(f).length;
const LANDED = count((c) => c.fate === 'landed');
const OPEN = count((c) => c.fate === 'open');
const MISSING = count((c) => c.fate === 'missing');
const CLOSED = count((c) => c.fate === 'closed');
const SENT = count((c) => c.sent);
const WATCHED = count((c) => !c.sent);
const RETURNED = count((c) => c.home.length > 0);
const TRACKED = count((c) => c.tracked);
const WORKS = YARDS.filter((y) => y.cons.length > 0);
const MOST = [...EVERY].sort((a, b) => b.home.length - a.home.length || a.t - b.t)[0];
const EARLY = CONS.flatMap((c) => c.home.filter((r) => Date.parse(r.date) < c.t).map((r) => [c, r]));
const ITEM_KINDS = Object.fromEntries(['pr', 'issue', 'commit'].map((k) => [k, [...ITEMS.values()].filter((r) => r.kind === k).length]));
const BYKIND = Object.fromEntries(Object.keys(KINDS).map((k) => [k, count((c) => c.kind === k)]));
const BUSIEST = [...WORKS].sort((a, b) => b.cons.length - a.cons.length || a.first - b.first);
const TOP = BUSIEST[0];
if (TOP && BUSIEST[1] && BUSIEST[1].cons.length === TOP.cons.length) TOP.tied = BUSIEST.filter((y) => y.cons.length === TOP.cons.length);
const CITED = [...ITEMS.values()].sort((a, b) => b.from.size - a.from.size)[0];
if (CITED && [...ITEMS.values()].filter((r) => r.from.size === CITED.from.size).length > 1) CITED.tied = true;
const AUTHORS = [...new Set(EVERY.filter((c) => !c.sent).map((c) => c.author?.login).filter(Boolean))];
const OFF_RIVER = OFF.length + GONE.length;

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

// ---- geometry: the river's west mouth takes the cited items older than the window ----
const W = 1560, RXS = 140, RXE = 1520, CR = 7, BADGE_DX = 10, LP = 26, MOUTH_PITCH = 34;
const badgeW = (c) => tw(String(c.n), 'lbls');
// lanes are counted on a provisional axis; the mouth's width then sets the axis itself
const laneCount = (rx0) => {
  const X = (t) => rx0 + ((t - T0) / (T1 - T0)) * (RXE - 20 - rx0);
  for (const c of CONS) c.x = X(c.t);
  return lanes(CONS, (c) => [c.x - CR - 2, c.x + BADGE_DX + badgeW(c)]);
};
let RLANES = Math.max(1, laneCount(RXS + 30));
const MOUTH_COLS = OFF.length ? Math.ceil(OFF.length / RLANES) : 0;
const MOUTH_X1 = RXS + 8 + MOUTH_COLS * MOUTH_PITCH;
const RX0 = OFF.length ? MOUTH_X1 + 30 : RXS + 30, RX1 = RXE - 20;
RLANES = Math.max(1, laneCount(RX0), Math.ceil(OFF.length / Math.max(1, MOUTH_COLS)));
const X = (t) => RX0 + ((t - T0) / (T1 - T0)) * (RX1 - RX0);
OFF.forEach((c, i) => { c.x = RXS + 8 + CR + 2 + Math.floor(i / RLANES) * MOUTH_PITCH; c.lane = i % RLANES; });

// THE NORTH BANK — one yard per work, slots sized to the widest line they letter;
// rows are added, nearest the river first, until the bank holds every slot
const MIN_W = 24, K_W = 10, YH = 30, LINE = 13, LABEL_H = 4 * LINE, ROW_H = LABEL_H + YH + 18, NB_TOP = 92;
const footW = (stars) => (stars == null ? MIN_W : MIN_W + K_W * Math.log10(Math.max(1, stars)));
const host = (y) => (y.host === 'github' ? y.id.split('/')[0] : y.id);
const work = (y) => (y.host === 'github' ? y.id : y.name);
const dl = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K` : String(n));
const yardLines = (y) => [
  [host(y), 'lblf'],
  [y.name, 'lblb'],
  ...(y.host === 'bugzilla'
    ? [[`${nplural(y.cons.length, 'report')} filed`, 'lbls']]
    : [[`★ ${y.stars == null ? '—' : fmt(y.stars)}`, 'lbls'], ...(y.weeklyDownloads != null ? [[`${dl(y.weeklyDownloads)} / wk`, 'lblf']] : [])]),
];
const LETTER_W = 116;
for (const y of YARDS) {
  y.w = footW(y.stars);
  y.lines = yardLines(y).map(([s, c]) => [fit(s, LETTER_W, c), c]);
  y.slot = Math.max(y.w, ...y.lines.map(([s, c]) => tw(s, c))) + 6;
}
// berths stand in the nearest row, so the engine note sits on the quay beneath them
const place = (R) => {
  let k = 0;
  for (const y of YARDS) y.row = y.host === 'bugzilla' ? 0 : (k++) % R;
  YARDS.forEach((y, i) => {
    // west to east in order; a row's lettering clears its neighbour's
    let cx = Math.max(RXS + y.slot / 2, i ? YARDS[i - 1].cx + 1 : -Infinity);
    const mate = YARDS.slice(0, i).findLast((o) => o.row === y.row);
    if (mate) cx = Math.max(cx, mate.cx + (mate.slot + y.slot) * 0.54 + 16);
    // across rows, no pier runs through a footprint: push east until none does
    for (let moved = true; moved;) {
      moved = false;
      for (const o of YARDS.slice(0, i)) {
        if (o.row === y.row) continue;
        const clear = (o.row < y.row ? o.w : y.w) / 2 + 6;
        if (Math.abs(cx - o.cx) < clear - 0.01) { cx = o.cx + clear; moved = true; }
      }
    }
    y.cx = cx;
  });
  const last = YARDS.at(-1);
  return last.cx + last.slot / 2 <= RXE;
};
let ROWS = 1;
while (!place(ROWS)) {
  ROWS += 1;
  if (ROWS > 4) throw new Error(`sheet 14: the north bank cannot hold ${YARDS.length} yards in four rows`);
}
{
  // spread the packed bank to the river's full width
  const a = YARDS[0], z = YARDS.at(-1);
  const from = RXS + a.slot / 2, to = RXE - z.slot / 2;
  const f = YARDS.length > 1 ? (to - from) / (z.cx - a.cx) : 1;
  for (const y of YARDS) y.cx = from + (y.cx - a.cx) * f;
}
const rowTop = (r) => NB_TOP + (ROWS - 1 - r) * ROW_H;
const rectY = (r) => rowTop(r) + LABEL_H + 6;
for (const y of YARDS) { y.x = y.cx - y.w / 2; y.y = rectY(y.row); }
const RT = rectY(0) + YH + 66;
assertPlots('sheet 14', YARDS.flatMap((y) => [
  { n: y.i, name: y.name, part: 'yard', x: y.x, y: y.y, w: y.w, d: YH },
  { n: y.i, name: y.name, part: 'lettering', x: y.cx - y.slot / 2, y: rowTop(y.row), w: y.slot, d: LABEL_H },
]));

// THE RIVER — every consignment a crate at its day, stacked where days crowd
const RIV_T = RT, RIV_B = RT + 26 + RLANES * LP;
for (const c of DRAWN) c.y = RIV_T + 26 + c.lane * LP;
assertPlots('sheet 14', DRAWN.map((c) => ({ n: `c${c.n}`, name: `${c.yard}#${c.number}`, part: 'crate', x: c.x - CR, y: c.y - CR - 9, w: CR + BADGE_DX + badgeW(c), d: 2 * CR + 9 })));

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
const RELEASE = /^Release\b/;
for (const r of RETURNS) { r.release = r.kind === 'pr' && RELEASE.test(r.title ?? ''); r.label = r.ref; r.w = r.release ? 6 : tw(r.label, 'lbls') + 10; r.x = X(r.t); }
const RELEASES = RETURNS.filter((r) => r.release).length;
const WLANES = lanes(RETURNS, (r) => [r.x - r.w / 2, r.x + r.w / 2]);
for (const r of RETURNS) r.y = WY + 14 + r.lane * (RB_H + 8);
const WH = 14 + WLANES * (RB_H + 8) + 6;
assertPlots('sheet 14', RETURNS.map((r) => ({ n: r.key, name: r.label, part: 'return', x: r.x - r.w / 2, y: r.y, w: r.w, d: RB_H })));

// ---- drawing ----------------------------------------------------------------------
// state is the fill; a sent consignment flies the city's pennant from its west edge
const pennant = (x, y) => `<line x1="${(x - CR).toFixed(1)}" y1="${(y - 4).toFixed(1)}" x2="${(x - CR).toFixed(1)}" y2="${(y - CR - 9).toFixed(1)}" class="sk"/><polygon points="${(x - CR).toFixed(1)},${(y - CR - 9).toFixed(1)} ${(x - CR + 8).toFixed(1)},${(y - CR - 6.5).toFixed(1)} ${(x - CR).toFixed(1)},${(y - CR - 4).toFixed(1)}" class="fa"/>`;
// tracked: a home item labelled `external` cites it — a red tag on the crate's north-east corner
const tag = (x, y) => `<polygon points="${x.toFixed(1)},${(y - 4).toFixed(1)} ${(x + 4).toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${(y + 4).toFixed(1)} ${(x - 4).toFixed(1)},${y.toFixed(1)}" class="fr"/>`;
const glyphOf = (kind, fate, x, y) => {
  const cls = fate === 'landed' ? 'sk fi' : fate === 'missing' ? 'sks fp' : 'sk fp';
  const dash = fate === 'open' ? ' stroke-dasharray="2.5 2"' : fate === 'missing' ? ' stroke-dasharray="1 2"' : '';
  if (kind === 'pr') return `<rect x="${(x - CR).toFixed(1)}" y="${(y - 5).toFixed(1)}" width="${2 * CR}" height="10" class="${cls}"${dash}/>`;
  if (kind === 'issue') return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${CR - 1}" class="${cls}"${dash}/>`;
  const pts = [0, 1, 2, 3, 4, 5].map((k) => {
    const a = (Math.PI / 3) * k;
    return `${(x + CR * Math.cos(a)).toFixed(1)},${(y + CR * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${pts}" class="${cls}"${dash}/>`;
};

// lettering stands on a paper placard, so a pier from a farther row passes behind it
const placard = (cx, top, rows) => {
  const w = Math.max(...rows.map(([s, c]) => tw(s, c))) * 1.08 + 10;
  return `<rect x="${(cx - w / 2).toFixed(1)}" y="${(top - 10).toFixed(1)}" width="${w.toFixed(1)}" height="${rows.length * LINE + 1}" class="fp"/>`;
};
const piers = YARDS.filter((y) => y.cons.length)
  .map((y) => `<line x1="${y.cx.toFixed(1)}" y1="${(y.y + YH).toFixed(1)}" x2="${y.cx.toFixed(1)}" y2="${RT}" class="sk"/>`).join('\n');
const yardSvg = YARDS.map((y) => {
  const x = y.x.toFixed(1), w = y.w.toFixed(1), yy = y.y.toFixed(1);
  const mass = y.host === 'bugzilla'
    ? `<rect x="${x}" y="${yy}" width="${w}" height="${YH}" class="sks fp" stroke-dasharray="4 3"/>`
    : `<rect x="${x}" y="${yy}" width="${w}" height="${YH}" class="fp2"/><rect x="${x}" y="${yy}" width="${w}" height="${YH}" fill="url(#${P}-hx)"/><rect x="${x}" y="${yy}" width="${w}" height="${YH}" class="sk fnone"/>`;
  const top = rowTop(y.row) + 10 + (4 - y.lines.length) * LINE;
  const label = y.lines.map(([s, c], i) => txt(y.cx.toFixed(1), top + i * LINE, s, c, 'middle')).join('\n');
  return `${mass}\n${placard(y.cx, top, y.lines)}\n${label}`;
}).join('\n');

const BX0 = Math.min(...BERTHS.map((b) => b.x)), BX1 = Math.max(...BERTHS.map((b) => b.x + b.w));
const BY = rectY(0) + YH;
const engineNote = BERTHS.length ? `
<line x1="${BX0.toFixed(1)}" y1="${BY + 10}" x2="${BX1.toFixed(1)}" y2="${BY + 10}" class="skf"/>
${txt(BX1.toFixed(1), BY + 26, `the main lane's ${ENGINE_TASKS.join(', ')}`, 'lblf', 'end')}
${txt(BX1.toFixed(1), BY + 39, `runs on ${BERTHS.length === 1 ? 'this engine' : `these ${word(BERTHS.length)} engines`},`, 'lblf', 'end')}
${txt(BX1.toFixed(1), BY + 52, `in ${plural(ENGINE_PKGS.length, 'package')}`, 'lblf', 'end')}` : '';

const yardOf = (c) => YARDS.find((y) => y.id === c.yard);
const moorings = DRAWN.map((c) => {
  const y = yardOf(c);
  return `<line x1="${y.cx.toFixed(1)}" y1="${RT}" x2="${c.x.toFixed(1)}" y2="${(c.y - CR).toFixed(1)}" class="sks"/>`;
}).join('\n');

const roads = RETURNS.flatMap((r) => r.from.filter((c) => c.fate !== 'missing').map((c) =>
  arrow(P, `M${c.x.toFixed(1)},${(c.y + CR).toFixed(1)} L${r.x.toFixed(1)},${(r.y - 2).toFixed(1)}`, 'as', 'skf'))).join('\n');

const crates = DRAWN.map((c) => `${c.sent ? pennant(c.x, c.y) : ''}${glyphOf(c.kind, c.fate, c.x, c.y)}${c.tracked ? tag(c.x + CR, c.y - CR) : ''}
${txt((c.x + BADGE_DX).toFixed(1), (c.y + 3.6).toFixed(1), String(c.n), 'lbls')}`).join('\n');

const mouth = OFF.length ? `<line x1="${MOUTH_X1}" y1="${RIV_T}" x2="${MOUTH_X1}" y2="${RIV_B}" class="sks" stroke-dasharray="3 3"/>
${txt(((RXS + MOUTH_X1) / 2).toFixed(1), RIV_B + 19, 'earlier', 'lblf', 'middle')}` : '';

const river = `<rect x="${RXS}" y="${RIV_T}" width="${RXE - RXS}" height="${RIV_B - RIV_T}" class="fp2"/>
<line x1="${RXS}" y1="${RIV_T}" x2="${RXE}" y2="${RIV_T}" class="sk"/>
<line x1="${RXS}" y1="${RIV_B}" x2="${RXE}" y2="${RIV_B}" class="sk"/>
${arrow(P, `M${RX1 - 60},${RIV_B - 8} L${RX1 + 12},${RIV_B - 8}`, 'as', 'sks')}
${txt(RX1 - 66, RIV_B - 4.5, 'TIME', 'lblf', 'end')}
${mouth}
${months.map((t) => {
    const x = X(t).toFixed(1);
    const lab = new Date(t).toISOString().slice(2, 7).replace(/^/, "'");
    return `<line x1="${x}" y1="${RIV_B}" x2="${x}" y2="${RIV_B + 6}" class="sk"/>${txt(x, RIV_B + 19, lab, 'lblf', 'middle')}`;
  }).join('\n')}`;

const wharf = `<rect x="${RXS}" y="${WY}" width="${RXE - RXS}" height="${WH}" class="sk fp"/>
${RETURNS.map((r) => (r.release
    ? `<rect x="${(r.x - r.w / 2).toFixed(1)}" y="${r.y}" width="${r.w}" height="${RB_H}" class="sks fp2"/>`
    : `<rect x="${(r.x - r.w / 2).toFixed(1)}" y="${r.y}" width="${r.w.toFixed(1)}" height="${RB_H}" class="sk fp2"/>
${txt(r.x.toFixed(1), r.y + 11.8, r.label, 'lbls', 'middle')}`) + (r.external ? tag(r.x + r.w / 2, r.y) : '')).join('\n')}`;

const BANK_X = 40;
const banks = `
${txt(BANK_X, rectY(0) + 10, 'NORTH BANK', 'lblb')}
${txt(BANK_X, rectY(0) + 24, 'the commons', 'lblf')}
${txt(BANK_X, (RIV_T + RIV_B) / 2 - 3, 'THE RIVER', 'lblb')}
${txt(BANK_X, (RIV_T + RIV_B) / 2 + 11, 'time, west → east', 'lblf')}
${txt(BANK_X, WY + 14, 'SOUTH BANK', 'lblb')}
${txt(BANK_X, WY + 28, 'the city’s wharf', 'lblf')}`;

// ---- schedule ---------------------------------------------------------------------
const COL = { yard: 160, kind: 330, num: 372, author: 440, sent: 560, title: 630, state: 1170, ret: 1230 };
const TITLE_W = COL.state - COL.title - 14;
const SY = WY + WH + 40;
const ROWH = 17;
const schedRow = (c, y) => {
  const y0 = yardOf(c);
  return [
    schedTxt(58, y, [c.n, c.createdAt ? day(c.createdAt) : '—'], 'lbls'),
    txt(COL.yard, y, fit(work(y0), COL.kind - COL.yard - 10), 'lbls'),
    txt(COL.kind, y, KIND_SHORT[c.kind], 'lbls'),
    txt(COL.num, y, `#${c.number}`, 'lbls'),
    txt(COL.author, y, fit(c.author?.login ?? '—', COL.sent - COL.author - 10), 'lbls'),
    txt(COL.sent, y, c.sent ? 'SENT' : 'WATCHED', c.sent ? 'lbla' : 'lbls'),
    txt(COL.title, y, fit(c.title, TITLE_W), 'lbls'),
    txt(COL.state, y, c.state, c.fate === 'landed' ? 'lbl' : 'lbls'),
    txt(COL.ret, y, c.home.length ? fit(`→ ${c.home.map((r) => r.ref).join(', ')}`, RXE - 10 - COL.ret) : '—', 'lbls'),
  ].join('');
};
const OFF_HEAD = OFF.length
  ? `CITED FROM BEFORE THE FIRST COMMIT (${day(SINCE)}) — ${nplural(OFF.length, 'item')}, filed ${day(OFF.find((c) => c.createdAt)?.createdAt ?? '—')} to ${day(OFF.findLast((c) => c.createdAt)?.createdAt ?? '—')}, drawn in the river's west mouth`
  : '';
const GONE_HEAD = GONE.length ? `NO LONGER READABLE UPSTREAM — ${nplural(GONE.length, 'item')} the city cites, drawn nowhere on the river` : '';
const OFF_Y = SY + 52 + CONS.length * ROWH + 8;
const GONE_Y = OFF_Y + (OFF.length ? (OFF.length + 1) * ROWH + 14 : 0);
const SH = 74 + CONS.length * ROWH + (OFF.length ? 8 + (OFF.length + 1) * ROWH + 6 : 0) + (GONE.length ? 8 + (GONE.length + 1) * ROWH + 6 : 0);
const schedule = `<rect x="40" y="${SY}" width="${RXE - 40}" height="${SH}" class="sk fp"/>
${txt(58, SY + 22, 'CONSIGNMENT SCHEDULE — date filed · work · kind · number in its tracker · author · sent or watched · title · state · returns home', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="${RXE}" y2="${SY + 32}" class="skf"/>
${CONS.map((c, i) => schedRow(c, SY + 52 + i * ROWH)).join('\n')}
${OFF.length ? `<line x1="58" y1="${OFF_Y - 6}" x2="${RXE - 18}" y2="${OFF_Y - 6}" class="skf"/>
${txt(58, OFF_Y + 10, OFF_HEAD, 'lbls')}
${OFF.map((c, i) => schedRow(c, OFF_Y + 10 + (i + 1) * ROWH)).join('\n')}` : ''}
${GONE.length ? `<line x1="58" y1="${GONE_Y - 6}" x2="${RXE - 18}" y2="${GONE_Y - 6}" class="skf"/>
${txt(58, GONE_Y + 10, GONE_HEAD, 'lbls')}
${GONE.map((c, i) => schedRow(c, GONE_Y + 10 + (i + 1) * ROWH)).join('\n')}` : ''}
${txt(58, SY + SH - 16, `TOTAL — ${nplural(EVERY.length, 'consignment')} · ${fmt(SENT)} sent, ${fmt(WATCHED)} watched, ${fmt(TRACKED)} tracked · ${nplural(BYKIND.pr, 'PR')} · ${nplural(BYKIND.issue, 'issue')} · ${nplural(BYKIND.bug, 'bug')} · ${LANDED} merged or fixed, ${CLOSED} closed, ${OPEN} open${MISSING ? `, ${MISSING} missing` : ''} · ${nplural(RETURNS.length, 'block')} on the wharf · window ${day(SINCE)} → ${day(UNTIL)} · ${BASIS}`, 'lbls')}`;

// ---- assemble ---------------------------------------------------------------------
const H = SY + SH + 30;
const yardsWord = plural(WORKS.length, 'work');
const consWord = plural(EVERY.length, 'consignment');
export const SHEET14_VERDICT = `${nplural(EVERY.length, 'consignment')} to ${nplural(WORKS.length, 'work')}, ${fmt(SENT)} sent and ${fmt(WATCHED)} watched, ${fmt(TRACKED)} tracked, ${fmt(RETURNED)} returned home`;

const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="A plan map of the open-source commons around lit-ui-router, drawn as a river of time. A river band runs west to east across the plate from ${day(SINCE)}, the repository's first commit, to ${day(UNTIL)}, with month ticks lettered along its south bank. On the north bank stand ${plural(YARDS.length, 'yard')}${ROWS > 1 ? ` in ${plural(ROWS, 'row')}` : ''}, one per upstream work, in the order of their first consignment; a yard's footprint grows with the logarithm of its GitHub stars, and ${BERTHS.length ? `${plural(BERTHS.length, 'browser bug tracker')}, ${BERTHS.map((b) => b.name).join(' and ')}, stand at the east end as dashed berths at the minimum footprint, each lettered ${BERTHS.map((b) => `${nplural(b.cons.length, 'report')} filed`).join(' and ')}` : 'no bug tracker stands among them'}. On the river float ${consWord} the city's own record cites, each a crate at the day it was filed and moored by a line to its yard: a rectangle for a pull request, a circle for an issue, a hexagon for a bug report; filled in ink where it merged, outlined where it closed, dashed where it stands open. ${fmt(SENT)} fly the city's accent pennant, filed by one of its own committers; ${fmt(WATCHED)} fly none, filed by someone else and watched; ${fmt(TRACKED)} wear a red tag, cited by a home item labelled external.${OFF.length ? ` ${cap(plural(OFF.length, 'crate'))} older than the first commit ${OFF.length === 1 ? 'stands' : 'stand'} in the river's west mouth, off the time axis.` : ''} On the south bank the city's wharf carries ${plural(RETURNS.length, 'block')}, one per home pull request, issue or commit that cites a consignment, and a faint road with an arrowhead crosses the river from each consignment to each of its returns${MOST && MOST.home.length > 1 ? `; the roads from ${yardOf(MOST).name} #${MOST.number} cross ${times(MOST.home.length)}` : ''}. A schedule below lists every consignment.">
${defs(P)}

<rect x="40" y="24" width="640" height="42" class="skf fnone"/>
${txt(52, 41, 'THE UPSTREAM WORKS — WHAT THE CITY SENDS AND WATCHES ACROSS THE RIVER, AND WHAT COMES HOME', 'lbls')}
${txt(52, 56, 'north bank, the works the city builds on · the river, time · south bank, the city', 'lblf')}

${txt(RXE, 34, `TIME RUNS EAST — ${day(SINCE)}, the first commit, to ${day(UNTIL)} · one crate per consignment, at the day it was filed`, 'lbls', 'end')}
${txt(RXE, 48, `yard footprint grows with log₁₀ of stars · ★ GitHub stars · npm downloads per week · ${BASIS}`, 'lblf', 'end')}
${txt(RXE, 62, 'pennant = sent by the city · a road across the river = a return: a home PR, issue or commit that cites it', 'lblf', 'end')}

${river}
${moorings}
${roads}
${crates}
${piers}
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
  sub: `ALTITUDE 14 — the city among the commons it builds on · ${consWord} to ${yardsWord} cited by the city's own record, ${fmt(SENT)} sent and ${fmt(WATCHED)} watched, ${fmt(TRACKED)} tracked, ${fmt(RETURNED)} returned home, ${fmt(OFF_RIVER)} off the river${GONE.length ? ` (${fmt(GONE.length)} missing)` : ''} · ${BASIS}`,
  scale: 'CITY × COMMONS',
  form: 'UPSTREAM WORKS',
  svg,
  caption: `Every other sheet draws the city; this one draws the commons the city's own record cites. Across a river of time from the first commit, ${consWord} — pull requests, issues and bug reports in other projects' trackers — sit at the day they were filed, moored to the works on the north bank; the ${fmt(SENT)} the city sent fly its pennant and the ${fmt(WATCHED)} it watches fly none, and roads cross back to the ${plural(RETURNS.length, 'home pull request, issue or commit', 'home pull requests, issues and commits')} that cite them on the city's wharf.`,
  notes: `
<p><strong>Method — one probe, one plate.</strong> Every figure on this sheet is read at build time from <code>www/atlas.lit-ui-router.dev/data/census-upstream.json</code>, ${BASIS}. The probe reads the city's own record — this repository's pull requests, issues, comments, reviews and commit messages, bot text excluded — and files every issue or pull request in another GitHub project, and every bug on the browser engines' Bugzillas, that the record cites. A <em>consignment</em> is one of those cited items. It is <em>sent</em> when its author is one of the city's own committers, and <em>watched</em> when someone else filed it and the city follows it. A <em>return</em> is a pull request, issue or commit of this repository that cites a consignment: the place the upstream work comes back into the city. The city points at an upstream item deliberately with its <code>external</code> label — “cites or tracks an issue or PR in another project, outside this repository's scope” — and a consignment is <em>tracked</em> when a home item carrying that label cites it. Stars and weekly npm downloads are read from GitHub and the npm registry for each work the plate carries. The berths' note is read from <code>census-plate.json</code>, the ci graph plate: the packages whose <code>ci:main</code> graph runs a real ${ENGINE_TASKS.map((t) => `<code>${t}</code>`).join(', ')} task.</p>
<p><strong>The river is time.</strong> The river's x axis runs from ${day(SINCE)}, the first commit, at the west to ${day(UNTIL)} at the east, one tick per calendar month, and every crate and every wharf block sits at its own day: a crate at the day the consignment was filed, a block at the day its return was written. Where days crowd, crates stack across the river and blocks along the wharf, so nothing moves off its date.${OFF.length ? ` A cited item filed before the first commit has no day on the axis: ${OFF.length === 1 ? 'it stands' : `the ${word(OFF.length)} of them stand`} in the river's west mouth, west of a dashed line, and the schedule lists ${OFF.length === 1 ? 'it' : 'them'} under their own heading.` : ''} The yards on the north bank stand in the order of their first consignment, not by size, so the bank reads west to east in the same order as the river${ROWS > 1 ? `, in ${plural(ROWS, 'row')} where one row cannot hold them` : ''}; a yard's footprint grows with the base-ten logarithm of its stars. A crate's shape is its kind and its fill its state: ink where it merged or was fixed, an outline where it closed unmerged, a dashed outline where it stands open. A sent crate flies the city's pennant in the accent colour; a watched crate flies none. A tracked crate, and a wharf block whose item carries the <code>external</code> label, wear a red tag on the north-east corner.</p>
<p><strong>What the plate reads.</strong> ${cap(consWord)} to ${yardsWord}: ${nplural(BYKIND.pr, 'pull request')}, ${nplural(BYKIND.issue, 'issue')} and ${nplural(BYKIND.bug, 'bug report')}. ${fmt(SENT)} sent and ${fmt(WATCHED)} watched${AUTHORS.length ? `, the watched filed by ${nplural(AUTHORS.length, 'other author')}` : ''}. ${cap(plural(LABELLED, 'home item'))} ${LABELLED === 1 ? 'carries' : 'carry'} the <code>external</code> label, so ${plural(TRACKED, 'consignment')} ${TRACKED === 1 ? 'is' : 'are'} tracked. ${fmt(LANDED)} merged or fixed, ${fmt(CLOSED)} closed and ${fmt(OPEN)} open${MISSING ? `, and ${plural(MISSING, 'item')} the city cites ${MISSING === 1 ? 'is' : 'are'} no longer readable upstream, listed in the schedule and drawn nowhere on the river` : ''}. ${topLine}. ${RETURNED === EVERY.length ? `Every consignment has come home: the plate holds only what the city's record cites` : `${fmt(RETURNED)} of the ${fmt(EVERY.length)} have come home`}${EVERY.length - RETURNED ? `, and ${nplural(EVERY.length - RETURNED, 'consignment')} ${EVERY.length - RETURNED === 1 ? 'has' : 'have'} no return: ${EVERY.filter((c) => !c.home.length).map((c) => `${work(yardOf(c))} #${c.number}`).join(', ')}` : ''}. The wharf holds ${plural(RETURNS.length, 'block')} for ${plural(ITEMS.size, 'home item')} — ${nplural(ITEM_KINDS.pr, 'pull request')} and ${nplural(ITEM_KINDS.issue, 'issue')}${ITEM_KINDS.commit ? `, and ${nplural(ITEM_KINDS.commit, 'commit')} lettered by sha` : ''}${RELEASES ? `; ${plural(RELEASES, 'block')} ${RELEASES === 1 ? 'is a release pull request, drawn' : 'are release pull requests, drawn'} as a narrow unlettered post` : ''}. A squash commit whose subject ends in a pull request's number folds into that pull request's block when the same consignment cites both: ${nplural(FOLDED, 'commit')} ${FOLDED === 1 ? 'folds' : 'fold'} this way. ${MOST ? `${work(yardOf(MOST))} #${MOST.number} comes home the most, ${times(MOST.home.length)}, from ${day(MOST.home[0].date)} to ${day(MOST.home.at(-1).date)}` : ''}${CITED && CITED.from.size > 1 && !CITED.tied ? `; ${CITED.ref}, ${CITED.title}, cites ${plural(CITED.from.size, 'consignment')}, the most of any home item` : ''}.${EARLY.length ? ` A return is dated by the citing text's own day, so a road can run west: ${EARLY.map(([c, r]) => `${r.ref} (${day(r.date)}) cites ${work(yardOf(c))} #${c.number} (${day(c.createdAt)})`).join('; ')} — in each the home text is the older one, and the upstream filing is named in it.` : ''}</p>
${BERTHS.length ? `<p><strong>The berths.</strong> ${BERTHS.map((b) => `${b.name} (${b.id}) reads ${nplural(b.cons.length, 'report')} filed`).join(', and ')}. They stand on the bank because the suite runs on these engines: ${ENGINE_TASKS.map((t) => `<code>${t}</code>`).join(', ')} is a real task in ${plural(ENGINE_PKGS.length, 'package')} of the <code>ci:main</code> graph — ${ENGINE_PKGS.map((p) => `<code>${p}</code>`).join(', ')}.</p>` : ''}`,
  key: [
    keyRow('<rect x="6" y="3" width="36" height="12" class="fp2"/><rect x="6" y="3" width="36" height="12" fill="url(#s14-hx)"/><rect x="6" y="3" width="36" height="12" class="sk fnone"/>', 'yard — one upstream work · width grows with log₁₀ stars'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="sks fnone" stroke-dasharray="4 3"/>', 'berth — a browser bug tracker'),
    keyRow('<rect x="17" y="7" width="14" height="10" class="sk fi"/>', 'pull request, merged'),
    keyRow('<circle cx="24" cy="10" r="6" class="sk fp"/>', 'issue, closed'),
    keyRow('<circle cx="24" cy="10" r="6" class="sk fp" stroke-dasharray="2.5 2"/>', 'open — dashed outline, any kind'),
    keyRow('<polygon points="31,10 27.5,16.1 20.5,16.1 17,10 20.5,3.9 27.5,3.9" class="sk fp"/>', 'bug report — a hexagon'),
    keyRow('<line x1="17" y1="12" x2="17" y2="1" class="sk"/><polygon points="17,1 25,3.5 17,6" class="fa"/><circle cx="24" cy="12" r="5" class="sk fp"/>', 'pennant — sent by one of the city’s committers; none — watched'),
    keyRow('<circle cx="22" cy="11" r="6" class="sk fp"/><polygon points="28,1 32,5 28,9 24,5" class="fr"/>', 'tracked — a home item labelled external cites it'),
    keyRow('<rect x="21" y="2" width="6" height="14" class="sks fp2"/>', 'release — a home release PR, unlettered'),
    keyRow('<line x1="24" y1="1" x2="24" y2="17" class="sks"/>', 'mooring — a consignment to its yard'),
    keyRow('<path d="M24,1 L24,15" class="skf" marker-end="url(#s14-as)"/>', 'road — a consignment to a return home'),
    keyRow('<rect x="10" y="2" width="28" height="14" class="sk fp2"/><text x="24" y="13" class="lbls" text-anchor="middle" font-size="9">#N</text>', 'return — a home PR, issue or commit, on the wharf'),
  ].join('\n'),
};
