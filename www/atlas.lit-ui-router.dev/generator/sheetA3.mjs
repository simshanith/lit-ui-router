import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, schedTxt, isoBlock, isoPt, keyRow } from './helpers.mjs';
import { assertPlots, depthSort, solidFaces } from './iso-hidden.mjs';
import { AG, CITY, H, S } from './sheet7.mjs';

const P = 'sA3';

// ---- the two plates: main's city census and the atlas's own survey -------------
const CITY_PLATE = JSON.parse(readFileSync(new URL('../data/census-city.json', import.meta.url), 'utf8'));
const SELF = JSON.parse(readFileSync(new URL('../data/survey-self.json', import.meta.url), 'utf8'));
const CITY_BASIS = `${CITY_PLATE.ref} @ ${CITY_PLATE.sha}`;
const SELF_BASIS = `${SELF.ref} @ ${SELF.sha}`;
const SELF_LINE = `measured at ${SELF_BASIS}, outside the cabinet, which is main's (${CITY_BASIS})`;

const fmt = (v) => v.toLocaleString('en-US');
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
// the ruler's constants, read back off sheet 7's own functions
const KS = S(1e6) / 1000, KH = H(100) / 100, FLOOR = S(0);

// ---- the rest of the codebase: sheet 7's districts, summed from sheet 7's own geometry
const DISTRICTS = [
  ['pkg', 'packages/', 'THE PRODUCT'],
  ['app', 'apps/', 'THE PROVING GROUND'],
  ['site', 'www/ + examples/', 'THE SHOPFRONT'],
  ['tool', 'tools/', 'THE INSTRUMENT YARD'],
];
const sum = (rows) => rows.reduce((a, r) => ({ f: a.f + r.f, sl: a.sl + r.sl, pf: a.pf + r.pf, pl: a.pl + r.pl, k: a.k + 1 }),
  { f: 0, sl: 0, pf: 0, pl: 0, k: 0 });
const cityRows = CITY.map((b) => ({ d: b.dist, f: b.sf, sl: b.sl, pf: b.pf, pl: b.pl }));
const plateTotal = CITY_PLATE.rows.reduce((a, r) => a + r.srcSloc + r.specSloc, 0);
const placedTotal = cityRows.reduce((a, r) => a + r.sl + r.pl, 0);
if (plateTotal !== placedTotal) throw new Error(`appendix A3: sheet 7 places ${placedTotal} sloc of the ${plateTotal} census-city.json carries — a member is unplaced`);

const GROUPS = [
  ...DISTRICTS.map(([d, dir, role]) => ({ key: d, dir, role, atlas: false, members: [{ name: dir, ...sum(cityRows.filter((r) => r.d === d)) }] })),
];
const DIST = Object.fromEntries(GROUPS.map((g) => [g.key, g.members[0]]));

// ---- the atlas: four members from data/survey-self.json ------------------------
const selfRow = (id) => {
  const r = SELF.rows.find((x) => x.member === id);
  if (!r) throw new Error(`appendix A3: member ${id} is missing from www/atlas.lit-ui-router.dev/data/survey-self.json`);
  return { id, name: r.name, ground: r.ground, f: r.srcFiles, sl: r.srcSloc, pf: r.specFiles, pl: r.specSloc };
};
// lot order: [back-left, back-right; front-left, front-right] — the tallest stands at the back
const ATLAS_LOTS = [['drawing', 'survey'], ['site', 'build']];
const ATLAS_M = ATLAS_LOTS.flat().map(selfRow);
if (ATLAS_M.length !== SELF.rows.length) throw new Error('appendix A3: survey-self.json carries a member this plate does not lot');
const AT = sum(ATLAS_M);

// ---- the computed claims ---------------------------------------------------------
const PK = DIST.pkg;
const REST = sum(Object.values(DIST));
const RATIO = (AT.sl / PK.sl).toFixed(1);
const SHARE = Math.round((AT.sl / REST.sl) * 100);
const DRAWING = ATLAS_M.find((m) => m.id === 'drawing');
const OUTBUILT = DISTRICTS.filter(([d]) => AT.sl > DIST[d].sl).length;
const CLAIM_PKG = AT.sl > PK.sl
  ? `${RATIO}× the product it draws: ${fmt(AT.sl)} sloc against ${fmt(PK.sl)} in packages/`
  : `under the product it draws: ${fmt(AT.sl)} sloc against ${fmt(PK.sl)} in packages/`;
