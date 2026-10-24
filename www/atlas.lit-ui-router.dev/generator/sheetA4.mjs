import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, schedTxt, isoBlock, isoPt, keyRow } from './helpers.mjs';
import { assertPlots, depthSort, solidFaces } from './iso-hidden.mjs';
import { HT, ROLES, SIDE } from './sheet9.mjs';
import { THUMB_H, THUMB_SCALE, THUMB_W } from './thumb-spec.mjs';

const P = 'sA4';
const VB_W = 1560;

// ---- the ruler is sheet 9's: its constants are read back off the imported functions, and this module defines none
const KS = SIDE(1e6) / 1000;
const FLOOR = SIDE(0);
const BYTES_PER_PX = 1e6 / (HT(2e6) - HT(1e6));
const KB_PER_PX = (BYTES_PER_PX / 1024).toFixed(1);
const HT_FLOOR = HT(0);
if (/\b(?:const|let|var|function)\s+(?:HT|SIDE)\b/.test(readFileSync(new URL(import.meta.url), 'utf8'))) throw new Error('appendix A4: the ruler is sheet 9\'s — this module may not define its own HT or SIDE');

// ---- the two plates: sheet 9's docs deploy and the atlas's own deploy --------------
const DOCS_PLATE = JSON.parse(readFileSync(new URL('../data/census-shipped.json', import.meta.url), 'utf8'));
const SELF = JSON.parse(readFileSync(new URL('../data/survey-shipped.json', import.meta.url), 'utf8'));
const DOCS_BASIS = `${DOCS_PLATE.ref} @ ${DOCS_PLATE.sha}`;
const SELF_BASIS = `${SELF.ref} @ ${SELF.sha}`;
const SELF_LINE = `measured at ${SELF_BASIS}, outside the cabinet, which is main's (${DOCS_BASIS})`;

const fmt = (v) => v.toLocaleString('en-US');
const KB = (gz) => `${(gz / 1024).toFixed(gz < 100000 ? 1 : 0)} KB`;
const MB = (b) => `${(b / 1048576).toFixed(1)} MB`;
const pct = (a, b) => `${Math.round((a / b) * 100)}%`;
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'];
// vite hashes: an 8-char mixed-case segment, dot- or dash-joined, before the extension
const tenant = (p) => p.split('/').pop().replace(
  /([.-])([A-Za-z0-9_-]{8})(?=(\.lean)?\.[a-z0-9]+$)/,
  (m, _sep, h) => (/[A-Z]/.test(h) && /[a-z]/.test(h) ? '' : m));

// ---- districts: every row of each plate, by name ----------------------------------------------
const docsRow = (district) => {
  const r = DOCS_PLATE.rows.find((x) => x.district === district);
  if (!r) throw new Error(`appendix A4: census-shipped.json has no district named ${district}`);
  return { id: district, name: district, deploy: 'docs', f: r.files, gz: r.gz, top: r.top };
};
const selfRow = (district) => {
  const r = SELF.rows.find((x) => x.district === district);
  if (!r) throw new Error(`appendix A4: district ${district} is missing from www/atlas.lit-ui-router.dev/data/survey-shipped.json`);
  return { id: district, name: district, deploy: 'atlas', f: r.files, raw: r.raw, gz: r.gz, top: r.top };
};
const sum = (rows) => rows.reduce((a, r) => ({ f: a.f + r.f, gz: a.gz + r.gz, k: a.k + 1 }), { f: 0, gz: 0, k: 0 });
const DOCS = { f: DOCS_PLATE.totals.files, gz: DOCS_PLATE.totals.gzBytes, k: DOCS_PLATE.rows.length };
const AT = { f: SELF.totals.files, raw: SELF.totals.rawBytes, gz: SELF.totals.gzBytes, k: SELF.rows.length };
if (!WORD[DOCS.k] || !WORD[AT.k]) throw new Error(`appendix A4: no number word for ${DOCS.k} or ${AT.k} districts — extend WORD`);

// ---- roles: sheet 9's three for the docs deploy, and three of the atlas's, each beside its counterpart
const ATLAS_ROLES = [
  { name: 'the pictures', beside: 'demo payload', districts: ['card pictures', 'the share card', 'models', 'icons'] },
  { name: 'the plates', beside: 'the documentation site', districts: ['routed pages', 'bare plates', 'plate fragments'] },
  { name: 'the app and its lanes', beside: 'the routed apps', districts: ['the routed app', 'model viewer', 'cytoscape', 'manifest'] },
];
for (const role of ATLAS_ROLES) {
  if (!ROLES.some((r) => r.name === role.beside)) throw new Error(`appendix A4: ${role.name} stands beside ${role.beside}, which sheet 9 does not export as a role`);
}
if (ATLAS_ROLES.map((r) => r.beside).join() !== ROLES.map((r) => r.name).join()) throw new Error('appendix A4: the atlas\'s roles are not in sheet 9\'s role order');
for (const { district } of SELF.rows) {
  const claims = ATLAS_ROLES.filter((r) => r.districts.includes(district)).length;
  if (claims !== 1) throw new Error(`appendix A4: atlas district ${district} is claimed by ${claims} roles, not one`);
}
const roleOf = (deploy, district) => (deploy === 'docs' ? ROLES : ATLAS_ROLES).find((r) => r.districts.includes(district)).name;

