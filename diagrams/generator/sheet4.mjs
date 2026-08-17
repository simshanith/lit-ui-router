import { defs } from './chrome.mjs';
import { txt, lines, keyRow } from './helpers.mjs';

const P = 's4';

// ---- census: authored source, repo HEAD, cloned/counted 2026-08-16 -------------
// Upstream family measured from shallow clones of the ui-router org repos (the
// HEAD of each is the published version drawn here); this repo's members from
// packages/*/src. Counted: .ts/.tsx/.js under src/, excluding *.d.ts, specs/tests
// and typedoc stubs. sloc = lines that are neither blank nor comment-only.
// [name, version, lastPublish, files, sloc, gateRange, gateKind, status]
const CORE = ['@uirouter/core', '6.1.2', '2025-12-31', 80, 5272];

const ADAPTERS = [
  ['@uirouter/angularjs', '1.1.2', '2025-12-31', 18, 1512, '^6.1.2', 'peer', 'wave'],
  ['@uirouter/angular', '21.0.0', '2026-01-04', 18, 1023, '^6.1.2', 'peer', 'active'],
  ['@uirouter/react', '1.0.8', '2025-12-31', 22, 650, '6.1.2', 'dep', 'wave'],
  ['lit-ui-router', '1.9.0', '2026-08-01', 12, 1189, '^6.0.8', 'peer', 'this'],
];
const INSTRUMENTS = [
  ['@uirouter/visualizer', '7.2.1', '2020-09', 34, 2018, '>=5.0.0', 'peer', 'dormant'],
  ['@uirouter/rx', '1.0.0', '~2020', 4, 72, '>=6.0.1', 'peer', 'dormant'],
  ['@uirouter/sticky-states', '1.5.1', '2019-10', 2, 233, '>=5.0.1', 'peer', 'dormant'],
  ['@uirouter/dsr', '1.2.0', '2019-12', 4, 266, '>=5.0.0', 'peer', 'dormant'],
];
const COMPANIONS = [
  ['ui-router-server', '0.1.1', '2026-08-01', 8, 1141, '^6.0.8', 'peer', 'this'],
  ['lit-ui-router-mobx', '0.5.0', '2026-08-01', 4, 133, '^6.0.8', 'peer', 'this'],
  ['…-nav-location-plugin', '0.3.0', '2026-07-27', 1, 105, '^6.0.8', 'peer', 'this'],
];

// ---- scale rule ---------------------------------------------------------------
const KW = 2.7;   // block width  = 2.7 · √sloc  (px)
const KH = 2.2;   // block height = 2.2 px per authored file
const W = (sloc) => KW * Math.sqrt(sloc);
const H = (files) => Math.max(3, KH * files);
const fmt = (v) => v.toLocaleString('en-US');

// ---- datum ---------------------------------------------------------------------
const RAIL_Y = 300, RAIL_H = 14;      // the spine rail (a datum, not to scale)
const RAIL_T = RAIL_Y - RAIL_H / 2, RAIL_B = RAIL_Y + RAIL_H / 2;
const BASE_UP = 230;                   // adapter blocks stand on this line
const BASE_DN = 370;                   // instrument blocks hang from this line

// A stem routed on the sheet's grid: straight down/up the column, trimmed at both
// ends so the head floats free of the rail and the tail free of the block.
const stem = (cx, from, to, cls, dash = '', mk = 'ai') =>
  `<path d="M${cx},${from} V${to}" class="${cls}" ${dash ? `stroke-dasharray="${dash}"` : ''} marker-end="url(#${P}-${mk})"/>`;

// A gate: the @uirouter/core range a limb admits, drawn as a checkpoint tablet on
// its stem. Accent hatch = a range; red hatch = an exact pin shipped as a dependency.
function gate(cx, cy, range, kind, textDx = 18) {
  const hard = kind === 'dep';
  const hatch = hard ? 'hr' : 'ha';
  const line = hard ? 'skr' : 'ska';
  const label = hard ? `dep ${range}` : range;
  return `<rect x="${cx - 14}" y="${cy - 8}" width="28" height="16" rx="2" class="fp"/>
<rect x="${cx - 14}" y="${cy - 8}" width="28" height="16" rx="2" fill="url(#${P}-${hatch})"/>
<rect x="${cx - 14}" y="${cy - 8}" width="28" height="16" rx="2" class="${line} fnone"/>
${txt(cx + textDx, cy + 3.5, label, hard ? 'lblr' : 'lbla')}
${hard ? txt(cx + textDx, cy + 15.5, 'pinned · not a peer', 'lblr') : ''}`;
}