const CLAIM_DRAWING = DRAWING.sl > PK.sl
  ? `the drawing office alone, ${fmt(DRAWING.sl)} sloc, outbuilds the product`
  : `the drawing office, ${fmt(DRAWING.sl)} sloc, stands under the product`;
const CLAIM_DISTRICTS = OUTBUILT === DISTRICTS.length
  ? `more source than any one district of the codebase`
  : `more source than ${WORD[OUTBUILT]} of the codebase's ${WORD[DISTRICTS.length]} districts`;
const CLAIM_TESTS = PK.sl + PK.pl > AT.sl
  ? `the product outweighs it only with its tests counted — ${fmt(PK.sl + PK.pl)} sloc, annex and all`
  : `it outweighs the product even with the product's tests counted — ${fmt(PK.sl + PK.pl)} sloc, annex and all`;
const CLAIM_ANNEX = AT.pf === 0
  ? 'and it carries no annex: not one spec file'
  : `and its annex holds ${AT.pf} spec files, ${fmt(AT.pl)} sloc`;
// the cover index's fit verdict, told from the two plates
export const SHEETA3_VERDICT = `meta — the atlas measured on sheet 7's ruler: ${fmt(AT.sl)} sloc of generator and app against ${fmt(PK.sl)} in the packages district, ${CLAIM_PKG.startsWith('under') ? 'under' : `${RATIO}×`} the product it draws, ${AT.pf === 0 ? 'with no annex' : `with a ${AT.pf}-file annex`}`;

GROUPS.push({ key: 'atlas', dir: 'www/atlas.lit-ui-router.dev/', role: 'THE ATLAS', atlas: true, members: ATLAS_M });

// ---- geometry ---------------------------------------------------------------------
const C = 0.866;
const LOT_GAP = 18;   // between atlas members
const PAD = 16;       // the atlas's frame, plan units outside its masses; a summed block is its own district
const GAP = 40;       // screen px between districts
let n = 0;
const massOf = (m) => {
  const s = S(m.sl), h = H(m.f);
  const sa = m.pf ? S(m.pl) : 0, ha = m.pf ? H(m.pf) : 0;
  return { ...m, n: ++n, s, h, sa, ha, w: s + (sa ? AG + sa : 0), d: Math.max(s, sa) };
};
for (const g of GROUPS) g.masses = g.members.map(massOf);

// local plan placement inside a group: one lot, or the atlas's two-by-two
for (const g of GROUPS) {
  if (!g.atlas) {
    const [b] = g.masses;
    b.lx = 0; b.ly = (b.d - b.s) / 2;
    continue;
  }
  const at = (id) => g.masses.find((b) => b.id === id);
  const col0 = Math.max(...ATLAS_LOTS.map((row) => at(row[0]).w));
  const row0 = Math.max(...ATLAS_LOTS[0].map((id) => at(id).d));
  ATLAS_LOTS.forEach((row, r) => row.forEach((id, c) => {
    const b = at(id);
    b.lx = c ? col0 + LOT_GAP : 0;
    b.ly = (r ? row0 + LOT_GAP : 0) + (b.d - b.s) / 2;
  }));
}
// the ground rects of a mass: its block, and its annex AG beyond it, centred on it
const rects = (b, ox, oy) => [
  { n: b.n, name: b.name, part: 'block', x: ox + b.lx, y: oy + b.ly, w: b.s, d: b.s },
  ...(b.sa ? [{ n: b.n, name: b.name, part: 'annex', x: ox + b.lx + b.s + AG, y: oy + b.ly + (b.s - b.sa) / 2, w: b.sa, d: b.sa }] : []),
];
for (const g of GROUPS) {
  const rs = g.masses.flatMap((b) => rects(b, 0, 0));
  const pad = g.atlas ? PAD : 0;
  g.box = [Math.min(...rs.map((r) => r.x)) - pad, Math.min(...rs.map((r) => r.y)) - pad,
    Math.max(...rs.map((r) => r.x + r.w)) + pad, Math.max(...rs.map((r) => r.y + r.d)) + pad];
  // how far the tallest roof rises above the frame's near corner, on screen
  const [, , x2, y2] = g.box;
  g.rise = Math.max(...rs.map((r) => {
    const b = g.masses.find((m) => m.n === r.n);
    const h = r.part === 'annex' ? b.ha : b.h;
    return (x2 + y2) * 0.5 - ((r.x + r.y) * 0.5 - h);
  }));
}

