import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, schedTxt, isoBlock, isoPt, keyRow } from './helpers.mjs';
import { assertPlots, depthSort, solidFaces } from './iso-hidden.mjs';
import { HT, ROLES, SIDE } from './sheet9.mjs';
import { THUMB_H, THUMB_SCALE, THUMB_W } from './thumb-spec.mjs';

const P = 'sA4';

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
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
// vite hashes: an 8-char mixed-case segment, dot- or dash-joined, before the extension
const tenant = (p) => p.split('/').pop().replace(
  /([.-])([A-Za-z0-9_-]{8})(?=(\.lean)?\.[a-z0-9]+$)/,
  (m, _sep, h) => (/[A-Z]/.test(h) && /[a-z]/.test(h) ? '' : m));

// ---- the docs deploy: sheet 9's roles, each summed from the rows it groups ---------------
const docsRow = (district) => {
  const r = DOCS_PLATE.rows.find((x) => x.district === district);
  if (!r) throw new Error(`appendix A4: census-shipped.json has no district named ${district}`);
  return r;
};
const sum = (rows) => rows.reduce((a, r) => ({ f: a.f + r.files, gz: a.gz + r.gz, k: a.k + 1 }), { f: 0, gz: 0, k: 0 });
const GROUPS = ROLES.map((role) => ({
  key: role.name, name: role.name, atlas: false, districts: role.districts,
  members: [{ name: role.name, ...sum(role.districts.map(docsRow)) }],
}));
const DOCS = sum(DOCS_PLATE.rows);
if (GROUPS.reduce((a, g) => a + g.members[0].gz, 0) !== DOCS.gz) throw new Error('appendix A4: sheet 9\'s roles do not sum to its plate');

// ---- the atlas deploy: every district from data/survey-shipped.json -----------------------
// lot rows, back to front; the tallest stand at the back, and a district with no lot is a build error
const ATLAS_LOTS = [
  ['card pictures', 'routed pages', 'model viewer', 'bare plates'],
  ['plate fragments', 'the routed app', 'models', 'cytoscape'],
  ['icons', 'manifest'],
];
const selfRow = (name) => {
  const r = SELF.rows.find((x) => x.district === name);
  if (!r) throw new Error(`appendix A4: district ${name} is missing from www/atlas.lit-ui-router.dev/data/survey-shipped.json`);
  return { id: name, name, f: r.files, raw: r.raw, gz: r.gz, top: r.top };
};
const ATLAS_M = ATLAS_LOTS.flat().map(selfRow);
if (ATLAS_M.length !== SELF.rows.length) throw new Error('appendix A4: survey-shipped.json carries a district this plate does not lot');
const AT = { f: SELF.totals.files, raw: SELF.totals.rawBytes, gz: SELF.totals.gzBytes, k: ATLAS_M.length };
const self = (name) => ATLAS_M.find((m) => m.id === name);

// ---- the computed claims -------------------------------------------------------------------
const RATIO = (AT.gz / DOCS.gz).toFixed(1);
const RANKED = [...ATLAS_M].sort((a, b) => b.gz - a.gz);
const TOP = RANKED[0];
const DOCS_TOP = [...DOCS_PLATE.rows].sort((a, b) => b.gz - a.gz)[0];
const PAGES = self('routed pages'), PLATES = self('bare plates'), FRAGS = self('plate fragments');
const PICS = self('card pictures'), VIEWER = self('model viewer'), APP = self('the routed app');
const CLAIM_SIZE = AT.gz > DOCS.gz
  ? `${RATIO}× the docs deploy it draws, on the wire: ${MB(AT.gz)} gzipped against ${MB(DOCS.gz)}, in ${fmt(AT.f)} files against ${fmt(DOCS.f)}`
  : `under the docs deploy it draws, on the wire: ${MB(AT.gz)} gzipped against ${MB(DOCS.gz)}, in ${fmt(AT.f)} files against ${fmt(DOCS.f)}`;