// ---- the city lots, back to front: the tallest stand at the back, and a district with no lot is a build error
const DOCS_LOTS = [
  ['html pages', 'markdown pages', 'examples', 'inter fonts'],
  ['page chunks', 'images', 'vp framework', 'diagrams'],
  ['app: vanilla', 'app: signals', 'app: effect', 'app: mobx', 'app: hash', 'static data', 'site css'],
];
const ATLAS_LOTS = [
  ['card pictures', 'routed pages', 'model viewer', 'bare plates'],
  ['plate fragments', 'the routed app', 'models', 'cytoscape'],
  ['the share card', 'icons', 'manifest'],
];
const DOCS_M = DOCS_LOTS.flat().map(docsRow);
const ATLAS_M = ATLAS_LOTS.flat().map(selfRow);
if (DOCS_M.length !== DOCS_PLATE.rows.length) throw new Error('appendix A4: census-shipped.json carries a district this plate does not lot');
if (ATLAS_M.length !== SELF.rows.length) throw new Error('appendix A4: survey-shipped.json carries a district this plate does not lot');
const self = (name) => ATLAS_M.find((m) => m.id === name);

// ---- the groups, in schedule order: six summed roles, then the two cities ------------------------
const roleGroup = (deploy, role, rows) => ({
  kind: 'role', deploy, name: role.name, districts: role.districts, beside: role.beside,
  members: [{ id: role.name, name: role.name, deploy, ...sum(role.districts.map(rows)) }],
});
const GROUPS = [
  ...ROLES.map((role) => roleGroup('docs', role, docsRow)),
  ...ATLAS_ROLES.map((role) => roleGroup('atlas', role, selfRow)),
  { kind: 'city', deploy: 'docs', name: 'the docs deploy', lots: DOCS_LOTS, members: DOCS_M },
  { kind: 'city', deploy: 'atlas', name: 'the atlas deploy', lots: ATLAS_LOTS, members: ATLAS_M },
];
// the by-role totals reconcile each plate's own totals
const roleTotal = (deploy) => sum(GROUPS.filter((g) => g.kind === 'role' && g.deploy === deploy).map((g) => g.members[0]));
if (roleTotal('docs').gz !== DOCS.gz || roleTotal('docs').f !== DOCS.f) throw new Error('appendix A4: sheet 9\'s roles do not sum to its plate');
if (roleTotal('atlas').gz !== AT.gz || roleTotal('atlas').f !== AT.f) throw new Error('appendix A4: the atlas\'s roles do not sum to survey-shipped.json');

// ---- the computed claims -------------------------------------------------------------------
const RATIO = (AT.gz / DOCS.gz).toFixed(1);
const RANKED = [...ATLAS_M].sort((a, b) => b.gz - a.gz);
const TOP = RANKED[0];
const DOCS_TOP = [...DOCS_M].sort((a, b) => b.gz - a.gz)[0];
const PAGES = self('routed pages'), PLATES = self('bare plates'), FRAGS = self('plate fragments');
const PICS = self('card pictures'), VIEWER = self('model viewer'), APP = self('the routed app');
const roleMass = (deploy, name) => GROUPS.find((g) => g.kind === 'role' && g.deploy === deploy && g.name === name).members[0];
const CLAIM_SIZE = AT.gz > DOCS.gz
  ? `${RATIO}× the docs deploy it draws, on the wire: ${MB(AT.gz)} gzipped against ${MB(DOCS.gz)}, in ${fmt(AT.f)} files against ${fmt(DOCS.f)}`
  : `under the docs deploy it draws, on the wire: ${MB(AT.gz)} gzipped against ${MB(DOCS.gz)}, in ${fmt(AT.f)} files against ${fmt(DOCS.f)}`;