// screen placement: a frame's left corner at sx, its near corner on the ground line gy
const place = (g, sx, gy) => {
  const [x1, y1, x2, y2] = g.box;
  const u = sx / C - x1 + y2, v = 2 * gy - x2 - y2;
  g.ox = (u + v) / 2; g.oy = (v - u) / 2;
  g.left = sx; g.right = (u + x2 - y1) * C; g.ground = gy;
};
const HEAD = 104;          // the header band's foot
const LABEL_H = 92;        // lettering under the main row
const CODEBASE = GROUPS.filter((g) => !g.atlas);
const ATLAS = GROUPS.find((g) => g.atlas);
const GY1 = HEAD + 22 + Math.max(...CODEBASE.map((g) => g.rise));
let sx = 40;
for (const g of CODEBASE) { place(g, sx, GY1); sx = g.right + GAP; }
const GY2 = GY1 + LABEL_H + 40 + ATLAS.rise;
place(ATLAS, 40, GY2);
if (CODEBASE.at(-1).right > 1520) throw new Error(`appendix A3: the main row runs to ${CODEBASE.at(-1).right.toFixed(0)}, past the sheet's 1520`);

for (const g of GROUPS) for (const b of g.masses) [b.block, b.annex] = rects(b, g.ox, g.oy);
const ALL = GROUPS.flatMap((g) => g.masses);
assertPlots('appendix A3', ALL.flatMap((b) => [b.block, ...(b.annex ? [b.annex] : [])]));

const pt = (x, y, z = 0) => isoPt(0, 0, x, y, z);
const p2 = (x, y, z = 0) => pt(x, y, z).map((v) => v.toFixed(1)).join(',');

// ---- masses ------------------------------------------------------------------------
const LOOK = {
  codebase: { edge: 'sk', cap: 'fp', side: `url(#${P}-hx)`, badge: 'sk fp', num: 'lbl' },
  atlas: { edge: 'ska', cap: 'fp', side: `url(#${P}-ha)`, badge: 'ska fp', num: 'lbla' },
};
const lookOf = (b) => (ATLAS.masses.includes(b) ? LOOK.atlas : LOOK.codebase);
const blockMass = (b) => {
  const t = lookOf(b), r = b.block;
  return { ...r, svg: solidFaces(isoBlock(P, 0, 0, r.x, r.y, r.w, r.d, b.h, { capCls: t.cap, edge: t.edge, sideFill: t.side })) };
};
const annexMass = (b) => {
  const r = b.annex;
  return { ...r, svg: solidFaces(isoBlock(P, 0, 0, r.x, r.y, r.w, r.d, b.ha, { edge: 'sks', capCls: 'fp2', sideFill: `url(#${P}-hd)` })) };
};
const masses = depthSort(ALL.flatMap((b) => (b.annex ? [blockMass(b), annexMass(b)] : [blockMass(b)])))
  .map((m) => m.svg).join('\n');

// badges ride above the back edge of the roof, or centred on it where a taller neighbour stands behind
const BADGE_ON_ROOF = new Set(['survey', 'build']);
const badge = (b) => {
  const t = lookOf(b), r = b.block;
  const onRoof = BADGE_ON_ROOF.has(b.id);
  const [bx, by] = pt(r.x + r.w / 2, r.y + (onRoof ? r.d / 2 : 0), b.h);
  const lift = onRoof ? 0 : 16;
  return `<circle cx="${bx.toFixed(1)}" cy="${(by - lift).toFixed(1)}" r="9" class="${t.badge}"/>
${txt(bx.toFixed(1), (by - lift + 3.4).toFixed(1), String(b.n), t.num, 'middle')}`;
};

const frame = (g) => {
  const [x1, y1, x2, y2] = g.box;
  const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(([x, y]) => p2(g.ox + x, g.oy + y)).join(' ');
  return `<polygon points="${pts}" class="${g.atlas ? 'ska' : 'skf'} fnone" stroke-dasharray="5 4"${g.atlas ? ' opacity="0.7"' : ''}/>`;
};