const CLAIM_TALLEST = `the tallest district is ${TOP.name}, ${KB(TOP.gz)} in ${TOP.f} files — ${(TOP.gz / DOCS_TOP.gz).toFixed(1)}× the docs deploy's tallest, ${DOCS_TOP.district} at ${KB(DOCS_TOP.gz)}`;
const CLAIM_WIRE = `${TOP.name} keep ${pct(TOP.gz, TOP.raw)} of their raw bytes through gzip; the routed pages keep ${pct(PAGES.gz, PAGES.raw)}`;
const CLAIM_THRICE = `every plate ships three times — inside its routed page, as a bare plate and as a fragment: ${KB(PAGES.gz)} + ${KB(PLATES.gz)} + ${KB(FRAGS.gz)}`;
const CLAIM_VIEWER = `the 3D lane's viewer and its decoders, ${KB(VIEWER.gz)}, outweigh the routed app itself, ${KB(APP.gz)}, ${(VIEWER.gz / APP.gz).toFixed(1)} to 1`;
const CLAIM_GHOST = SELF.orphans.length === 0
  ? 'and no ghost district stands here: every file in the deploy is reached from a page, by reference or by a seeded path'
  : `and a ghost district of ${SELF.orphans.length} files stands here, unreached from any page`;
// the cover index's fit verdict, told from the two plates
export const SHEETA4_VERDICT = `meta — the atlas's own deploy on sheet 9's ruler: ${fmt(AT.f)} files, ${MB(AT.gz)} on the wire against the docs deploy's ${MB(DOCS.gz)}, ${AT.gz > DOCS.gz ? `${RATIO}× the site it draws` : 'under the site it draws'}; the tallest district is ${TOP.name} at ${KB(TOP.gz)}`;

GROUPS.push({ key: 'atlas', name: 'the atlas deploy', atlas: true, members: ATLAS_M });

// ---- geometry ---------------------------------------------------------------------------------
const C = 0.866;
const LOT_GAP = 18;   // between atlas districts
const PAD = 16;       // the atlas's frame, plan units outside its masses; a summed block is its own role
let n = 0;
const massOf = (m) => ({ ...m, n: ++n, s: SIDE(m.f), h: HT(m.gz) });
for (const g of GROUPS) g.masses = g.members.map(massOf);

// local plan placement inside a group: one lot, or the atlas's rows
for (const g of GROUPS) {
  if (!g.atlas) { g.masses[0].lx = 0; g.masses[0].ly = 0; continue; }
  const at = (id) => g.masses.find((b) => b.id === id);
  let y = 0;
  for (const row of ATLAS_LOTS) {
    let x = 0;
    for (const id of row) { const b = at(id); b.lx = x; b.ly = y; x += b.s + LOT_GAP; }
    y += Math.max(...row.map((id) => at(id).s)) + LOT_GAP;
  }
}
const rect = (b, ox, oy) => ({ n: b.n, name: b.name, part: 'block', x: ox + b.lx, y: oy + b.ly, w: b.s, d: b.s });
for (const g of GROUPS) {
  const rs = g.masses.map((b) => rect(b, 0, 0));
  const pad = g.atlas ? PAD : 0;
  g.box = [Math.min(...rs.map((r) => r.x)) - pad, Math.min(...rs.map((r) => r.y)) - pad,
    Math.max(...rs.map((r) => r.x + r.w)) + pad, Math.max(...rs.map((r) => r.y + r.d)) + pad];
  // how far the tallest roof rises above the frame's near corner, on screen
  const [, , x2, y2] = g.box;
  g.rise = Math.max(...rs.map((r) => (x2 + y2) * 0.5 - ((r.x + r.y) * 0.5 - g.masses.find((m) => m.n === r.n).h)));
}