const CLAIM_ROLES = `by role, ${ATLAS_ROLES.map((r) => {
  const a = roleMass('atlas', r.name), d = roleMass('docs', r.beside);
  return `${r.name} ${KB(a.gz)} against ${r.beside} ${KB(d.gz)} (${(a.gz / d.gz).toFixed(1)}×)`;
}).join(' · ')}`;
const CLAIM_TALLEST = `the tallest district is ${TOP.name}, ${KB(TOP.gz)} in ${TOP.f} files — ${(TOP.gz / DOCS_TOP.gz).toFixed(1)}× the docs deploy's tallest, ${DOCS_TOP.name} at ${KB(DOCS_TOP.gz)}`;
const CLAIM_WIRE = `${TOP.name} keep ${pct(TOP.gz, TOP.raw)} of their raw bytes through gzip; the routed pages keep ${pct(PAGES.gz, PAGES.raw)}`;
const CLAIM_THRICE = `every plate ships three times — inside its routed page, as a bare plate and as a fragment: ${KB(PAGES.gz)} + ${KB(PLATES.gz)} + ${KB(FRAGS.gz)}`;
const CLAIM_VIEWER = `the 3D lane's viewer and its decoders, ${KB(VIEWER.gz)}, outweigh the routed app itself, ${KB(APP.gz)}, ${(VIEWER.gz / APP.gz).toFixed(1)} to 1`;
const CLAIM_GHOST = SELF.orphans.length === 0
  ? 'and no ghost district stands here: every file in the deploy is reached from a page, by reference or by a seeded path'
  : `and a ghost district of ${SELF.orphans.length} files stands here, unreached from any page`;
// the cover index's fit verdict, told from the two plates
export const SHEETA4_VERDICT = `meta — the atlas's own deploy on sheet 9's ruler, by role and by district: ${fmt(AT.f)} files, ${MB(AT.gz)} on the wire against the docs deploy's ${MB(DOCS.gz)}, ${AT.gz > DOCS.gz ? `${RATIO}× the site it draws` : 'under the site it draws'}; the tallest district is ${TOP.name} at ${KB(TOP.gz)}`;

// ---- geometry ---------------------------------------------------------------------------------
const C = 0.866;
const LOT_GAP = 18;   // between a city's districts
const PAD = 16;       // a city's frame, plan units outside its masses; a summed role is its own block
// local plan placement inside a group: one lot for a role, lot rows for a city
const lotGroup = (g) => {
  if (g.kind === 'role') { g.masses[0].lx = 0; g.masses[0].ly = 0; return; }
  const at = (id) => g.masses.find((b) => b.id === id);
  let y = 0;
  for (const row of g.lots) {
    let x = 0;
    for (const id of row) { const b = at(id); b.lx = x; b.ly = y; x += b.s + LOT_GAP; }
    y += Math.max(...row.map((id) => at(id).s)) + LOT_GAP;
  }
};
const rect = (b, ox, oy) => ({ n: b.n, name: b.name, part: 'block', x: ox + b.lx, y: oy + b.ly, w: b.s, d: b.s });
const boxGroup = (g) => {
  const rs = g.masses.map((b) => rect(b, 0, 0));
  const pad = g.kind === 'city' ? PAD : 0;
  g.box = [Math.min(...rs.map((r) => r.x)) - pad, Math.min(...rs.map((r) => r.y)) - pad,
    Math.max(...rs.map((r) => r.x + r.w)) + pad, Math.max(...rs.map((r) => r.y + r.d)) + pad];
  // how far the tallest roof rises above the frame's near corner, on screen
  const [, , x2, y2] = g.box;
  g.rise = Math.max(...rs.map((r) => (x2 + y2) * 0.5 - ((r.x + r.y) * 0.5 - g.masses.find((m) => m.n === r.n).h)));
};
// every mass is sheet 9's SIDE() and HT() times the drawing's zoom
const massAll = (zoom) => {
  let n = 0;
  for (const g of GROUPS) g.masses = g.members.map((m) => ({ ...m, n: ++n, s: zoom * SIDE(m.f), h: zoom * HT(m.gz) }));
  for (const g of GROUPS) { lotGroup(g); boxGroup(g); }
};

// screen placement: a frame's left corner at sx, its near corner on the ground line gy
const place = (g, sx, gy) => {
  const [x1, y1, x2, y2] = g.box;
  const u = sx / C - x1 + y2, v = 2 * gy - x2 - y2;
  g.ox = (u + v) / 2; g.oy = (v - u) / 2;
  g.left = sx; g.right = (u + x2 - y1) * C; g.ground = gy;
};
const HEAD = 104;          // the header band's foot
const SEAM_W = 60;         // screen px across the seam between the two deploys
const SLOT_MIN = 140;      // a role's lettering slot, screen px, where its block is narrower
const GAP_MIN = 8;         // screen px between two slots
const ZOOM_MIN = 0.8;      // the smallest fraction of sheet 9's ruler this sheet draws at
const ROLE_ROW = GROUPS.filter((g) => g.kind === 'role');
const CITY_ROW = GROUPS.filter((g) => g.kind === 'city');
const west = (row) => row.filter((g) => g.deploy === 'docs');
const east = (row) => row.filter((g) => g.deploy === 'atlas');
const slot = (g) => Math.max(g.w, g.kind === 'role' ? SLOT_MIN : 0);
const need = (row) => row.reduce((a, g) => a + slot(g), 0) + SEAM_W + GAP_MIN * (row.length - 2) + 40;
// the largest hundredth of sheet 9's ruler at which both rows fit 1520 with their minimum gaps and slot floors
let ZOOM = 1;
for (;;) {
  massAll(ZOOM);
  for (const g of GROUPS) { place(g, 0, 0); g.w = g.right; }
  if (Math.max(need(ROLE_ROW), need(CITY_ROW)) <= 1520) break;
  ZOOM = Math.round(ZOOM * 100 - 1) / 100;
  if (ZOOM < ZOOM_MIN) throw new Error(`appendix A4: the rows need ${need(ROLE_ROW).toFixed(0)} and ${need(CITY_ROW).toFixed(0)} px even at ${ZOOM_MIN}× sheet 9's ruler, past the sheet's 1520 — the ${SLOT_MIN} px slot floors and ${GAP_MIN} px gaps leave no fit`);
}
const ZOOM_LINE = ZOOM === 1
  ? `drawn at full scale: both rows fit 1,520 px with ${GAP_MIN} px gaps and ${SLOT_MIN} px lettering slots`
  : `drawn at ${ZOOM}× that ruler, the largest hundredth at which both rows fit 1,520 px with ${GAP_MIN} px gaps and ${SLOT_MIN} px lettering slots`;
