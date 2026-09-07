import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, schedTxt, keyRow } from './helpers.mjs';
import { PLACED } from './sheet7.mjs';

const P = 's7a';

// ---- the survey: sheet 7's city, metered for test light -------------------------
// The spec annex is the LAMP, covered source is LIT, shadow means UNTESTED.
// Both series come from filed snapshots measured at the same ref, so the meter
// and the census cannot disagree:
//   footprints + annexes — diagrams/data/census-city.json (sheet 7's own plate)
//   cat, extent, line/branch/func, the lit footprint — diagrams/data/census-shadow.json,
//     written by census-shadow.mjs, which materializes the ref, installs it, and
//     meters every member under ITS OWN suite's meter (turbo run test:coverage
//     where the member declares one; node --test --experimental-test-coverage for
//     the node:test members; vitest run --coverage.enabled --coverage.provider=v8
//     for the vitest ones).  Placement, numbering, district and prose are all
//     that is left in this file.
const CITY = JSON.parse(readFileSync(new URL('../data/census-city.json', import.meta.url), 'utf8'));
const SHADOW = JSON.parse(readFileSync(new URL('../data/census-shadow.json', import.meta.url), 'utf8'));
const CITY_ROW = new Map(CITY.rows.map((r) => [r.member, r]));
const SH_ROW = new Map(SHADOW.rows.map((r) => [r.member, r]));
const cityOf = (dir) => {
  const r = CITY_ROW.get(dir);
  if (!r) throw new Error(`plate 7A: member ${dir} is missing from diagrams/data/census-city.json`);
  return r;
};
const shadowOf = (dir) => {
  const r = SH_ROW.get(dir);
  if (!r) throw new Error(`plate 7A: member ${dir} is missing from diagrams/data/census-shadow.json`);
  return r;
};
const BASIS = `metered at ${SHADOW.ref} @ ${SHADOW.sha} (${SHADOW.generatedAtTime.slice(0, 10)})`;
const fmt = (v) => (v == null ? '—' : v.toLocaleString('en-US'));
const pct1 = (h, f) => (f ? ((h / f) * 100).toFixed(1) : '—');

// ---- scale rule — sheet 7's, unchanged ------------------------------------------
const KS = 1.6, MIN = 12;
const S = (sloc) => Math.max(MIN, KS * Math.sqrt(sloc));
const AG = 10;

// ---- plan → screen (plan view: the same city seen from straight above) ----------
const K = 1.15, MX = 132, MY = 128;
const X = (x) => (MX + K * x).toFixed(1);
const Y = (y) => (MY + K * y).toFixed(1);

// ---- brightness bands: how bright the lit part is = line coverage of what the
// suite loaded.  Hue + hatch together: full bright is open halo, paler light
// gains hatch — accent first, red where the light itself is failing.
const BAND = (line) => (line == null ? null : line >= 95 ? 'b1' : line >= 85 ? 'b2' : line >= 70 ? 'b3' : 'b4');
const BANDS = {
  b1: { fill: 'var(--halo)' },      // ≥95% — full bright, open glow
  b2: { fill: `url(#${P}-g2)` },    // 85–95% — bright, faint accent hatch
  b3: { fill: `url(#${P}-g3)` },    // 70–85% — pale, red hatch
  b4: { fill: `url(#${P}-g4)` },    // <70% — guttering, dense red
};
const CAT_BADGE = {
  m: { badge: 'sk fp', num: 'lbl' },    // metered
  e: { badge: 'ska fp', num: 'lbla' },  // e2e light only
  u: { badge: 'sks fp', num: 'lbls' },  // tests run, meter cannot attach
  n: { badge: 'skr fp', num: 'lblr' },  // untested — full shadow
  z: { badge: 'sks fp2', num: 'lbls' }, // no mass
};