// ---- lettering -----------------------------------------------------------------------
const sloc = (m) => `${m.f} files · ${fmt(m.sl)} sloc`;
const annexLine = (m) => (m.pf ? `annex ${m.pf} files · ${fmt(m.pl)} sloc` : 'no annex');
const codebaseLabels = CODEBASE.map((g) => {
  const m = g.masses[0];
  const x = ((g.left + g.right) / 2).toFixed(0);
  const y = g.ground + 22;
  return [txt(x, y, g.dir, 'lblb', 'middle'), txt(x, y + 13, g.role, 'lbls', 'middle'),
    txt(x, y + 27, sloc(m), 'lblf', 'middle'), txt(x, y + 40, annexLine(m), 'lblf', 'middle')].join('\n');
}).join('\n');

// the seam between the two grounds
const SEAM = GY1 + LABEL_H;
const seam = `<line x1="40" y1="${SEAM}" x2="1520" y2="${SEAM}" class="skf" stroke-dasharray="2 5"/>
${txt(1520, SEAM - 7, `ABOVE — THE CODEBASE, FROM data/census-city.json · ${CITY_BASIS} · sheet 7's districts, each summed into one block`, 'lblf', 'end')}
${txt(1520, SEAM + 15, `BELOW — THE ATLAS, FROM data/survey-self.json · ${SELF_LINE}`, 'lblf', 'end')}`;

const AX = Math.max(ATLAS.right + 50, 560);
const AY = SEAM + 52;
const atlasPanel = `${txt(AX, AY, `${ATLAS.dir} — THE ATLAS`, 'lbla')}
${txt(AX, AY + 15, `${WORD[AT.k]} members · ${AT.f} files · ${fmt(AT.sl)} sloc · ${AT.pf ? annexLine(AT) : 'no annex'}`, 'lbls')}
${ATLAS.masses.map((b, i) => schedTxt(AX, AY + 38 + i * 15, [b.n, `${b.name} — ${sloc(b)} · ${b.ground}`], 'lblf')).join('\n')}
${[CLAIM_PKG, CLAIM_DRAWING, CLAIM_DISTRICTS, `${SHARE}% of the codebase's own authored source, ${fmt(REST.sl)} sloc across its ${WORD[DISTRICTS.length]} districts`, CLAIM_TESTS, CLAIM_ANNEX]
  .map((s, i) => txt(AX, AY + 118 + i * 16, s, i ? 'lbls' : 'lblb')).join('\n')}`;
const ART_H = Math.max(GY2 + 40, AY + 118 + 6 * 16 + 10);

// ---- schedule ------------------------------------------------------------------------
const schedRows = [
  ...CODEBASE.map((g) => { const m = g.masses[0]; return [m.n, `${g.dir} ${g.role.toLowerCase()} — ${sloc(m)} · ${annexLine(m)} · sheet 7's ${m.k} members, summed`]; }),
  ...ATLAS.masses.map((b) => [b.n, `${b.name} — ${sloc(b)} · ${annexLine(b)} · ${b.ground}`]),
];
const offRuler = SELF.offRuler.filter((o) => o.code > 0);
const unclassified = SELF.offRuler.filter((o) => o.code === 0);
const exRows = [
  ...SELF.excluded.map((e) => `${e.rule} — ${e.files} files · ${fmt(e.sloc)} lines scc counts`),
  ...Array.from({ length: Math.ceil(offRuler.length / 3) }, (_, i) =>
    `${i ? '' : 'off the ruler, on a member\'s ground: '}${offRuler.slice(i * 3, i * 3 + 3).map((o) => `${o.path} (${o.lang} ${fmt(o.code)})`).join(' · ')}`),
  `and ${unclassified.length} files scc names no language for: ${[...new Set(unclassified.map((o) => o.path.replace(/[^/]+$/, '')))].join(' · ')}`,
];
const SY = ART_H + 16;
const ROWS = Math.max(schedRows.length, exRows.length);
const SH = 74 + ROWS * 17;
const schedule = `<rect x="40" y="${SY}" width="1480" height="${SH}" class="sk fp"/>
${txt(58, SY + 22, 'STRUCTURE SCHEDULE — files (f) · sloc on sheet 7\'s ruler · spec annex', 'lbls')}
${txt(800, SY + 22, 'EXCLUDED — what the atlas draws, generates or writes as prose', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1520" y2="${SY + 32}" class="skf"/>
<line x1="782" y1="${SY + 32}" x2="782" y2="${SY + 40 + ROWS * 17}" class="skf"/>
${schedRows.map((r, i) => schedTxt(58, SY + 52 + i * 17, r, 'lbls')).join('\n')}
${exRows.map((r, i) => txt(800, SY + 52 + i * 17, r, 'lblf')).join('\n')}
${txt(58, SY + 58 + ROWS * 17, `TOTAL — the codebase ${REST.f} files · ${fmt(REST.sl)} sloc (+ ${REST.pf} spec · ${fmt(REST.pl)}) at ${CITY_BASIS} · the atlas ${AT.f} files · ${fmt(AT.sl)} sloc (+ ${AT.pf} spec) at ${SELF_BASIS} · sloc = scc Code`, 'lbls')}`;