// a row's blocks stand on one ground line under the header, or under the row above; the gap between them closes up to fit 1520
const layRow = (row, gy) => {
  const GAP = Math.min(40, (1520 - 40 - SEAM_W - row.reduce((a, g) => a + slot(g), 0)) / (row.length - 2));
  if (GAP < GAP_MIN) throw new Error(`appendix A4: a row of ${row.length} blocks needs ${need(row).toFixed(0)} px at ${ZOOM}× sheet 9's ruler, past the sheet's 1520`);
  let sx = 40, seam = 0;
  for (const g of row) {
    if (g.deploy === 'atlas' && !seam) { sx += SEAM_W - GAP; seam = sx - SEAM_W / 2; }
    const pad = (slot(g) - g.w) / 2;
    place(g, sx + pad, gy);
    g.slotL = sx; g.slotR = sx + slot(g);
    sx = g.slotR + GAP;
  }
  if (row.at(-1).slotR - 1520 > 1e-6) throw new Error(`appendix A4: the row runs to ${row.at(-1).slotR.toFixed(0)}, past the sheet's 1520`);
  return seam;
};
// lettering under a role: name, its districts wrapped to the slot, the wire, the summing line
const wire = (m) => `${fmt(m.f)} files · ${KB(m.gz)} gzipped`;
const wrap = (words, width) => words.reduce((lines, w) => {
  const last = lines.at(-1);
  if (last && `${last} · ${w}`.length * 6.3 <= width) lines[lines.length - 1] = `${last} · ${w}`;
  else lines.push(w);
  return lines;
}, []);
for (const g of ROLE_ROW) g.lines = wrap(g.districts, slot(g) + 28);
const LABEL_H1 = 22 + 13 * (1 + Math.max(...ROLE_ROW.map((g) => g.lines.length))) + 14 + 13 + 26;
const LABEL_H2 = 92;
const GY1 = HEAD + 22 + Math.max(...ROLE_ROW.map((g) => g.rise));
const SX1 = layRow(ROLE_ROW, GY1);
const GY2 = GY1 + LABEL_H1 + 40 + Math.max(...CITY_ROW.map((g) => g.rise));
const SX2 = layRow(CITY_ROW, GY2);

for (const g of GROUPS) for (const b of g.masses) b.block = rect(b, g.ox, g.oy);
const ALL = GROUPS.flatMap((g) => g.masses);
assertPlots('appendix A4', ALL.map((b) => b.block));
// one ruler: every mass is sheet 9's SIDE() of its files and HT() of its gzipped bytes
for (const b of ALL) if (b.s !== ZOOM * SIDE(b.f) || b.h !== ZOOM * HT(b.gz)) throw new Error(`appendix A4: ${b.name} is not massed by sheet 9's ruler at ${ZOOM}×`);

const pt = (x, y, z = 0) => isoPt(0, 0, x, y, z);
const p2 = (x, y, z = 0) => pt(x, y, z).map((v) => v.toFixed(1)).join(',');

// ---- masses ------------------------------------------------------------------------------------
const LOOK = {
  docs: { edge: 'sk', cap: 'fp', side: `url(#${P}-hx)`, badge: 'sk fp', num: 'lbl' },
  atlas: { edge: 'ska', cap: 'fp', side: `url(#${P}-ha)`, badge: 'ska fp', num: 'lbla' },
};
const lookOf = (b) => LOOK[b.deploy];
const masses = depthSort(ALL.map((b) => {
  const t = lookOf(b), r = b.block;
  return { ...r, svg: solidFaces(isoBlock(P, 0, 0, r.x, r.y, r.w, r.d, b.h, { capCls: t.cap, edge: t.edge, sideFill: t.side })) };
})).map((m) => m.svg).join('\n');