// [n, name, dist, cat, x, y, srcFiles, srcSloc, specFiles, specSloc,
//  litFiles, litSloc, extent%, line%, branch%, func%]
// Placement, numbering and district come from sheet 7's PLACED table — the two
// plates overlay building for building because they are the same table; the
// counts come from the two plates.  extent = sloc of the src files the suite
// LOADED ÷ the member's src sloc, both measured at the same ref.
const M = PLACED.map(([n, name, dir, dist, , x, y]) => {
  const c = cityOf(dir), s = shadowOf(dir);
  return [n, name, dist, s.cat, x, y, c.srcFiles, c.srcSloc, c.specFiles, c.specSloc,
    s.litFiles ?? null, s.litSloc ?? null, s.extent ?? null, s.line ?? null, s.branch ?? null, s.func ?? null];
});
const SH = new Map(PLACED.map(([n, , dir]) => [n, shadowOf(dir)]));

// exported: the 3D city lights from THIS survey, so the two lanes cannot drift
export const SURVEY = M.map(([n, , , cat, , , , , , , , , ext, line, branch, func]) =>
  ({ n, cat, ext, line, branch, func }));
// and the plate it was metered at, so the 3D lane's prose cites the same ref
export const SURVEY_META = {
  ref: SHADOW.ref, sha: SHADOW.sha, date: SHADOW.generatedAtTime.slice(0, 10),
  metered: SHADOW.totals.metered, basis: BASIS,
};

const geom = new Map(M.map((r) => {
  const [n, name, dist, cat, x, y, , sl, , pl, , , ext] = r;
  const s = S(sl);
  const sa = pl ? S(pl) : 0;
  const ax = x + s + AG, ay = y + (s - sa) / 2;
  return [n, { n, name, dist, cat, x, y, s, sa, ax, ay, ext, r }];
}));
const g = (n) => geom.get(n);

// The lamp sits east (the annex side); its light reaches a strip of the building
// from the east face inward.  Lit width = side · (sloc the suite loads ÷ src sloc);
// the remainder of the footprint stays in shadow.
function member(n) {
  const b = g(n);
  const { cat, x, y, s, sa, ax, ay } = b;
  const line = b.r[13];
  const R = (px, py, w, h, attrs) => `<rect x="${X(px)}" y="${Y(py)}" width="${(K * w).toFixed(1)}" height="${(K * h).toFixed(1)}" ${attrs}/>`;
  const cone = sa && cat !== 'n'
    ? `<polygon points="${X(ax)},${Y(ay)} ${X(x + s)},${Y(y)} ${X(x + s)},${Y(y + s)} ${X(ax)},${Y(ay + sa)}" class="fhalo"/>`
    : '';
  if (cat === 'z') return R(x, y, s, s, 'class="sks fnone" stroke-dasharray="2 3"');
  if (cat === 'n') {
    // no lamp anywhere — the whole building stands in shadow
    return `${R(x, y, s, s, 'class="sk fp"')}${R(x, y, s, s, `fill="url(#${P}-sh)"`)}${R(x, y, s, s, 'class="sk fnone"')}`;
  }
  if (cat === 'e') {
    // real light from the cypress rig, but no meter reads it — accent wash
    return `${cone}${R(x, y, s, s, 'class="sk fp"')}${R(x, y, s, s, `fill="url(#${P}-se)"`)}
${R(x, y, s, s, 'class="ska fnone" stroke-dasharray="5 4"')}`;
  }
  if (cat === 'u') {
    // tests run but no meter attaches — an outline of light, nothing painted
    const rays = sa
      ? `<line x1="${X(ax)}" y1="${Y(ay)}" x2="${X(x + s)}" y2="${Y(y)}" class="sks" stroke-dasharray="2 4"/>
<line x1="${X(ax)}" y1="${Y(ay + sa)}" x2="${X(x + s)}" y2="${Y(y + s)}" class="sks" stroke-dasharray="2 4"/>` : '';
    return `${rays}${R(x, y, s, s, 'class="sk fp"')}`;
  }
  // metered: lit strip from the lamp side, shadow strip beyond the light's reach
  const e = (b.ext ?? 0) / 100;
  const litW = s * e, shW = s - litW;
  // happy-dom's lamp is lit but pointed elsewhere — no cone, all shadow
  const lamp = b.ext === 0 ? '' : cone;
  const lit = litW > 0 ? R(x + shW, y, litW, s, `fill="${BANDS[BAND(line) ?? 'b1'].fill}"`) : '';
  const sh = shW > 0.01 ? R(x, y, shW, s, `fill="url(#${P}-sh)"`) : '';
  const term = litW > 0 && shW > 0.01
    ? `<line x1="${X(x + shW)}" y1="${Y(y)}" x2="${X(x + shW)}" y2="${Y(y + s)}" class="skf"/>` : '';
  return `${lamp}${R(x, y, s, s, 'class="sk fp"')}${lit}${sh}${term}${R(x, y, s, s, 'class="sk fnone"')}`;
}