// screen placement: a frame's left corner at sx, its near corner on the ground line gy
const place = (g, sx, gy) => {
  const [x1, y1, x2, y2] = g.box;
  const u = sx / C - x1 + y2, v = 2 * gy - x2 - y2;
  g.ox = (u + v) / 2; g.oy = (v - u) / 2;
  g.left = sx; g.right = (u + x2 - y1) * C; g.ground = gy;
};
const HEAD = 104;          // the header band's foot
const LABEL_H = 92;        // lettering under the ground line
const DOCSG = GROUPS.filter((g) => !g.atlas);
const ATLAS = GROUPS.find((g) => g.atlas);
// one ground line for both deploys: the tallest roof on either side stands under the header
const GY = HEAD + 22 + Math.max(...GROUPS.map((g) => g.rise));
for (const g of GROUPS) place(g, 0, GY);
// screen px between the blocks: 40, closed up as far as the row needs to fit in 1520
const SEAM_W = 60;
const GAP = Math.min(40, (1520 - 40 - SEAM_W - GROUPS.reduce((a, g) => a + g.right, 0)) / (GROUPS.length - 2));
let sx = 40;
for (const g of DOCSG) { place(g, sx, GY); sx = g.right + GAP; }
const SX = DOCSG.at(-1).right + SEAM_W / 2;
place(ATLAS, DOCSG.at(-1).right + SEAM_W, GY);
if (ATLAS.right > 1520) throw new Error(`appendix A4: the row runs to ${ATLAS.right.toFixed(0)}, past the sheet's 1520`);

for (const g of GROUPS) for (const b of g.masses) b.block = rect(b, g.ox, g.oy);
const ALL = GROUPS.flatMap((g) => g.masses);
assertPlots('appendix A4', ALL.map((b) => b.block));

const pt = (x, y, z = 0) => isoPt(0, 0, x, y, z);
const p2 = (x, y, z = 0) => pt(x, y, z).map((v) => v.toFixed(1)).join(',');

// ---- masses ------------------------------------------------------------------------------------
const LOOK = {
  docs: { edge: 'sk', cap: 'fp', side: `url(#${P}-hx)`, badge: 'sk fp', num: 'lbl' },
  atlas: { edge: 'ska', cap: 'fp', side: `url(#${P}-ha)`, badge: 'ska fp', num: 'lbla' },
};
const lookOf = (b) => (ATLAS.masses.includes(b) ? LOOK.atlas : LOOK.docs);
const masses = depthSort(ALL.map((b) => {
  const t = lookOf(b), r = b.block;
  return { ...r, svg: solidFaces(isoBlock(P, 0, 0, r.x, r.y, r.w, r.d, b.h, { capCls: t.cap, edge: t.edge, sideFill: t.side })) };
})).map((m) => m.svg).join('\n');

// badges ride above the back edge of a summed block, and sit on the roof of an atlas district
const badge = (b) => {
  const t = lookOf(b), r = b.block;
  const onRoof = ATLAS.masses.includes(b);
  const [bx, by] = pt(r.x + r.w / 2, r.y + (onRoof ? r.d / 2 : 0), b.h);
  const lift = onRoof ? 0 : 16;
  return `<circle cx="${bx.toFixed(1)}" cy="${(by - lift).toFixed(1)}" r="9" class="${t.badge}"/>
${txt(bx.toFixed(1), (by - lift + 3.4).toFixed(1), String(b.n), t.num, 'middle')}`;
};
const frame = (g) => {
  const [x1, y1, x2, y2] = g.box;
  const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(([x, y]) => p2(g.ox + x, g.oy + y)).join(' ');
  return `<polygon points="${pts}" class="ska fnone" stroke-dasharray="5 4" opacity="0.7"/>`;
};

// ---- lettering ------------------------------------------------------------------------------------
const wire = (m) => `${fmt(m.f)} files · ${KB(m.gz)} gzipped`;
const docsLabels = DOCSG.map((g) => {
  const m = g.masses[0];
  const x = ((g.left + g.right) / 2).toFixed(0);
  const y = g.ground + 22;
  return [txt(x, y, g.name.toUpperCase(), 'lblb', 'middle'), txt(x, y + 13, g.districts.join(' · '), 'lbls', 'middle'),
    txt(x, y + 27, wire(m), 'lblf', 'middle'), txt(x, y + 40, `sheet 9's ${WORD[m.k]} districts, summed`, 'lblf', 'middle')].join('\n');
}).join('\n');
const AX = ((ATLAS.left + ATLAS.right) / 2).toFixed(0);
const atlasLabels = [txt(AX, GY + 22, 'app/dist — THE ATLAS DEPLOY', 'lbla', 'middle'),
  txt(AX, GY + 35, `${WORD[AT.k]} districts · ${wire(AT)} · ${SELF.orphans.length === 0 ? 'no orphans' : `${SELF.orphans.length} orphans`}`, 'lbls', 'middle'),
  txt(AX, GY + 49, `measured at ${SELF_BASIS}`, 'lblf', 'middle')].join('\n');