// badges ride above the back edge of a summed role, and sit on the roof of a city's district
const CITY_M = new Set(CITY_ROW.flatMap((g) => g.masses));
const badgeAt = (b) => {
  const r = b.block;
  const onRoof = CITY_M.has(b);
  const [bx, by] = pt(r.x + r.w / 2, r.y + (onRoof ? r.d / 2 : 0), b.h);
  return [bx, by - (onRoof ? 0 : 16)];
};
const badge = (b) => {
  const t = lookOf(b), [bx, by] = badgeAt(b);
  return `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="9" class="${t.badge}"/>
${txt(bx.toFixed(1), (by + 3.4).toFixed(1), String(b.n), t.num, 'middle')}`;
};
const frame = (g) => {
  const [x1, y1, x2, y2] = g.box;
  const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(([x, y]) => p2(g.ox + x, g.oy + y)).join(' ');
  return `<polygon points="${pts}" class="${g.deploy === 'atlas' ? 'ska' : 'skf'} fnone" stroke-dasharray="5 4"${g.deploy === 'atlas' ? ' opacity="0.7"' : ''}/>`;
};

// ---- lettering ------------------------------------------------------------------------------------
const roleLabels = ROLE_ROW.map((g) => {
  const m = g.masses[0];
  const x = ((g.slotL + g.slotR) / 2).toFixed(0);
  const y = g.ground + 22;
  const tail = y + 13 * (1 + g.lines.length);
  return [txt(x, y, g.name.toUpperCase(), g.deploy === 'atlas' ? 'lbla' : 'lblb', 'middle'),
    ...g.lines.map((s, i) => txt(x, y + 13 * (i + 1), s, 'lbls', 'middle')),
    txt(x, tail + 1, wire(m), 'lblf', 'middle'),
    txt(x, tail + 14, `${g.deploy === 'docs' ? "sheet 9's " : ''}${WORD[m.k]} districts, summed`, 'lblf', 'middle')].join('\n');
}).join('\n');
const cityLabels = CITY_ROW.map((g) => {
  const x = ((g.left + g.right) / 2).toFixed(0);
  const t = g.deploy === 'atlas'
    ? { head: 'app/dist — THE ATLAS DEPLOY', cls: 'lbla', total: AT, basis: SELF_BASIS, orphans: SELF.orphans.length }
    : { head: 'docs/dist — THE DOCS DEPLOY', cls: 'lblb', total: DOCS, basis: DOCS_BASIS, orphans: DOCS_PLATE.orphans.length };
  return [txt(x, g.ground + 22, t.head, t.cls, 'middle'),
    txt(x, g.ground + 35, `${WORD[t.total.k]} districts · ${wire(t.total)} · ${t.orphans === 0 ? 'no orphans' : `${t.orphans} orphans`}`, 'lbls', 'middle'),
    txt(x, g.ground + 49, `measured at ${t.basis}`, 'lblf', 'middle')].join('\n');
}).join('\n');