function furniture(n) {
  const b = g(n);
  const t = CAT_BADGE[b.cat];
  // the annex is the lamp — drawn glowing, not ghosted
  const annex = b.sa
    ? `<rect x="${X(b.ax)}" y="${Y(b.ay)}" width="${(K * b.sa).toFixed(1)}" height="${(K * b.sa).toFixed(1)}" class="sks fhalo"/>`
    : '';
  const lift = BADGE_LIFT[n] ?? 0, dx = BADGE_DX[n] ?? 0;
  const bx = +X(b.x + b.s / 2 + dx), by = +Y(b.y) - 11 - lift;
  return `${annex}
<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="8.5" class="${t.badge}"/>
${txt(bx.toFixed(1), (by + 3.2).toFixed(1), String(n), t.num, 'middle')}`;
}
const BADGE_LIFT = {};
const BADGE_DX = {};

// ---- districts, same bounds rule as sheet 7 (over footprint + annex) ------------
const DIST = [['pkg', 24], ['app', 24], ['site', 24], ['tool', 26]];
const bounds = (d) => {
  const bs = M.filter((r) => r[2] === d).map((r) => g(r[0]));
  return [Math.min(...bs.map((b) => b.x)), Math.min(...bs.map((b) => Math.min(b.y, b.sa ? b.ay : b.y))),
    Math.max(...bs.map((b) => b.x + b.s + (b.sa ? AG + b.sa : 0))), Math.max(...bs.map((b) => Math.max(b.y + b.s, b.sa ? b.ay + b.sa : 0)))];
};
const districts = DIST.map(([d, pad]) => {
  const [x1, y1, x2, y2] = bounds(d);
  return `<rect x="${X(x1 - pad)}" y="${Y(y1 - pad)}" width="${(K * (x2 - x1 + 2 * pad)).toFixed(1)}" height="${(K * (y2 - y1 + 2 * pad)).toFixed(1)}" class="skf fnone" stroke-dasharray="5 4"/>`;
}).join('\n');

const bodies = M.map(([n]) => member(n)).join('\n');
const furn = M.map(([n]) => furniture(n)).join('\n');

// ---- aggregates, all derived from the two plates --------------------------------
const T = SHADOW.totals;
const inCat = (c) => M.filter((r) => r[3] === c).map((r) => r[0]);
const inBand = (k) => M.filter((r) => r[3] === 'm' && BAND(r[13]) === k).map((r) => r[0]);
const dRows = (d) => M.filter((r) => r[2] === d);
const dAgg = (d) => {
  const rows = dRows(d), met = rows.filter((r) => r[3] === 'm');
  const s = (f) => rows.reduce((a, r) => a + f(r), 0);
  const ms = (f) => met.reduce((a, r) => a + f(r), 0);
  return {
    n: rows.length, metered: met.length,
    sloc: s((r) => r[7]), litSloc: ms((r) => r[11] ?? 0), meteredSloc: ms((r) => r[7]),
    lines: ms((r) => SH.get(r[0]).lines ?? 0), linesHit: ms((r) => SH.get(r[0]).linesHit ?? 0),
    branches: ms((r) => SH.get(r[0]).branches ?? 0), branchesHit: ms((r) => SH.get(r[0]).branchesHit ?? 0),
  };
};
const DP = dAgg('pkg'), DA = dAgg('app'), DT = dAgg('tool');
// the yard's habit, counted rather than asserted: source a metered suite never loads
const wrapperSloc = M.filter((r) => r[2] === 'tool' && r[3] === 'm')
  .reduce((a, r) => a + (r[7] - (r[11] ?? 0)), 0);
const darkToolSloc = M.filter((r) => r[2] === 'tool' && (r[3] === 'n' || r[3] === 'u'))
  .reduce((a, r) => a + r[7], 0);