// the seam between the two deploys
const seam = `<line x1="${SX.toFixed(0)}" y1="${HEAD + 14}" x2="${SX.toFixed(0)}" y2="${GY + LABEL_H + 6}" class="skf" stroke-dasharray="2 5"/>
${txt(40, GY + 84, `WEST — THE DOCS DEPLOY, FROM data/census-shipped.json · ${DOCS_BASIS} · sheet 9's ${WORD[DOCSG.length]} roles, each summed into one block`, 'lblf')}
${txt(1520, GY + 84, `EAST — THE ATLAS DEPLOY, FROM data/survey-shipped.json · ${SELF_BASIS}, outside the cabinet`, 'lblf', 'end')}`;

const AY = GY + LABEL_H + 34;
const CLAIMS = [CLAIM_SIZE, CLAIM_TALLEST, CLAIM_WIRE, CLAIM_THRICE, CLAIM_VIEWER, CLAIM_GHOST];
const claims = `${txt(40, AY, 'WHAT THE DRAWING SAYS — every line computed from the two plates', 'lblb')}
${CLAIMS.map((s, i) => txt(40, AY + 18 + i * 16, s, i ? 'lbls' : 'lblb')).join('\n')}`;
const ART_H = AY + 18 + CLAIMS.length * 16 + 4;

// ---- schedule ----------------------------------------------------------------------------------------
const schedRows = [
  ...DOCSG.map((g) => { const m = g.masses[0]; return [m.n, `${g.name} — ${wire(m)} · sheet 9's ${m.k} districts, summed: ${g.districts.join(', ')}`]; }),
  ...ATLAS.masses.map((b) => [b.n, `${b.name} — ${b.f}f ${KB(b.gz)} · ${tenant(b.top.name)} ${KB(b.top.gz)}`]),
];
const wireRows = [
  `every file under app/dist, raw and at gzip level 9: ${fmt(AT.raw)} raw bytes, ${fmt(AT.gz)} on the wire`,
  `reached from every page by reference, and seeded where the path is computed: ${SELF.seededTrees.join(' · ')}`,
  SELF.orphans.length === 0 ? 'orphans: none — the walk reaches every file the deploy carries' : `orphans: ${SELF.orphans.map((o) => o.file).join(' · ')}`,
  `the card pictures: ${PICS.f} webp, two per plate (paper and cyanotype), ${THUMB_W}×${THUMB_H} at ${THUMB_SCALE}× — ${pct(PICS.gz, AT.gz)} of the wire`,
  `the plates: ${PAGES.f} routed pages carry their fragments, ${PLATES.f} bare plates stand without the router, ${FRAGS.f} fragments feed the client`,
  `the docs deploy: ${fmt(DOCS.f)} files · ${MB(DOCS.gz)} · ${DOCS.k} districts at ${DOCS_BASIS}, read from sheet 9's own plate`,
];
const SY = ART_H + 16;
const ROWS = Math.max(schedRows.length, wireRows.length);
const SH = 74 + ROWS * 17;
const schedule = `<rect x="40" y="${SY}" width="1480" height="${SH}" class="sk fp"/>
${txt(58, SY + 22, 'STRUCTURE SCHEDULE — files · gzipped wire bytes · largest tenant', 'lbls')}
${txt(800, SY + 22, 'THE WIRE — what is measured, what is seeded', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1520" y2="${SY + 32}" class="skf"/>
<line x1="782" y1="${SY + 32}" x2="782" y2="${SY + 40 + ROWS * 17}" class="skf"/>
${schedRows.map((r, i) => schedTxt(58, SY + 52 + i * 17, r, 'lbls')).join('\n')}
${wireRows.map((r, i) => txt(800, SY + 52 + i * 17, r, 'lblf')).join('\n')}
${txt(58, SY + 58 + ROWS * 17, `TOTAL — the docs deploy ${fmt(DOCS.f)} files · ${MB(DOCS.gz)} gzipped at ${DOCS_BASIS} · the atlas deploy ${fmt(AT.f)} files · ${MB(AT.gz)} gzipped at ${SELF_BASIS} · ${SELF.wasAssociatedWith.at(-1)}`, 'lbls')}`;