// the seam between the two deploys, in each row, and the row's reading
const seams = `<line x1="${SX1.toFixed(0)}" y1="${HEAD + 14}" x2="${SX1.toFixed(0)}" y2="${GY1 + LABEL_H1 + 6}" class="skf" stroke-dasharray="2 5"/>
${txt(40, GY1 + LABEL_H1 - 8, `BY ROLE · WEST — THE DOCS DEPLOY, FROM data/census-shipped.json · ${DOCS_BASIS} · sheet 9's ${WORD[west(ROLE_ROW).length]} roles, each summed`, 'lblf')}
${txt(1520, GY1 + LABEL_H1 - 8, `EAST — THE ATLAS DEPLOY, FROM data/survey-shipped.json · ${SELF_BASIS} · ${WORD[east(ROLE_ROW).length]} roles, each summed, in sheet 9's order`, 'lblf', 'end')}
<line x1="${SX2.toFixed(0)}" y1="${GY1 + LABEL_H1 + 20}" x2="${SX2.toFixed(0)}" y2="${GY2 + LABEL_H2 + 6}" class="skf" stroke-dasharray="2 5"/>
${txt(40, GY2 + LABEL_H2 - 8, `BY DISTRICT · WEST — THE DOCS DEPLOY, sheet 9's ${WORD[DOCS.k]} districts on their own lots`, 'lblf')}
${txt(1520, GY2 + LABEL_H2 - 8, `EAST — THE ATLAS DEPLOY, ${WORD[AT.k]} districts on their own lots, outside the cabinet`, 'lblf', 'end')}`;

const AY = GY2 + LABEL_H2 + 34;
const CLAIMS = [CLAIM_SIZE, CLAIM_ROLES, CLAIM_TALLEST, CLAIM_WIRE, CLAIM_THRICE, CLAIM_VIEWER, CLAIM_GHOST];
const claims = `${txt(40, AY, 'WHAT THE DRAWING SAYS — every line computed from the two plates', 'lblb')}
${CLAIMS.map((s, i) => txt(40, AY + 18 + i * 16, s, i ? 'lbls' : 'lblb')).join('\n')}`;
const ART_H = AY + 18 + CLAIMS.length * 16 + 4;

// ---- schedule ----------------------------------------------------------------------------------------
const roleRow = (g) => { const m = g.masses[0]; return [m.n, `${g.name} — ${wire(m)} · ${g.deploy === 'docs' ? `sheet 9's ${m.k}` : m.k} districts, summed${g.beside ? ` · beside ${g.beside}` : ''}`]; };
const districtRow = (b) => [b.n, `${b.name} — ${b.f}f ${KB(b.gz)} · ${tenant(b.top.name)} ${KB(b.top.gz)} · ${roleOf(b.deploy, b.id)}`];
const leftRows = [...ROLE_ROW.map(roleRow), ...west(CITY_ROW)[0].masses.map(districtRow)];
const wireRows = [
  `every file under app/dist, raw and at gzip level 9: ${fmt(AT.raw)} raw bytes, ${fmt(AT.gz)} on the wire`,
  `reached from every page by reference, and seeded where the path is computed: ${SELF.seededTrees.join(' · ')}`,
  SELF.orphans.length === 0 ? 'orphans: none — the walk reaches every file the deploy carries' : `orphans: ${SELF.orphans.map((o) => o.file).join(' · ')}`,
  `the card pictures: ${PICS.f} webp, two per plate (paper and cyanotype), ${THUMB_W}×${THUMB_H} at ${THUMB_SCALE}× — ${pct(PICS.gz, AT.gz)} of the wire`,
  `the plates: ${PAGES.f} routed pages carry their fragments, ${PLATES.f} bare plates stand without the router, ${FRAGS.f} fragments feed the client`,
  `the docs deploy: ${fmt(DOCS.f)} files · ${MB(DOCS.gz)} · ${DOCS.k} districts at ${DOCS_BASIS}, read from sheet 9's own plate`,
];
const rightRows = east(CITY_ROW)[0].masses.map(districtRow);
const SY = ART_H + 16;
const WIRE_Y = 52 + (rightRows.length + 1) * 17;
const ROWS = Math.max(leftRows.length, rightRows.length + 2 + wireRows.length);
const SH = 74 + ROWS * 17;
const schedule = `<rect x="40" y="${SY}" width="1480" height="${SH}" class="sk fp"/>
${txt(58, SY + 22, 'STRUCTURE SCHEDULE — files · gzipped wire bytes · largest tenant · role', 'lbls')}
${txt(800, SY + 22, 'STRUCTURE SCHEDULE, EAST — the atlas deploy\'s districts', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1520" y2="${SY + 32}" class="skf"/>
<line x1="782" y1="${SY + 32}" x2="782" y2="${SY + 40 + ROWS * 17}" class="skf"/>
${leftRows.map((r, i) => schedTxt(58, SY + 52 + i * 17, r, 'lbls')).join('\n')}
${rightRows.map((r, i) => schedTxt(800, SY + 52 + i * 17, r, 'lbls')).join('\n')}
${txt(800, SY + WIRE_Y, 'THE WIRE — what is measured, what is seeded', 'lbls')}
${wireRows.map((r, i) => txt(800, SY + WIRE_Y + 17 + i * 17, r, 'lblf')).join('\n')}
${txt(58, SY + 58 + ROWS * 17, `TOTAL — the docs deploy ${fmt(DOCS.f)} files · ${MB(DOCS.gz)} gzipped at ${DOCS_BASIS} · the atlas deploy ${fmt(AT.f)} files · ${MB(AT.gz)} gzipped at ${SELF_BASIS} · ${SELF.wasAssociatedWith.at(-1)}`, 'lbls')}`;
const VB_H = SY + SH + 30;

// every cap corner and badge stays inside the frame: a grown district cannot ship cut off
for (const b of ALL) {
  const r = b.block, [bx, by] = badgeAt(b);
  const pts = [
    ...[[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.d], [r.x, r.y + r.d]].map(([x, y]) => ['cap', ...pt(x, y, b.h)]),
    ['badge', bx - 9, by], ['badge', bx + 9, by], ['badge', bx, by - 9], ['badge', bx, by + 9],
  ];
  for (const [part, px, py] of pts) {
    if (px < 0 || py < HEAD || px > VB_W || py > VB_H) throw new Error(`appendix A4: the ${part} of ${b.name} stands outside the ${VB_W} × ${VB_H} frame at ${px.toFixed(1)},${py.toFixed(1)} — move its lot`);
  }
}