const wrapperFiles = M.filter((r) => r[2] === 'tool' && r[3] === 'm')
  .reduce((a, r) => a + (r[6] - (r[10] ?? 0)), 0);
const numList = (ns) => (ns.length ? `№${ns.join(' ')}` : 'none this survey');

// ---- schedule --------------------------------------------------------------------
const CAT_TEXT = {
  m: 'metered', e: 'e2e light only', u: 'tests run, no meter', n: 'FULL SHADOW — no suite', z: 'no mass',
};
// prose only — every figure in the schedule is computed from the two plates
const NOTE = {
  1: 'in shadow: barrels + interface.ts',
  2: 'whole footprint fully lit',
  3: 'in shadow: the index barrel',
  4: 'all three meters read 100',
  5: 'tests pass · no provider in browser mode',
  6: 'lit only by the cypress rig',
  7: 'lit only by the cypress rig',
  8: 'route table lit (no functions to meter)',
  9: 'the rig itself — its sloc are support code',
  10: 'worker lit · the site sees only e2e light',
  11: 'stackblitz copies — never lit',
  12: 'cores lit, CLI wrappers in shadow',
  13: 'builds the API pages, tests nothing',
  14: 'no self-suite — it IS the d.ts test',
  15: '3 wrappers in shadow, the cores lit',
  16: 'palest: exec.ts and workspace.ts',
  17: 'trigger wrapper in shadow',
  18: 'size probe, advisory, unlit',
  19: 'ranges.ts lit; six CI lanes unmetered',
  20: 'the check lane, lit by its own suite',
  21: 'config only',
  22: 'wrapper only',
  23: 'harness for the vitest suites — borrowed light',
  24: 'wrapper only',
  25: 'rebase.ts lit · CLI wrapper in shadow',
  26: 'canary lights happy-dom, not append.ts',
  27: 'ambient types — nothing to light',
  28: 'the element lane — no suite of its own',
  29: 'the ratchet core, metered clean',
  30: 'a one-line parser shim — nothing to light',
  31: 'vendored rules, lit wall to wall',
  32: 'reserve lit — driver + CLI in shadow',
};
const ART_H = 866;
const SY = ART_H + 16;
const pctS = (v) => (v == null ? '—' : `${v}%`);
const schedRow = ([n, name, , cat, , , sf, sl, , , lf, ls, ext, line, br, fn]) => {
  const meat = cat === 'm'
    ? `${lf}/${sf}f · ${fmt(ls)}/${fmt(sl)} (${pctS(ext)}) · L ${pctS(line)} B ${pctS(br)} F ${pctS(fn)}`
    : CAT_TEXT[cat];
  return [n, `${name} — ${meat} · ${NOTE[n]}`];
};
const half = Math.ceil(M.length / 2);
const TOTAL_LINE = `TOTAL — ${T.metered} members metered: ${fmt(T.linesHit)} of ${fmt(T.lines)} metered lines lit (${pct1(T.linesHit, T.lines)}%)`
  + ` · branches ${fmt(T.branchesHit)}/${fmt(T.branches)} (${pct1(T.branchesHit, T.branches)}%)`
  + ` · functions ${fmt(T.funcsHit)}/${fmt(T.funcs)} (${pct1(T.funcsHit, T.funcs)}%)`
  + ` · lit extent ${fmt(T.litSloc)}/${fmt(T.meteredSrcSloc)} sloc (${pct1(T.litSloc, T.meteredSrcSloc)}%) · ${BASIS}`;
const schedule = `<rect x="40" y="${SY}" width="1480" height="${91 + half * 17}" class="sk fp"/>
${txt(58, SY + 22, 'SHADOW SCHEDULE — per member: files and sloc the suite lights / authored · L line · B branch · F function coverage of the lit files', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1520" y2="${SY + 32}" class="skf"/>
${M.slice(0, half).map((r, i) => schedTxt(58, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${M.slice(half).map((r, i) => schedTxt(800, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${txt(58, SY + 56 + half * 17, TOTAL_LINE, 'lbls')}
${txt(58, SY + 72 + half * 17, `light and footprint are measured at the SAME ref, so no member's meter and its own census can disagree · every figure above is read from diagrams/data/census-shadow.json and diagrams/data/census-city.json`, 'lblf')}`;