const strokeFor = (status) => (status === 'dormant' ? 'skf' : status === 'this' ? 'ska' : 'sk');
const blockCls = (status) =>
  status === 'dormant' ? 'sks fnone' : status === 'this' ? 'ska fa' : 'sk fp2';
const nameCls = (status) => (status === 'dormant' ? 'lbls' : status === 'this' ? 'lbla' : 'lblb');

// ---- column layout -------------------------------------------------------------
const COL_X0 = 340, COL_GAP = 120;
let cursor = COL_X0;
const cols = ADAPTERS.map((m) => {
  const w = W(m[4]);
  const c = { m, x: cursor, w, cx: cursor + w / 2 };
  cursor += w + COL_GAP;
  return c;
});
const CENTERS = cols.map((c) => c.cx);

// ---- adapters (above the rail) --------------------------------------------------
const adapterArt = cols
  .map(({ m, x, w, cx }) => {
    const [name, ver, date, files, sloc, range, kind, status] = m;
    const h = H(files), top = BASE_UP - h;
    const halo = status === 'this'
      ? `<rect x="${(x - 8).toFixed(1)}" y="${(top - 8).toFixed(1)}" width="${(w + 16).toFixed(1)}" height="${(h + 16).toFixed(1)}" rx="6" class="fhalo"/>`
      : '';
    return `${stem(cx.toFixed(1), BASE_UP + 8, RAIL_T - 7, strokeFor(status), status === 'dormant' ? '5 4' : '', status === 'this' ? 'aa' : 'ai')}
${gate(cx, 262, range, kind)}
${halo}
<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" class="${blockCls(status)}"/>
${txt(cx.toFixed(1), (top - 40).toFixed(1), `${name} ${ver}`, nameCls(status), 'middle')}
${txt(cx.toFixed(1), (top - 27).toFixed(1), `${files} files · ${fmt(sloc)} sloc`, 'lblf', 'middle')}
${txt(cx.toFixed(1), (top - 14).toFixed(1), `last publish ${date}`, 'lblf', 'middle')}`;
  })
  .join('\n');

// ---- instruments (below the rail) -----------------------------------------------
const instrumentArt = INSTRUMENTS.map((m, i) => {
  const [name, ver, date, files, sloc, range, kind, status] = m;
  const w = W(sloc), h = H(files), cx = CENTERS[i], x = cx - w / 2, bot = BASE_DN + h;
  return `${stem(cx.toFixed(1), BASE_DN - 8, RAIL_B + 7, 'skf', '5 4')}
${gate(cx, 338, range, kind)}
<rect x="${x.toFixed(1)}" y="${BASE_DN}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" class="${blockCls(status)}" stroke-dasharray="5 4"/>
${txt(cx.toFixed(1), (bot + 20).toFixed(1), `${name} ${ver}`, nameCls(status), 'middle')}
${txt(cx.toFixed(1), (bot + 32).toFixed(1), `${files} files · ${fmt(sloc)} sloc`, 'lblf', 'middle')}
${txt(cx.toFixed(1), (bot + 44).toFixed(1), `quiet since ${date}`, 'lblf', 'middle')}`;
}).join('\n');

// ---- companions bay (this repo's own limbs, right of the adapters) ---------------
const BAY_X = 1110, BAY_R = 1310, BAY_T = 70, BAY_B = 250, BAY_CX = 1180;
const bayRows = COMPANIONS.map((m, i) => {
  const [name, ver, , files, sloc] = m;
  const w = W(sloc), h = H(files), y = 126 + i * 50;
  return `${txt(BAY_X + 12, y, name, 'lbla')}
${txt(BAY_X + 12, y + 12, `v${ver} · ${files} files · ${fmt(sloc)} sloc`, 'lblf')}
<rect x="${BAY_X + 12}" y="${(y + 18).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" class="ska fa"/>`;
}).join('\n');

const bay = `<rect x="${BAY_X}" y="${BAY_T}" width="${BAY_R - BAY_X}" height="${BAY_B - BAY_T}" class="skf fnone" stroke-dasharray="5 4"/>
${txt(BAY_X + 12, BAY_T + 20, 'COMPANIONS — this repo', 'lbls')}
${txt(BAY_X + 12, BAY_T + 32, '← mobx peers lit-ui-router ^1.7.0', 'lblf')}
${txt(BAY_X + 12, BAY_T + 44, 'drawn in full on sheet 2', 'lblf')}
${bayRows}
${stem(BAY_CX, BAY_B + 8, RAIL_T - 7, 'ska', '', 'aa')}
${gate(BAY_CX, 272, '^6.0.8', 'peer')}
${txt(BAY_CX + 18, 288, 'all three', 'lblf')}`;