const ARIA = `An isometric census of the atlas itself, standing beside the codebase it draws, on sheet 7's ruler: footprint side ${KS} times the square root of source lines, height ${KH} pixels per authored file. `
  + `Along the top, on main's ground at ${CITY_BASIS}, sheet 7's four districts each stand as one summed block with its spec annex beside it: `
  + CODEBASE.map((g) => `${g.dir}, ${sloc(g.masses[0])}, ${annexLine(g.masses[0])}`).join('; ') + '. '
  + `Below a dotted seam, on the atlas's own branch at ${SELF_BASIS}, the atlas stands as a fifth district of ${WORD[AT.k]} accent-edged members: `
  + ATLAS.masses.map((b) => `${b.name}, ${sloc(b)}`).join('; ') + `. `
  + `${CLAIM_PKG}; ${CLAIM_DRAWING}; ${CLAIM_TESTS}; ${CLAIM_ANNEX}. A structure schedule lists every block, and beside it every path the survey excludes.`;

const svg = `<svg viewBox="0 0 1560 ${SY + SH + 30}" role="img" aria-label="${ARIA}">
${defs(P)}

<rect x="40" y="26" width="520" height="42" class="skf fnone"/>
${txt(52, 43, 'THE ATLAS, MEASURED — ON THE CITY\'S OWN RULER', 'lbls')}
${txt(52, 58, `the codebase's ${WORD[DISTRICTS.length]} districts above · the atlas's ${WORD[AT.k]} members below · one S() and H(), imported from sheet 7`, 'lblf')}

${txt(1520, 34, `SCALE — footprint side = ${KS} · √sloc (plan area ∝ sloc) · height = ${KH} px per authored file — sheet 7's functions, not a copy`, 'lbls', 'end')}
${txt(1520, 48, `footprint floored at ${FLOOR} plan units · annexes massed on the same rule from spec files · plan areas add, so ${WORD[AT.k]} footprints cover the ground one block of their sum would`, 'lblf', 'end')}
${txt(1520, 62, `the atlas counts what it writes by hand and serves to a browser — never what it draws: plates, generated pages, pictures and prose stand outside`, 'lblf', 'end')}
${txt(1520, 76, `every number on this sheet is read from data/census-city.json and data/survey-self.json at build time`, 'lblf', 'end')}

${frame(ATLAS)}
${masses}
${ALL.map(badge).join('\n')}
${codebaseLabels}
${seam}
${atlasPanel}