const svg = `<svg viewBox="0 0 1560 ${SY + 121 + half * 17}" role="img" aria-label="A plan view of sheet 7's census city — the same ${M.length} workspace members in the same four dashed districts, seen from straight above — where each member's spec annex is drawn as a lamp and the light of its own test suite falls onto the building. The lit strip of every footprint is the share of the member's source its suite actually loads, glowing from the lamp side; how bright that strip reads is the line coverage of what the suite loaded; everything the suite never imports stays in dense shadow hatch. ${T.metered} members are metered in all. The packages district glows nearly wall to wall. In the instrument yard the light is bright but narrow: release, build_and_test, workers-builds and lcov-rebase light their .core.ts files fully and leave their command-line wrapper files in shadow. Members with no suite at all are marked with red badges and stand entirely dark. The two sample-app demos and the Cypress host carry an accent hatch — real light from the end-to-end rig, which no meter reads. One building, tools/happy-dom, has a lit lamp and still stands dark: its canary spec lights happy-dom itself, never its own source. A shadow schedule below gives exact per-member figures.">
${defs(P)}
<defs>
  <!-- shadow must darken in BOTH themes: a black wash (never ink, which is light
       in cyanotype) carrying a faint ink hatch for texture -->
  <pattern id="${P}-sh" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="4" height="4" fill="rgba(0,0,0,0.38)"/>
    <line x1="0" y1="0" x2="0" y2="4" stroke="var(--ink)" stroke-width="1" opacity="0.30"/>
  </pattern>
  <pattern id="${P}-g2" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="5" height="5" fill="var(--halo)"/>
    <line x1="0" y1="0" x2="0" y2="5" stroke="var(--accent)" stroke-width="1" opacity="0.45"/>
  </pattern>
  <pattern id="${P}-g3" width="5.5" height="5.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="5.5" height="5.5" fill="var(--halo)"/>
    <line x1="0" y1="0" x2="0" y2="5.5" stroke="var(--red)" stroke-width="1.1" opacity="0.7"/>
  </pattern>
  <pattern id="${P}-g4" width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="3.5" stroke="var(--red)" stroke-width="1"/>
  </pattern>
  <pattern id="${P}-se" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
    <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" stroke-width="1" opacity="0.55"/>
  </pattern>
</defs>

<rect x="40" y="26" width="628" height="42" class="skf fnone"/>
${txt(52, 43, 'THE SHADOW SURVEY — WHO STANDS IN TEST LIGHT, AND WHAT STAYS DARK', 'lbls')}
${txt(52, 58, 'sheet 7’s city from straight above · every lamp is a spec annex · the light is a plate, metered at the census’s own ref', 'lblf')}

${txt(1520, 34, 'LIGHT RULE — lit strip = side · (sloc the suite loads ÷ src sloc), from the lamp side · brightness = line coverage of what it loads', 'lbls', 'end')}
${txt(1520, 48, 'footprints and annexes are sheet 7’s census, unchanged · a file the suite never imports stays in shadow — darkness is data', 'lblf', 'end')}
${txt(1520, 62, 'e2e light (cypress) is drawn, not metered — no lcov leaves the rig · the tests are the light, shadow is what no suite loads', 'lblf', 'end')}

<!-- brightness ladder -->
<rect x="1128" y="96" width="392" height="214" class="skf fnone"/>
${txt(1144, 118, 'BRIGHTNESS — LINE COVERAGE OF WHAT THE SUITE LIGHTS', 'lbls')}
${[
  ['var(--halo)', 'sk', '', `≥ 95% — full bright · ${numList(inBand('b1'))}`],
  [`url(#${P}-g2)`, 'sk', '', `85–95% — bright · ${numList(inBand('b2'))}`],
  [`url(#${P}-g3)`, 'skr', '', `70–85% — pale · ${numList(inBand('b3'))}`],
  [`url(#${P}-g4)`, 'skr', '', `below 70% — guttering · ${numList(inBand('b4'))}`],
  [`url(#${P}-se)`, 'ska', '5 4', `e2e light — real, unmetered · ${numList(inCat('e'))}`],
  ['none', 'sks', '2 4', `tests run, no meter attaches · ${numList(inCat('u'))}`],
  [`url(#${P}-sh)`, 'sk', '', 'SHADOW — source no suite ever loads'],
].map(([fill, edge, dash, label], i) => {
  const y = 138 + i * 22;
  return `<rect x="1144" y="${y}" width="34" height="14" fill="${fill}"/><rect x="1144" y="${y}" width="34" height="14" class="${edge} fnone" ${dash ? `stroke-dasharray="${dash}"` : ''}/>
${txt(1192, y + 11, label, edge === 'skr' ? 'lblr' : edge === 'ska' ? 'lbla' : 'lbls')}`;
}).join('\n')}