// mobx also peers lit-ui-router itself — the only limb growing a limb
const litCx = CENTERS[3];
const tie = `<path d="M${(litCx + W(1189) / 2 + 16).toFixed(1)},220 H${BAY_X - 6}" class="ska" stroke-dasharray="4 3" marker-end="url(#${P}-aa)"/>`;

// ---- the spine ------------------------------------------------------------------
const CORE_W = W(CORE[4]), CORE_H = H(CORE[3]);
const CORE_X = 96, CORE_Y = RAIL_Y - CORE_H / 2;
const spine = `<rect x="70" y="${RAIL_T}" width="1240" height="${RAIL_H}" class="sks fp2"/>
<rect x="${CORE_X}" y="${CORE_Y.toFixed(1)}" width="${CORE_W.toFixed(1)}" height="${CORE_H.toFixed(1)}" class="sk2 fp2"/>
<rect x="${CORE_X}" y="${CORE_Y.toFixed(1)}" width="${CORE_W.toFixed(1)}" height="${CORE_H.toFixed(1)}" fill="url(#${P}-hx)" opacity="0.3"/>
${txt(CORE_X, 406, `${CORE[0]} ${CORE[1]}`, 'lblb')}
${txt(CORE_X, 420, `${CORE[3]} files · ${fmt(CORE[4])} sloc`, 'lblf')}
${txt(CORE_X, 432, '39% of the family’s authored mass', 'lblf')}
${txt(CORE_X, 444, 'states · registry · transitions', 'lblf')}`;

// ---- schedule -------------------------------------------------------------------
const ALL = [
  [...CORE, '—', 'spine', 'active'],
  ...ADAPTERS, ...INSTRUMENTS, ...COMPANIONS,
].sort((a, b) => b[4] - a[4]);
const TOT_F = ALL.reduce((a, r) => a + r[3], 0);
const TOT_L = ALL.reduce((a, r) => a + r[4], 0);
const schedRow = (r, i) => {
  const [name, ver, , files, sloc, range, kind] = r;
  const g = kind === 'spine' ? 'the spine itself' : kind === 'dep' ? `gate ${range} (dependency)` : `gate ${range}`;
  return `${String(i + 1).padStart(2, ' ')}  ${name} ${ver} — ${files}f · ${fmt(sloc)} sloc · ${Math.round(sloc / files)} l/f · ${g}`;
};
const SY = 580, half = Math.ceil(ALL.length / 2);
const schedule = `<rect x="40" y="${SY}" width="1270" height="${70 + half * 17}" class="sk fp"/>
${txt(56, SY + 22, 'STRUCTURE SCHEDULE — authored source per member · files (f) · sloc · mean lines per file · core gate', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1310" y2="${SY + 32}" class="skf"/>
${ALL.slice(0, half).map((r, i) => txt(56, SY + 52 + i * 17, schedRow(r, i), 'lbls')).join('\n')}
${ALL.slice(half).map((r, i) => txt(700, SY + 52 + i * 17, schedRow(r, i + half), 'lbls')).join('\n')}
${txt(56, SY + 58 + half * 17, `TOTAL — 12 packages · ${TOT_F} authored files · ${fmt(TOT_L)} sloc · counted 2026-08-16`, 'lbls')}`;

const svg = `<svg viewBox="0 0 1350 ${SY + 130 + half * 17}" role="img" aria-label="The ui-router family drawn as a spine, re-massed from measured source: @uirouter/core is a hatched block astride a horizontal rail, four framework adapters stand on the rail above it and four dormant instruments hang below, each drawn as a block whose width is proportional to the square root of its authored source lines and whose height is proportional to its file count. Core is by far the largest mass at 80 files and 5,272 lines, 39 percent of the family; the visualizer is the next largest at 2,018 lines; sticky-states is a two-file sliver. Every limb's stem crosses a gate — a hatched tablet in the accent colour naming the @uirouter/core version range that limb admits — and the gates disagree: floors of greater-or-equal 5.0.0, 5.0.1 and 6.0.1, carets on 6.1.2 and 6.0.8, and one red gate on @uirouter/react, which pins core exactly at 6.1.2 and ships it as a dependency instead of a peer. A dashed bay at the right holds this repo's three companion packages behind a single shared gate. A structure schedule lists every member with exact file and line counts.">
${defs(P)}

${txt(70, 96, 'ADAPTERS — one per renderer, standing on the spine', 'lbls')}
${txt(70, 130, 'THE NEW YEAR’S WAVE', 'lbla')}
${lines(70, 146, ['2025-12-31: core, angularjs and react', 'patched within 26 h; angular 21.0.0', 'followed four days later'], 'lblf', 'start', 12)}

${spine}
${adapterArt}
${instrumentArt}
${bay}
${tie}

${txt(70, 520, 'PLUGINS & INSTRUMENTS — hanging below the spine', 'lbls')}
${lines(70, 540, ['no @uirouter/vue was ever published:', 'the vue seat has zero mass'], 'lblf', 'start', 12)}

${txt(1310, 26, 'SCALE — block width = 2.7 · √sloc · block height = 2.2 px per authored file · gates and rail not to scale', 'lbls', 'end')}
${txt(1310, 40, 'mass ranks by code volume, not downloads · authored src at repo HEAD, tests and d.ts excluded', 'lblf', 'end')}

${schedule}
</svg>`;