const ARIA = `An isometric survey of the atlas's own deploy, standing beside the docs deploy it draws, on sheet 9's ruler: footprint area from file counts, height from gzipped bytes on the wire. `
  + `To the west, on main's ground at ${DOCS_BASIS}, sheet 9's three roles each stand as one summed block: `
  + DOCSG.map((g) => `${g.name}, ${wire(g.masses[0])}`).join('; ') + '. '
  + `East of a dotted seam, on the atlas's own branch at ${SELF_BASIS}, the atlas deploy stands as ${WORD[AT.k]} accent-edged districts inside one frame: `
  + ATLAS.masses.map((b) => `${b.name}, ${wire(b)}`).join('; ') + `. `
  + `${CLAIM_SIZE}; ${CLAIM_TALLEST}; ${CLAIM_THRICE}; ${CLAIM_GHOST}. A structure schedule lists every block, and beside it what the survey measures and seeds.`;

const svg = `<svg viewBox="0 0 1560 ${SY + SH + 30}" role="img" aria-label="${ARIA}">
${defs(P)}

<rect x="40" y="26" width="520" height="42" class="skf fnone"/>
${txt(52, 43, 'THE ATLAS, SHIPPED — ON THE WIRE, ON SHEET 9\'S RULER', 'lbls')}
${txt(52, 58, `the docs deploy's ${WORD[DOCSG.length]} roles west · the atlas deploy's ${WORD[AT.k]} districts east · one SIDE() and HT(), imported from sheet 9`, 'lblf')}

${txt(1520, 34, 'SCALE — footprint area ∝ files (side = 10 · √files, floored at 18) · 1 px of height ≈ 4.2 KB gzipped — sheet 9\'s functions, not a copy', 'lbls', 'end')}
${txt(1520, 48, `height is gzip level 9 of every file, the honest wire measure, since the CDN serves compressed · plan areas add, so ${WORD[AT.k]} footprints cover the ground one block of their sum would`, 'lblf', 'end')}
${txt(1520, 62, 'the atlas deploy is app/dist built from an archive of its own branch — the routed pages, the bare plates, the fragments, the pictures, the models and the scripts', 'lblf', 'end')}
${txt(1520, 76, 'every number on this sheet is read from data/census-shipped.json and data/survey-shipped.json at build time', 'lblf', 'end')}

${frame(ATLAS)}
${masses}
${ALL.map(badge).join('\n')}
${docsLabels}
${atlasLabels}
${seam}
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
  num: 'A4', id: 'self-shipped', rev: 'A',
  head: 'APPENDIX A4 · META',
  appendix: true,
  title: 'THE ATLAS, SHIPPED',
  sub: `APPENDIX · META — the atlas's own deploy as a shipped city on sheet 9's ruler, standing beside the docs deploy it draws · ${fmt(AT.f)} files in ${WORD[AT.k]} districts, ${MB(AT.gz)} on the wire · ${SELF_LINE}`,
  scale: 'THE ATLAS ITSELF',
  form: 'SHIPPED CITY',
  svg,
  caption: `The atlas's own deploy surveyed on the wire with sheet 9's instrument: footprint ∝ files, height ∝ gzipped bytes, from sheet 9's functions. The docs deploy stands west as one block per role; the atlas deploy stands east as ${WORD[AT.k]} districts in one frame — ${CLAIM_SIZE}.`,
  notes: `
<p><strong>Method — one ruler, two deploys.</strong> Every block on this plate is massed by <code>SIDE()</code> and <code>HT()</code> imported from <code>sheet9.mjs</code> — footprint side 10 · √files, floored at 18; height one pixel per 4,300 gzipped bytes, floored at 8 — and every file is weighed the way sheet 9 weighs it: raw bytes and gzip level 9, the honest wire measure, since the CDN serves compressed. The two halves stand on different grounds and say so. The docs deploy is <a href="${HOME.plate}"><code>data/census-shipped.json</code></a>, ${DOCS_BASIS}, the cabinet sheet 9 reads, summed here into sheet 9's three roles. The atlas is not on main, so it cannot be in that cabinet: it is <code>data/survey-shipped.json</code>, written by <a href="${HOME.survey}"><code>generator/survey-shipped.mjs</code></a> from a <code>git archive</code> of its own branch — ${SELF_BASIS}, committed ${SELF.commitDate.slice(0, 10)} — in which the app is built by its own <code>npm ci</code> and <code>npm run build</code>, the vite build and the prerender, and <code>app/dist</code> is measured file by file: ${fmt(AT.f)} files, ${MB(AT.raw)} on disk, ${MB(AT.gz)} on the wire. That is what <a href="${HOME.pages}">Cloudflare Pages</a> serves at <a href="${HOME.site}">atlas.lit-ui-router.dev</a>. A reachability walk from every page sorts the files into districts, and a path the app computes at runtime — a fragment by the manifest's <code>file</code>, the manifest by the router's base, the visualizer's icons by its stylesheet — is seeded rather than reported as a false orphan.</p>
<p><strong>What the drawing says.</strong> The atlas deploy is ${CLAIM_SIZE}. ${CLAIM_TALLEST.charAt(0).toUpperCase() + CLAIM_TALLEST.slice(1)}. The pictures are the whole story of the weight: a card picture is a webp, already compressed, so ${CLAIM_WIRE} — the lettering and markup of a deploy shrink on the wire and its pictures do not. The plates themselves ship in triplicate: ${CLAIM_THRICE} — the routed page carries its plate server-rendered, the bare plate stands for a reader who opts out of the router, and the fragment feeds the client's own navigation. Below those, ${CLAIM_VIEWER}, ${CLAIM_GHOST}. Every claim in this paragraph is computed from the two plates and changes its wording when the plates change it.</p>
<p><strong>Why aggregates, and why the atlas is not.</strong> The docs deploy stands as ${WORD[DOCSG.length]} summed blocks, one per role sheet 9 outlines, because the question is how much atlas there is on the wire, and sheet 9 already draws the docs deploy district by district. Summing is honest on this ruler for plan area — area ∝ files, so one block of a role's sum covers the same ground its districts do — and approximate for height, which reads a role's total bytes as one tower. The atlas keeps its ${WORD[AT.k]} districts because it has no other drawing that shows its parts. Sheet 9's role membership is read from its exported <code>ROLES</code>, and a district sheet 9 draws that no role claims is a build error there, so the two plates cannot disagree.</p>
<p><strong>What the pictures are for.</strong> The ${PICS.f} card pictures are the cover's cards: one per plate in each theme, ${THUMB_W}×${THUMB_H} CSS pixels drawn at ${THUMB_SCALE}×, so a card holds up on a retina display and the cyanotype theme has a picture of its own rather than an inverted one. They are ${pct(PICS.gz, AT.gz)} of the wire and arrive lazily, as the gallery scrolls; the first page a reader lands on is ${KB(SELF.rows.find((r) => r.district === 'routed pages').top.gz)} at most, the heaviest routed page, and a plate's own page carries nothing of the pictures at all. The weight is real and the drawing shows it; whether it is the right weight is a question for the cover, not for this ruler.</p>`,
  key: [
    keyRow('<rect x="6" y="3" width="36" height="12" class="sk fp"/>', 'a role of the docs deploy, summed — footprint ∝ files, height ∝ gzipped bytes'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="fp"/><rect x="6" y="3" width="36" height="12" fill="url(#sA4-ha)"/><rect x="6" y="3" width="36" height="12" class="ska fnone"/>', 'a district of the atlas deploy — the same rule, on its own branch'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="ska fnone" stroke-dasharray="4 3"/>', 'the atlas deploy\'s frame'),
    keyRow('<line x1="23" y1="1" x2="23" y2="17" class="skf" stroke-dasharray="2 5"/>', 'the seam between main\'s ground and the atlas\'s'),
  ].join('\n'),
};