${districts}
${bodies}
${furn}

<!-- district lettering + aggregates -->
${txt(140, 348, 'packages/ — THE PRODUCT', 'lblb')}
${txt(140, 360, `lit ${pct1(DP.litSloc, DP.meteredSloc)}% of metered district sloc · ${pct1(DP.linesHit, DP.lines)}% of ${fmt(DP.lines)} metered lines`, 'lblf')}
${txt(140, 372, `branches ${pct1(DP.branchesHit, DP.branches)}% · the annexes sheet 7 drew at 1.5–3.9× bought this glow`, 'lblf')}
<line x1="150" y1="336" x2="160" y2="326" class="skf"/>

${txt(1096, 372, 'apps/ — THE PROVING GROUND', 'lblb', 'end')}
${txt(1096, 385, `${DA.metered} metered member${DA.metered === 1 ? '' : 's'} · two demos + the rig`, 'lblf', 'end')}
${txt(1096, 397, 'live on e2e light alone · №5 tests pass with no meter', 'lblf', 'end')}

${txt(1146, 560, 'www/ + examples/ — THE SHOPFRONT', 'lblb')}
${txt(1146, 573, `the worker: fully lit — a ${fmt(g(10).r[11])}-sloc sliver of ${fmt(g(10).r[7])}`, 'lblf')}
${txt(1146, 585, `examples: ${fmt(g(11).r[7])} sloc, never lit`, 'lblf')}
<line x1="1140" y1="569" x2="1064" y2="560" class="skf"/>

${txt(96, 852, 'tools/ — THE INSTRUMENT YARD', 'lblb')}
${txt(96, 865, `${DT.metered} metered members: ${pct1(DT.linesHit, DT.lines)}% of ${fmt(DT.lines)} lines lit — the lamps reach ${pct1(DT.litSloc, DT.sloc)}% of the yard’s ${fmt(DT.sloc)} sloc`, 'lblf')}
${txt(96, 877, 'the habit, visible from the air: every .core.ts lit, every CLI wrapper left in shadow', 'lblf')}
<line x1="140" y1="840" x2="152" y2="826" class="skf"/>

<!-- callouts -->
${txt(620, 82, `№1 lit-ui-router — ${pctS(g(1).r[12])} of the footprint lit, ${pctS(g(1).r[13])} bright`, 'lbla')}
${txt(620, 94, `in shadow: ${g(1).r[6] - g(1).r[10]} files, ${fmt(g(1).r[7] - g(1).r[11])} sloc — the barrels`, 'lblf')}
${txt(620, 106, 'and interface.ts, which is type declarations', 'lblf')}
<line x1="612" y1="110" x2="305" y2="136" class="skf"/>

${txt(1144, 322, '№5 sample-app-shared — an outline of light:', 'lbls')}
${txt(1144, 335, 'its unit tests pass, but browser-mode vitest cannot', 'lblf')}
${txt(1144, 347, 'load a meter the repo never installed', 'lblf')}
<line x1="1138" y1="330" x2="1032" y2="270" class="skf"/>

${txt(30, 430, '№26 happy-dom — a lamp, and NO light on itself:', 'lblr')}
${txt(30, 442, 'its canary spec lights happy-dom’s ordering', 'lblf')}
${txt(30, 454, `bug, never its own append.ts — 0 of ${g(26).r[7]} sloc;`, 'lblf')}
${txt(30, 466, 'those lines are lit from №1’s lamp instead', 'lblf')}
<line x1="250" y1="474" x2="272" y2="522" class="skf"/>