export const sheet4 = {
  num: 4, id: 'family', rev: 'B',
  title: 'THE FAMILY SPINE',
  sub: 'ALTITUDE 4 — one core, four living adapters, four dormant instruments · REV B: the spine re-massed from sloc × files, authored source counted 2026-08-16',
  scale: 'UI-ROUTER ECOSYSTEM',
  form: 'MASSED SPINE',
  svg,
  caption: 'Not a loop and not a city: a spine. Every limb shares @uirouter/core and none of the limbs talk to each other — so the honest drawing is radial. Rev B gives every limb its measured mass, and puts a gate on every stem: the core version range that limb actually admits.',
  notes: `
<p><strong>Method — one basis for every member.</strong> Authored source, not shipped bundles: each upstream package was shallow-cloned from its <code>ui-router</code> org repository on 2026-08-16 (every HEAD happened to be the published version drawn here), and this repo's members were read from <code>packages/*/src</code>. Counted files are <code>.ts/.tsx/.js</code> under <code>src/</code>; <code>*.d.ts</code>, <code>specs/</code> and <code>__tests__/</code>, and typedoc stub modules are excluded. <em>sloc</em> is lines that are neither blank nor comment-only. Twelve packages, 207 authored files, 13,614 lines.</p>
<p><strong>An isometric city would still lie here.</strong> Adjacent blocks imply interaction, and the adapters have none — each rib touches only the spine. So the plan stays radial and the new ink is mass: block width ∝ √sloc, block height ∝ file count, which lets a two-file, 233-line package like sticky-states read as the sliver it is beside core's 80-file slab. Core alone is 5,272 lines — 39% of the family's authored mass, and more than the four adapters combined.</p>
<p><strong>The gates disagree, and that is the finding.</strong> Every limb declares a range on <code>@uirouter/core</code>, drawn here as a hatched tablet where the limb's stem crosses toward the rail. The dormant instruments still admit core 5 (<code>&gt;=5.0.0</code>, <code>&gt;=5.0.1</code>); rx admits <code>&gt;=6.0.1</code>; angularjs and angular carets on <code>^6.1.2</code>; this repo's four packages sit on <code>^6.0.8</code>. One gate is red: <code>@uirouter/react</code> pins core at exactly <code>6.1.2</code> <em>and ships it as a dependency, not a peer</em> — the only limb that can install a second copy of the state machine into a consumer's tree, and the only one that cannot be moved forward without a react release.</p>
<p><strong>Mass does not track liveness.</strong> The largest limb on the sheet is the dormant <code>@uirouter/visualizer</code> (34 files, 2,018 lines, quiet since 2020) — it carries a preact/d3 rendering stack, so it out-masses every living adapter. The newest limb, <code>lit-ui-router</code>, is 12 files and 1,189 lines, and it is the only limb growing limbs of its own: the companion bay adds another 1,379 lines behind a single shared gate, with <code>lit-ui-router-mobx</code> the one package on this sheet that peers a limb rather than the spine.</p>`,
  key: [
    keyRow('<rect x="4" y="4" width="40" height="11" class="sk fp2"/>', 'member — width ∝ √sloc, height ∝ files'),
    keyRow('<rect x="4" y="6" width="40" height="7" class="sks fnone" stroke-dasharray="5 4"/>', 'dormant — quiet 5+ years'),
    keyRow('<rect x="4" y="4" width="40" height="11" class="ska fa"/>', 'this repo'),
    keyRow('<rect x="10" y="2" width="28" height="14" rx="2" fill="url(#s4-ha)"/><rect x="10" y="2" width="28" height="14" rx="2" class="ska fnone"/>', 'gate — the @uirouter/core range admitted'),
    keyRow('<rect x="10" y="2" width="28" height="14" rx="2" fill="url(#s4-hr)"/><rect x="10" y="2" width="28" height="14" rx="2" class="skr fnone"/>', 'hard gate — core pinned exactly, as a dependency'),
    keyRow('<line x1="22" y1="2" x2="22" y2="16" class="sk"/>', 'declares on the spine (and only the spine)'),
  ].join('\n'),
};