const ARIA = `An isometric survey of the atlas's own deploy, standing beside the docs deploy it draws, on sheet 9's ruler at two altitudes: footprint area from file counts, height from gzipped bytes on the wire. `
  + `Along the top, by role, sheet 9's three roles of the docs deploy each stand as one summed block west of a dotted seam, and three roles of the atlas deploy stand east of it in the same order: `
  + ROLE_ROW.map((g) => `${g.name}, ${wire(g.masses[0])}`).join('; ') + '. '
  + `Below, by district, the docs deploy stands west as ${WORD[DOCS.k]} districts in one frame on main's ground at ${DOCS_BASIS}, and the atlas deploy east as ${WORD[AT.k]} accent-edged districts in one frame on its own branch at ${SELF_BASIS}: `
  + ATLAS_M.map((b) => `${b.name}, ${wire(b)}`).join('; ') + `. `
  + `${CLAIM_SIZE}; ${CLAIM_ROLES}; ${CLAIM_TALLEST}; ${CLAIM_THRICE}; ${CLAIM_GHOST}. A structure schedule lists every block, and beside it what the survey measures and seeds.`;

const svg = `<svg viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-label="${ARIA}">
${defs(P)}

<rect x="40" y="26" width="520" height="42" class="skf fnone"/>
${txt(52, 43, 'THE ATLAS, SHIPPED — ON THE WIRE, ON SHEET 9\'S RULER, AT TWO ALTITUDES', 'lbls')}
${txt(52, 58, `by role above, by district below · the docs deploy west, the atlas deploy east · one SIDE() and HT(), imported from sheet 9`, 'lblf')}

${txt(1520, 34, `SCALE — footprint area ∝ files (side = ${KS} · √files, floored at ${FLOOR}) · 1 px of height ≈ ${KB_PER_PX} KB gzipped, floored at ${HT_FLOOR} — sheet 9's functions, read back, not a copy`, 'lbls', 'end')}
${txt(1520, 48, `${ZOOM_LINE} · height is gzip level 9 of every file, the honest wire measure`, 'lblf', 'end')}
${txt(1520, 62, 'the atlas deploy is app/dist built from an archive of its own branch — the routed pages, the bare plates, the fragments, the pictures, the models and the scripts', 'lblf', 'end')}
${txt(1520, 76, 'every number on this sheet is read from data/census-shipped.json and data/survey-shipped.json at build time', 'lblf', 'end')}

${CITY_ROW.map(frame).join('\n')}
${masses}
${ALL.map(badge).join('\n')}
${roleLabels}
${cityLabels}
${seams}
${claims}

${schedule}
</svg>`;

// the homes the notes name: sheet 9's filed plate, the survey, and the deploy itself
const REPO = 'https://github.com/simshanith/lit-ui-router';
const HOME = {
  plate: `${REPO}/blob/www/atlas/www/atlas.lit-ui-router.dev/data/census-shipped.json`,
  survey: `${REPO}/blob/www/atlas/www/atlas.lit-ui-router.dev/generator/survey-shipped.mjs`,
  site: 'https://atlas.lit-ui-router.dev',
  pages: 'https://pages.cloudflare.com',
};

export const sheetA4 = {
  num: 'A4', id: 'self-shipped', rev: 'C',
  head: 'APPENDIX A4 · META',
  appendix: true,
  title: 'THE ATLAS, SHIPPED',
  sub: `APPENDIX · META — the atlas's own deploy as a shipped city on sheet 9's ruler, by role and by district, standing beside the docs deploy it draws · ${fmt(AT.f)} files in ${WORD[AT.k]} districts, ${MB(AT.gz)} on the wire · ${SELF_LINE}`,
  scale: 'THE ATLAS ITSELF',
  form: 'SHIPPED CITY',
  svg,
  caption: `The atlas's own deploy surveyed on the wire with sheet 9's instrument at two altitudes: footprint ∝ files, height ∝ gzipped bytes, from sheet 9's functions. By role, ${WORD[west(ROLE_ROW).length]} summed blocks of the docs deploy stand west of ${WORD[east(ROLE_ROW).length]} of the atlas's; by district, the docs deploy's ${WORD[DOCS.k]} stand west of the atlas's ${WORD[AT.k]} — ${CLAIM_SIZE}.`,
  notes: `