${txt(863, 724, '№12 @tools/release — the yard in one building:', 'lblr')}
${txt(863, 737, `${g(12).r[10]} files lit at ${pctS(g(12).r[13])} bright; ${g(12).r[6] - g(12).r[10]} in shadow, ${fmt(g(12).r[7] - g(12).r[11])} sloc —`, 'lblf')}
${txt(863, 749, 'the publish halt is lit at its core', 'lblf')}
${txt(863, 761, 'and dark at its process edge', 'lblf')}
<line x1="857" y1="742" x2="240" y2="700" class="skf"/>

${txt(700, 852, `№16 @tools/shared — the palest light thrown: ${pctS(g(16).r[13])} line, ${pctS(g(16).r[15])} function`, 'lblr')}
${txt(700, 865, 'exec.ts and workspace.ts are the worst-lit things that are lit at all', 'lblf')}
<line x1="694" y1="850" x2="166" y2="772" class="skf"/>

<!-- verdict -->
<rect x="1128" y="382" width="392" height="118" class="sk fp"/>
${txt(1144, 404, 'VERDICT', 'lblb')}
${txt(1144, 424, 'The light reaches wall to wall in packages/:', 'lbls')}
${txt(1144, 438, `${pct1(T.linesHit, T.lines)}% of ${fmt(T.lines)} metered lines lit, and the`, 'lbls')}
${txt(1144, 452, 'product district has no dark corner.', 'lbls')}
${txt(1144, 466, `What never sees light: ${fmt(darkToolSloc)} sloc of untested`, 'lbls')}
${txt(1144, 480, `instruments and ${fmt(wrapperSloc)} sloc of CLI wrappers.`, 'lbls')}

${schedule}
</svg>`;

export const sheet7a = {
  num: '7A', id: 'shadow', rev: 'E',
  title: 'THE SHADOW SURVEY',
  sub: `ALTITUDE 3½ — ALTERNATE PLATE TO SHEET 7: the measured city under its own test light · same city as sheet 7, ${M.length} members · reach = the source each suite loads, brightness = line coverage of what it loads · ${BASIS}`,
  scale: 'WHOLE WORKSPACE',
  form: 'SHADOW PLAN',
  svg,
  caption: 'Sheet 7 counted who lives in the city; this plate asks which of them ever stand in test light. Every member’s own suite is run under a coverage meter, and its light drawn to two rules: reach is how much of the member’s source the suite actually loads, brightness is the line coverage of what it loads. What the suite never imports stays in shadow — and the finding is a repo-wide habit visible from the air: the light is bright far more often than it is wide. Where a suite reaches, it burns near-full; what it never touches is simply dark.',
  notes: `