${schedule}
</svg>`;

export const sheetA3 = {
  num: 'A3', id: 'self', rev: 'A',
  head: 'APPENDIX A3 · META',
  appendix: true,
  title: 'THE ATLAS, MEASURED',
  sub: `APPENDIX · META — the atlas as a census city on sheet 7's ruler, standing beside the codebase it draws · ${WORD[AT.k]} members, ${fmt(AT.sl)} sloc · ${SELF_LINE}`,
  scale: 'THE ATLAS ITSELF',
  form: 'ISOMETRIC CITY',
  svg,
  caption: `The atlas turned on itself with the census city's own instrument: footprint ∝ √sloc, height ∝ files, from sheet 7's functions. Sheet 7's four districts stand along the top as one block each; the atlas stands below them as a fifth district of ${WORD[AT.k]} members — ${CLAIM_PKG}.`,
  notes: `
<p><strong>Method — one ruler, two grounds.</strong> Every block on this plate is massed by <code>S()</code> and <code>H()</code> imported from <code>sheet7.mjs</code> — footprint side ${KS} · √sloc, height ${KH} px per authored file, floor ${FLOOR} — and every file is admitted by the same predicate the city census uses, <code>onCityRuler</code> in <code>census-query.mjs</code>: authored <code>.ts/.tsx/.js/.jsx/.mjs</code>, no <code>*.d.ts</code>, spec files split into an annex. The two halves stand on different grounds and say so. The codebase is <code>data/census-city.json</code>, ${CITY_BASIS}, the cabinet every numbered sheet reads. The atlas is not on main, so it cannot be in that cabinet: it is <code>data/survey-self.json</code>, written by <code>generator/survey-self.mjs</code> from a <code>git archive</code> of its own branch — ${SELF_BASIS}, committed ${SELF.commitDate.slice(0, 10)} — through the same scc 4.0.0 the cabinet uses. The probe is named <code>survey-</code>, not <code>census-</code>, so appendix A2's one-ref check stays a claim about main alone.</p>
<p><strong>The fixed-point rule.</strong> The atlas counts only what it writes by hand and what it serves to a browser, never what it draws — a drawing of the atlas that counted its own drawings would grow every time it was drawn. Admitted: the <em>drawing office</em> (every <code>generator/</code> module that is not a census instrument — the sheets, the chrome, the 3D scenes, the emitter, the build), the <em>survey office</em> (<code>census*.mjs</code>, <code>basis.mjs</code> and <code>survey-*.mjs</code>), the <em>routed site</em> (<code>app/src/</code>) and the <em>site build</em> (<code>app/*</code>: prerender, vite, artifact and lint config). Excluded, and tallied on the schedule: the filed plates in <code>data/</code> (${fmt(SELF.excluded[0].sloc)} lines scc counts), <code>app/src/generated/</code>, everything under <code>app/public/</code>, the flat set's pages and every Markdown file. On a member's ground the ruler itself excludes more: <code>app/index.html</code> is ${fmt(SELF.offRuler.find((o) => o.path === 'app/index.html')?.code ?? 0)} lines of HTML by scc's count, mostly the site's stylesheet, and stays off for the reason sheet 7's docs member keeps its <code>.vue</code> and <code>.css</code> off — a ruler that admits markup on one side and not the other compares nothing. Build output is untracked, so the archive never holds it.</p>
<p><strong>What the drawing says.</strong> ${CLAIM_PKG}. ${CLAIM_DRAWING.charAt(0).toUpperCase() + CLAIM_DRAWING.slice(1)}. It is ${CLAIM_DISTRICTS}, and ${SHARE}% of the ${fmt(REST.sl)} authored lines the codebase holds across all ${WORD[DISTRICTS.length]}. Where the comparison turns is the annex: ${CLAIM_TESTS}, ${CLAIM_ANNEX}. Every claim in this paragraph is computed from the two plates and changes its wording when the plates change it.</p>
<p><strong>Why aggregates, and why the atlas is not.</strong> The codebase stands as ${WORD[DISTRICTS.length]} summed blocks, one per sheet 7 district, because the question is how much atlas there is, and sheet 7 already draws the codebase member by member. Summing is honest on this ruler for plan area — area ∝ sloc, so one block of a district's sum covers the same ground its members do — and approximate for height, which reads a district's total files as one tower. The atlas keeps its ${WORD[AT.k]} members because it has no other drawing that shows its parts. The aggregates do not dwarf the atlas — ${CLAIM_DRAWING} — so the district scale carries the comparison on its own, and the product member by member is sheet 7's drawing to make. Sheet 7's district membership is read from its exported geometry, and a census row sheet 7 does not place is a build error here, so the two plates cannot disagree.</p>`,
  key: [
    keyRow('<rect x="6" y="3" width="36" height="12" class="sk fp"/>', 'a district of the codebase, summed — footprint ∝ √sloc, height ∝ files'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sks fp2"/><rect x="8" y="3" width="18" height="12" fill="url(#sA3-hd)"/>', 'its spec annex — the test mass, same rule'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="fp"/><rect x="6" y="3" width="36" height="12" fill="url(#sA3-ha)"/><rect x="6" y="3" width="36" height="12" class="ska fnone"/>', 'a member of the atlas — the same rule, on its own branch'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'district frame'),
    keyRow('<line x1="2" y1="9" x2="44" y2="9" class="skf" stroke-dasharray="2 5"/>', 'the seam between main\'s ground and the atlas\'s'),
  ].join('\n'),
};