<p><strong>Method — one ruler, two deploys, two altitudes.</strong> Every block on this plate is massed by <code>SIDE()</code> and <code>HT()</code> imported from <code>sheet9.mjs</code> — footprint side ${KS} · √files, floored at ${FLOOR}; height one pixel per ${fmt(BYTES_PER_PX)} gzipped bytes, floored at ${HT_FLOOR}, the constants read back off the functions themselves — and every file is weighed the way sheet 9 weighs it: raw bytes and gzip level 9, the honest wire measure, since the CDN serves compressed. The two halves stand on different grounds and say so. The docs deploy is <a href="${HOME.plate}"><code>data/census-shipped.json</code></a>, ${DOCS_BASIS}, the cabinet sheet 9 reads. The atlas is not on main, so it cannot be in that cabinet: it is <code>data/survey-shipped.json</code>, written by <a href="${HOME.survey}"><code>generator/survey-shipped.mjs</code></a> from a <code>git archive</code> of its own branch — ${SELF_BASIS}, committed ${SELF.commitDate.slice(0, 10)} — in which the app is built by its own <code>npm ci</code> and <code>npm run build</code>, the vite build and the prerender, and <code>app/dist</code> is measured file by file: ${fmt(AT.f)} files, ${MB(AT.raw)} on disk, ${MB(AT.gz)} on the wire. That is what <a href="${HOME.pages}">Cloudflare Pages</a> serves at <a href="${HOME.site}">atlas.lit-ui-router.dev</a>. A reachability walk from every page sorts the files into districts, and a path the app computes at runtime — a fragment by the manifest's <code>file</code>, the manifest by the router's base, the visualizer's icons by its stylesheet — is seeded rather than reported as a false orphan.</p>
<p><strong>Two altitudes, one ruler.</strong> The sheet draws both deploys twice, at one scale: sheet 9's ruler ${ZOOM_LINE.replace(' that ruler', '')}.Along the top, <em>by role</em>: sheet 9's ${WORD[west(ROLE_ROW).length]} roles of the docs deploy, read from its exported <code>ROLES</code>, each summed into one block, and ${WORD[east(ROLE_ROW).length]} roles of the atlas deploy in the same order, each beside its counterpart — ${ATLAS_ROLES.map((r) => `${r.name} beside ${r.beside}`).join(', ')}. Below, <em>by district</em>: every district of each deploy on its own lot, the docs deploy's ${WORD[DOCS.k]} west of the atlas's ${WORD[AT.k]}. A role's block and a district's block are massed by the same two functions, so a block in either row reads against any other at the same altitude, and a role against its own districts. Summing is honest on this ruler for plan area — area ∝ files, so one block of a role's sum covers the same ground its districts do — and approximate for height, which reads a role's total bytes as one tower. The by-role totals reconcile each plate's own totals, every atlas district is claimed by exactly one role, and sheet 9 throws when a district on its plate is claimed by no role or two, so the two plates cannot disagree.</p>
<p><strong>What the drawing says.</strong> The atlas deploy is ${CLAIM_SIZE}; ${CLAIM_ROLES}. ${CLAIM_TALLEST.charAt(0).toUpperCase() + CLAIM_TALLEST.slice(1)}. The pictures are the whole story of the weight: a card picture is a webp, already compressed, so ${CLAIM_WIRE} — the lettering and markup of a deploy shrink on the wire and its pictures do not. The plates themselves ship in triplicate: ${CLAIM_THRICE} — the routed page carries its plate server-rendered, the bare plate stands for a reader who opts out of the router, and the fragment feeds the client's own navigation. Below those, ${CLAIM_VIEWER}, ${CLAIM_GHOST}. Every claim in this paragraph is computed from the two plates and changes its wording when the plates change it.</p>
<p><strong>What the pictures are for.</strong> The ${PICS.f} card pictures are the cover's cards: one per plate in each theme, ${THUMB_W}×${THUMB_H} CSS pixels drawn at ${THUMB_SCALE}×, so a card holds up on a retina display and the cyanotype theme has a picture of its own rather than an inverted one. They are ${pct(PICS.gz, AT.gz)} of the wire and arrive lazily, as the gallery scrolls; the first page a reader lands on is ${KB(PAGES.top.gz)} at most, the heaviest routed page, and a plate's own page carries nothing of the pictures at all. The weight is real and the drawing shows it; whether it is the right weight is a question for the cover, not for this ruler.</p>`,
  key: [
    keyRow('<rect x="6" y="3" width="36" height="12" class="sk fp"/>', 'a block of the docs deploy — a role summed, by role; one district, by district — footprint ∝ files, height ∝ gzipped bytes'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="fp"/><rect x="6" y="3" width="36" height="12" fill="url(#sA4-ha)"/><rect x="6" y="3" width="36" height="12" class="ska fnone"/>', 'a block of the atlas deploy — the same rule, on its own branch'),
    keyRow('<line x1="23" y1="2" x2="23" y2="16" class="sk"/><line x1="18" y1="2" x2="28" y2="2" class="sk"/><line x1="18" y1="16" x2="28" y2="16" class="sk"/>', `the ruler is sheet 9's, read back off its SIDE() and HT(): side = ${KS} · √files, floored at ${FLOOR}; 1 px of height ≈ ${KB_PER_PX} KB gzipped, floored at ${HT_FLOOR}; ${ZOOM_LINE}`),
    keyRow('<rect x="4" y="2" width="26" height="13" class="ska fnone" stroke-dasharray="4 3"/>', 'a deploy\'s frame, by district'),
    keyRow('<line x1="23" y1="1" x2="23" y2="17" class="skf" stroke-dasharray="2 5"/>', 'the seam between main\'s ground and the atlas\'s'),
  ].join('\n'),
};