<p><strong>Method — one meter per member, nothing installed by hand, nothing left behind.</strong> Footprints, annexes and districts are sheet 7's own plate (<code>census-city.json</code>); the light is <code>census-shadow.json</code>, ${BASIS}, so meter and census read one tree at one ref. ${T.metered} of the ${M.length} members carry a meter. The probe never edits a repo file: members that declare <code>test:coverage</code> are metered by the tree's own unmodified <code>turbo run test:coverage</code>; <code>node:test</code> members by their own <code>test</code> script re-run with <code>--experimental-test-coverage</code> and the lcov reporter; the <code>vitest</code> members by their own script with <code>--coverage.enabled --coverage.provider=v8</code>. Each meter reports lines on its own basis (v8 remaps to executable lines; node counts raw lines), so brightness percentages are per-meter and are never summed across meters in the drawing — only the schedule's grand total does, and says so. LIT means a source file the suite actually executed; extent is those files' sloc over the member's src sloc, both from the same ref. One honest wobble found by re-running the probe four times over: <code>node --test</code>'s branch <em>denominator</em> for №31 came back 213 on two runs and 215 on two more, with 191 hit either way — a 0.9-point swing on one member's branch figure and nothing else in the plate moved. Branch discovery under V8 is not perfectly repeatable, and this plate says so rather than pretending the last run is the only one.</p>
<p><strong>The product glows wall to wall — the budget lands where the house says.</strong> The published packages meter ${pct1(DP.linesHit, DP.lines)}% of ${fmt(DP.lines)} lines over ${pct1(DP.litSloc, DP.meteredSloc)}% of their metered source. What little stays dark is entry barrels and <code>interface.ts</code> — type declarations, which no runtime meter can light. This is the priority made visible: library coverage outranks docs coverage, and the annexes sheet 7 drew at 1.5–3.9× their buildings turn out to buy near-total light.</p>
<p><strong>The yard's habit: bright cores, dark wrappers.</strong> The instruments repeat one pattern — <code>@tools/release</code>, <code>build_and_test</code>, <code>workers-builds</code>, <code>lcov-rebase</code>: the <code>.core.ts</code> logic is lit and the command-line file in front of it is not. ${fmt(wrapperSloc)} sloc across ${wrapperFiles} files of process-edge code is never loaded by any suite, while the logic behind it meters ${pct1(DT.linesHit, DT.lines)}%. <code>compat-guards</code> is the pattern at its extreme: only <code>ranges.ts</code> is unit-lit; its guard lanes run for real in CI, where no meter follows. <code>@tools/happy-dom</code> is the survey's one genuine surprise: it owns a lit lamp and still stands dark, because its spec is a conformance canary pointed at happy-dom upstream — its own <code>append.ts</code> is lit only from <code>lit-ui-router</code>'s lamp, as borrowed light.</p>
<p><strong>What the meter cannot say, the plate refuses to fake.</strong> The two demo apps and the Cypress host are hatched in accent, not banded: e2e light is real — the rig drives the built docs site — but no lcov leaves it, so it is drawn as light of unknowable brightness and labelled unmetered. That judgement is the only one in the probe, and it is verified rather than assumed: the run throws if the rig has stopped being a Cypress suite. <code>sample-app-shared</code> runs its unit tests green, yet browser-mode vitest cannot fetch a coverage provider the repo never installed; its light is an outline, and the probe proves it by running the suite a second time without the meter. The members that are dark are dark because nothing tests them, and two of them (<code>dts-backtest</code>, <code>lit-test-env</code>) spend their working lives inside other members' suites.</p>`,
  key: [
    keyRow('<rect x="6" y="3" width="36" height="12" class="sk fp"/>', 'a member’s footprint — sheet 7’s census, plan view'),
    keyRow('<rect x="14" y="3" width="18" height="12" class="sks fhalo"/>', 'its spec annex — the LAMP: the light falls from the tests'),
    keyRow('<rect x="6" y="3" width="36" height="12" fill="var(--halo)"/><rect x="6" y="3" width="36" height="12" class="sk fnone"/>', 'lit ≥95% line — full bright'),
    keyRow('<rect x="6" y="3" width="36" height="12" fill="url(#s7a-g3)"/><rect x="6" y="3" width="36" height="12" class="skr fnone"/>', 'lit 70–85% — pale, red hatch'),
    keyRow('<rect x="6" y="3" width="36" height="12" fill="url(#s7a-se)"/><rect x="6" y="3" width="36" height="12" class="ska fnone" stroke-dasharray="5 4"/>', 'e2e light — real, no meter reads it'),
    keyRow('<line x1="4" y1="4" x2="44" y2="4" class="sks" stroke-dasharray="2 4"/><line x1="4" y1="14" x2="44" y2="14" class="sks" stroke-dasharray="2 4"/>', 'an outline of light — tests run, no meter attaches'),
    keyRow('<rect x="6" y="3" width="36" height="12" fill="url(#s7a-sh)"/><rect x="6" y="3" width="36" height="12" class="sk fnone"/>', 'SHADOW — source no suite ever loads'),
    keyRow('<circle cx="24" cy="9" r="7" class="skr fp"/><text x="24" y="12" class="lblr" text-anchor="middle" font-size="9">n</text>', 'fully dark, red badge — no suite at all'),
    keyRow('<rect x="4" y="3" width="24" height="12" class="sk fp"/><rect x="18" y="3" width="10" height="12" fill="var(--halo)"/><rect x="4" y="3" width="14" height="12" fill="url(#s7a-sh)"/><rect x="32" y="5" width="9" height="8" class="sks fhalo"/>', 'lit strip = share of source the suite loads · light from the lamp side'),
  ].join('\n'),
};
