import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, keyRow, npmUrl } from './helpers.mjs';
import { brickKit } from './brick-iso.mjs';
import { BRICK_ROWS, COMPILE_TIME } from './sheet2.mjs';
import { BUILD_MODELS } from './sheet2c.mjs';
import { SHEET2E_TAGS } from './sheet2e.mjs';

const P = 's2f';

// ---- census: pins from census-pins.json, builds from census-builds.json, the family from census-bricks.json ----
// each plate's URL written out whole: census-atlas.mjs finds a sheet's readers by the literal path
const read = (url) => JSON.parse(readFileSync(url, 'utf8'));
const PINS = read(new URL('../data/census-pins.json', import.meta.url));
const BUILDS = read(new URL('../data/census-builds.json', import.meta.url));
const BRICKS = read(new URL('../data/census-bricks.json', import.meta.url));
for (const [name, plate] of [['census-builds.json', BUILDS], ['census-bricks.json', BRICKS]])
  if (plate.sha !== PINS.sha) throw new Error(`sheet 2F: census-pins.json is at ${PINS.sha} but ${name} at ${plate.sha}`);
if (PINS.basis.atlasApp.sha !== BUILDS.basis.atlasApp.sha) throw new Error('sheet 2F: census-pins.json and census-builds.json read the atlas app at two shas');
const ATLAS_APP = PINS.basis.atlasApp;
const COUNTED = `counted at ${PINS.ref} @ ${PINS.sha} (${PINS.generatedAtTime.slice(0, 10)}), the atlas app at ${ATLAS_APP.ref} @ ${ATLAS_APP.sha}`;
const fmt = (v) => v.toLocaleString('en-US');
const WORD = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four'];
const word = (n) => {
  if (!WORD[n]) throw new Error(`sheet 2F: no number word for ${n} — extend WORD`);
  return WORD[n];
};
const listOf = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? '' : 's'}`;

// ---- the family: sheet 2's bricks and its compile-time parts, numbered and hued as sheet 2 draws them ----
for (const { name } of COMPILE_TIME) if (!BRICKS.rows.some((r) => r.name === name)) throw new Error(`sheet 2F: census-bricks.json has no ${name} row`);
const FAMILY = [...BRICK_ROWS.map((b) => ({ n: b.n, name: b.name, hue: b.hue })), ...COMPILE_TIME.map(({ name }, i) => ({ n: BRICK_ROWS.length + 1 + i, name, hue: null }))];
const part = (name) => FAMILY.find((b) => b.name === name) ?? (() => { throw new Error(`sheet 2F: ${name} is not a family part`); })();

// ---- the consumers: the second reading, numbered and lettered as sheet 2E tags them, each in its sheet 2C build ----
const ROWS = PINS.withAtlas.consumers;
if (ROWS.length !== PINS.withAtlas.totals.consumers || PINS.consumers.length !== PINS.totals.consumers) throw new Error('sheet 2F: census-pins.json totals disagree with its rows');
if (ROWS.length !== SHEET2E_TAGS.length) throw new Error(`sheet 2F: census-pins.json reads ${ROWS.length} consumers and sheet 2E tags ${SHEET2E_TAGS.length}`);
const keyOf = (names) => [...names].sort().join(' + ');
const MODEL_OF = new Map(BUILD_MODELS.map((m) => [keyOf(m.bricks.map((b) => b.name)), m]));
const KIND = { 'sample-app': 'sample app', 'docs-site': 'docs site', example: 'example', 'atlas-app': 'atlas app' };
const WS = PINS.workspace;
const CONSUMERS = SHEET2E_TAGS.map((tag) => {
  const r = ROWS.find((x) => x.name === tag.name), b = BUILDS.withAtlas.consumers.find((x) => x.name === tag.name);
  if (!r || !b || r.kind !== tag.kind) throw new Error(`sheet 2F: sheet 2E tags ${tag.k} ${tag.name}, which census-pins.json or census-builds.json reads otherwise`);
  if (b.parts.length && !MODEL_OF.has(keyOf(b.parts))) throw new Error(`sheet 2F: ${r.name}'s build ${keyOf(b.parts)} is no model on sheet 2C`);
  if (r.pins.map((p) => p.name).join() !== b.pinned.join()) throw new Error(`sheet 2F: ${r.name} pins [${r.pins.map((p) => p.name)}] here but [${b.pinned}] in census-builds.json`);
  const pins = r.pins.map((p) => ({ ...p, part: part(p.name) })).sort((x, y) => x.part.n - y.part.n);
  return { ...r, k: tag.k, letter: tag.letter, kindWord: KIND[r.kind], pins, model: b.parts.length ? MODEL_OF.get(keyOf(b.parts)) : null, atlas: r.kind === 'atlas-app' };
});
const fromTree = (p) => p.resolved === 'tree';
const versionOf = (p) => (fromTree(p) ? p.treeVersion : p.resolved);
const PNPM = CONSUMERS.filter((c) => c.installer === 'pnpm'), NPM = CONSUMERS.filter((c) => c.installer === 'npm');
// the plate's point: every pnpm member reads every family pin from the tree, and every npm consumer from its own lockfile
for (const c of CONSUMERS) {
  const wrong = c.pins.filter((p) => fromTree(p) !== (c.installer === 'pnpm'));
  if (wrong.length) throw new Error(`sheet 2F: ${c.name} installs with ${c.installer} but resolves ${wrong.map((p) => p.name)} ${c.installer === 'pnpm' ? 'off' : 'from'} the tree`);
}
const ALL_PINS = CONSUMERS.flatMap((c) => c.pins);
const TRAILING = ALL_PINS.filter((p) => p.trails), AHEAD = ALL_PINS.filter((p) => p.ahead);
const CAB = PINS.totals, ALL = PINS.withAtlas.totals;
if (ALL.pins !== ALL_PINS.length || ALL.trailing !== TRAILING.length || ALL.ahead !== AHEAD.length) throw new Error('sheet 2F: census-pins.json totals disagree with the pins drawn');
const PATCHED_TREE = new Set(Object.keys(WS.patchedDependencies ?? {}));
const patchedIn = (c, name) => (c.installer === 'pnpm' ? PATCHED_TREE.has(name) : Object.keys(c.patchedDependencies ?? {}).some((k) => k.startsWith(`${name}@`)));

// ---- where the layers part: a runtime resolved at more than one version, the tree's against the npm layer's ----
const RUNTIME_NAMES = [...new Set(CONSUMERS.flatMap((c) => c.runtime.filter((d) => !fromTree(d)).map((d) => d.name)))].sort();
const versionsIn = (cs, name) => [...new Set(cs.flatMap((c) => c.runtime.filter((d) => d.name === name && !fromTree(d)).map((d) => d.resolved)))].sort();
const major = (v) => v.split('.')[0];
const PARTED = RUNTIME_NAMES.map((name) => ({ name, tree: versionsIn(PNPM, name), npm: versionsIn(NPM, name) }))
  .filter((d) => d.tree.length && d.npm.length && d.tree.some((v) => d.npm.every((w) => major(w) !== major(v))));
const SPREAD = RUNTIME_NAMES.map((name) => ({ name, npm: versionsIn(NPM, name) })).filter((d) => d.npm.length > 1 && !PARTED.some((x) => x.name === d.name));
const LOCK_VERSIONS = [...new Set(NPM.map((c) => c.lockfileVersion))].sort();
const lockCount = (v) => NPM.filter((c) => c.lockfileVersion === v).length;
// the copy names the pnpm members the sample apps and the docs site, and the npm consumers the examples and the atlas app
const kindsOf = (cs) => [...new Set(cs.map((c) => c.kind))].sort().join();
if (kindsOf(PNPM) !== 'docs-site,sample-app' || kindsOf(NPM) !== 'atlas-app,example' || CONSUMERS.some((c) => (c.kind === 'example' || c.atlas) !== (c.installer === 'npm')))
  throw new Error(`sheet 2F: the copy reads pnpm for the sample apps and the docs site and npm for the examples and the atlas app, but pnpm installs [${kindsOf(PNPM)}] and npm [${kindsOf(NPM)}]`);
const deps = (n) => `${fmt(n)} runtime ${n === 1 ? 'dependency' : 'dependencies'}`;

// ---- the drawing kit: one 2×1 footprint, a course per family pin, a plate per runtime dependency ----
const U = 40;
const kit = brickKit({ U, p: P });
const { CRS, PT, SH } = kit;
const FW = 2, FD = 1, W = FW * U, D = FD * U;
const RIGHT = +(W * 0.866).toFixed(1), LEFTX = +(D * 0.866).toFixed(1), FOOT = (W + D) * 0.5;
const LABEL_GAP = 12, LINE = 12, TAG_W = 32, TAG_H = 17;
// DIN's mean advance at each label class, letter-spacing in: a label's width before the browser measures it
const ADVANCE = { lbl: 6.3, lbls: 5.9, lblf: 5.6 };
const widthOf = (s, cls) => s.length * ADVANCE[cls];
const TRAIL_SIDE = `url(#${P}-hr)`;
const tagAt = (x, y, c) => `<rect x="${x - TAG_W / 2}" y="${y - TAG_H / 2}" width="${TAG_W}" height="${TAG_H}" rx="8.5" class="ska fp"${c.atlas ? ' stroke-width="2"' : ''}/>${txt(x, y + 3.8, `${c.k} ${c.letter}`, 'lbla', 'middle')}`;
const pinValues = (p) => `${p.range} → ${fromTree(p) ? `tree ${p.treeVersion}` : p.resolved} · latest ${p.latest}${p.trails ? ' · trails' : ''}${p.ahead ? ' · ahead' : ''}`;
const runtimeLabel = (c, d) => `${d.name} ${fromTree(d) ? 'tree' : d.resolved}${patchedIn(c, d.name) ? ' · patched' : ''}`;
const overrideKeys = (o) => Object.entries(o ?? {}).flatMap(([k, v]) => (v && typeof v === 'object' ? Object.keys(v).map((x) => `${k} › ${x}`) : [k]));
const installLine = (c) => (c.installer === 'pnpm' ? `pnpm · ${c.lockfile} ${c.lockfileVersion} · the tree` : `npm · its own package-lock.json v${c.lockfileVersion}`);
const extrasVerbs = (c, one) => {
  const o = overrideKeys(c.overrides), pd = Object.keys(c.patchedDependencies ?? {});
  return listOf([o.length ? `override${one ? 's' : ''} ${listOf(o)}` : '', pd.length ? `patch${one ? 'es' : ''} ${listOf(pd)}` : ''].filter(Boolean));
};
const extrasGroups = (cs) => {
  const by = new Map();
  for (const c of cs.filter((x) => extrasLine(x))) by.set(extrasLine(c), [...(by.get(extrasLine(c)) ?? []), c]);
  return [...by.values()].map((g) => `${listOf(g.map((c) => c.name))} ${extrasVerbs(g[0], g.length === 1)}`);
};
const extrasLine = (c) => {
  const o = overrideKeys(c.overrides), pd = Object.keys(c.patchedDependencies ?? {});
  return [o.length ? `overrides ${o.join(', ')}` : '', pd.length ? `patches ${pd.join(', ')}` : ''].filter(Boolean).join(' · ');
};

// one consumer's strip: its tag and installer over a stack — the runtime plates, then a course per family pin — each layer lettered at its right
function stripOf(c, width) {
  const heads = [[installLine(c), 'lblf'], ...(extrasLine(c) ? [[extrasLine(c), 'lblf']] : [])];
  const headH = 22 + heads.length * LINE;
  const zTop = c.runtime.length * PT + c.pins.length * CRS;
  const stackH = zTop + SH + FOOT;
  const labelsH = c.runtime.length * PT + c.pins.length * CRS + SH + LINE;
  const h = headH + Math.max(stackH, labelsH, 30) + 8;
  const labelX = LEFTX + RIGHT + LABEL_GAP;
  for (const [s, cls] of [...c.pins.flatMap((p) => [[p.name, 'lbls'], [pinValues(p), 'lblf']]), ...c.runtime.map((d) => [runtimeLabel(c, d), 'lblf'])])
    if (labelX + widthOf(s, cls) > width) throw new Error(`sheet 2F: ${c.name}'s label "${s}" runs ${(labelX + widthOf(s, cls) - width).toFixed(0)} past its strip`);
  for (const [s, cls] of [[c.name, 'lbl'], ...heads]) if (TAG_W + 10 + widthOf(s, cls) > width) throw new Error(`sheet 2F: ${c.name}'s heading "${s}" runs past its strip`);
  return { c, h, svg: (x, y) => stripSvg(c, x, y, { heads, headH, zTop, labelX }) };
}
function stripSvg(c, x, y, { heads, headH, zTop, labelX }) {
  const ox = x + LEFTX, oy = y + headH + zTop + SH;
  const out = [`<g id="${P}-consumer-${c.k}" data-consumer="${c.k}" data-name="${c.name}">`, tagAt(x + TAG_W / 2, y + 8, c), txt(x + TAG_W + 10, y + 12, c.name, 'lbl'),
    ...heads.map(([s, cls], i) => txt(x + TAG_W + 10, y + 26 + i * LINE, s, cls))];
  // a layer's label sits at the stack's right corner, level with the layer's middle
  const at = (z) => +(oy + W * 0.5 - z).toFixed(1);
  // the runtime reads alphabetically down from the family courses, so it is laid from its last name up
  [...c.runtime].reverse().forEach((d, i) => {
    const z0 = i * PT, top = i === c.runtime.length - 1 && !c.pins.length;
    out.push(kit.plate(ox, oy, FW, FD, { z0, edge: 'sk', dash: fromTree(d) ? '3 2' : '', covered: () => !top }));
    out.push(txt(+(x + labelX).toFixed(1), +(at(z0 + PT / 2) + 3.5).toFixed(1), runtimeLabel(c, d), 'lblf'));
  });
  if (!c.runtime.length) out.push(txt(+(x + labelX).toFixed(1), +(at(0) + 14).toFixed(1), 'runtime: none', 'lblf'));
  c.pins.forEach((p, i) => {
    const z0 = c.runtime.length * PT + i * CRS;
    out.push(kit.brick(ox, oy, 0, 0, FW, FD, 1, { z0, studEdge: 'sk', hue: p.part.hue, dash: fromTree(p) ? '3 2' : '', ...(p.trails ? { edge: 'skr', side: TRAIL_SIDE } : {}) }));
    out.push(txt(+(x + labelX).toFixed(1), +(at(z0 + CRS / 2) - 3.5).toFixed(1), p.name, 'lbls'));
    out.push(txt(+(x + labelX).toFixed(1), +(at(z0 + CRS / 2) + 8.5).toFixed(1), pinValues(p), 'lblf'));
  });
  out.push('</g>');
  return out.join('\n');
}

// ---- the booklet: one panel per sheet 2C build in its order, the consumer that pins nothing last, the panels in columns ----
const PANELS = [...BUILD_MODELS.map((m) => ({ model: m, consumers: CONSUMERS.filter((c) => c.model === m) })), { model: null, consumers: CONSUMERS.filter((c) => !c.model) }]
  .filter((pn) => pn.consumers.length);
for (const m of BUILD_MODELS) if (!CONSUMERS.some((c) => c.model === m)) throw new Error(`sheet 2F: sheet 2C's build ${m.numeral} has no consumer here`);
const kindCount = (cs) => listOf(Object.keys(KIND).map((k) => [k, cs.filter((c) => c.kind === k).length]).filter(([, n]) => n).map(([k, n]) => `${word(n)} ${KIND[k]}${n > 1 ? 's' : ''}`));
const installCount = (cs) => listOf(['pnpm', 'npm'].map((i) => [i, cs.filter((c) => c.installer === i).length]).filter(([, n]) => n).map(([i, n]) => `${i} ${n}`));
const headsOf = (pn) => [
  [pn.model ? `BUILD ${pn.model.numeral} · ${pn.model.name.toUpperCase()}` : 'NO BUILD', pn.model?.atlas ? 'lbla' : 'lblt'],
  [`${plural(pn.consumers.length, 'consumer')} · ${kindCount(pn.consumers)} · ${installCount(pn.consumers)}`, 'lblf'],
  ...(pn.model?.atlas ? [[`${pn.model.words} · on its own branch`, 'lblf']] : []),
];
const VW = 1480, LEFT = 20, TOP = 58, GUT = 18, COLS = 3, PAD = 14, STRIP_GAP = 12;
const PW = Math.floor((VW - 2 * LEFT - (COLS - 1) * GUT) / COLS);
const laid = PANELS.map((pn) => {
  const heads = headsOf(pn), headH = PAD + 13 + (heads.length - 1) * LINE + 14;
  const strips = pn.consumers.map((c) => stripOf(c, PW - 2 * PAD));
  return { ...pn, heads, headH, strips, h: headH + strips.reduce((a, s) => a + s.h + STRIP_GAP, 0) - STRIP_GAP + PAD };
});
// each panel takes the shortest column, in build order
const colH = Array(COLS).fill(0);
for (const pn of laid) {
  const col = colH.indexOf(Math.min(...colH));
  Object.assign(pn, { x: LEFT + col * (PW + GUT), y: TOP + colH[col] });
  colH[col] += pn.h + GUT;
}
const panelSvg = (pn) => {
  let y = pn.y + pn.headH;
  const strips = pn.strips.map((s) => {
    const svg = s.svg(pn.x + PAD, y);
    y += s.h + STRIP_GAP;
    return svg;
  });
  const atlas = pn.model?.atlas;
  return `<g id="${P}-build-${pn.model?.numeral ?? 'none'}" data-build="${pn.model?.numeral ?? ''}">
<rect x="${pn.x}" y="${pn.y}" width="${PW}" height="${pn.h}" class="${atlas ? 'ska' : 'skf'} fnone"${atlas ? ' stroke-dasharray="5 4" opacity="0.7"' : ''}/>
${pn.heads.map(([s, cls], k) => txt(pn.x + PAD, pn.y + PAD + 13 + k * LINE + (k ? 3 : 0), s, cls)).join('\n')}
${strips.join('\n')}
</g>`;
};
const ART_BOTTOM = TOP + Math.max(...colH) - GUT;
const DRAWN = laid.flatMap((pn) => pn.strips.map((s) => s.c.k));
if (DRAWN.length !== CONSUMERS.length || new Set(DRAWN).size !== CONSUMERS.length) throw new Error(`sheet 2F: ${DRAWN.length} strips drawn for ${CONSUMERS.length} consumers`);

// ---- the schedule: one row per consumer ----
const wrapWords = (s, chars) => s.split(' ').reduce((ls, w) => (ls.length && (ls.at(-1) + ' ' + w).length <= chars ? [...ls.slice(0, -1), `${ls.at(-1)} ${w}`] : [...ls, ls.length ? `        ${w}` : w]), []);
const schedRow = (c) => `${String(c.k).padStart(2)} ${c.letter}  ${c.name} (${c.kindWord}) — ${c.dir} · ${installLine(c)} · ${c.pins.length ? `pins ${c.pins.map((p) => `${p.part.n} ${p.name} ${pinValues(p)}`).join('; ')}` : 'pins no family part'} · runtime ${c.runtime.length ? c.runtime.map((d) => runtimeLabel(c, d)).join(', ') : 'none'}${extrasLine(c) ? ` · ${extrasLine(c)}` : ''}`;
const SCHED_ROWS = CONSUMERS.flatMap((c) => wrapWords(schedRow(c), Math.floor((VW - 2 * LEFT - 36) / 5.6)));
const SY = ART_BOTTOM + 40;
const schedule = `<rect x="${LEFT}" y="${SY}" width="${VW - 2 * LEFT}" height="${80 + SCHED_ROWS.length * 16}" class="sk fp"/>
${txt(LEFT + 18, SY + 22, 'PIN SCHEDULE — one row per consumer, numbered as sheet 2E tags it · range as declared → resolved · npm’s latest · S sample app · D docs site · E example · A atlas app', 'lbls')}
<line x1="${LEFT}" y1="${SY + 32}" x2="${VW - LEFT}" y2="${SY + 32}" class="skf"/>
${SCHED_ROWS.map((r, i) => txt(LEFT + 18, SY + 52 + i * 16, r, 'lbls')).join('\n')}
${txt(LEFT + 18, SY + 60 + SCHED_ROWS.length * 16, `TOTAL — ${plural(CAB.consumers, 'consumer')} · ${plural(CAB.pins, 'family pin')}, ${fmt(CAB.fromTree)} from the tree and ${fmt(CAB.fromLock)} from a lockfile · ${deps(CAB.runtime)} · ${fmt(ALL.consumers)} · ${fmt(ALL.pins)}, ${fmt(ALL.fromTree)} and ${fmt(ALL.fromLock)} · ${fmt(ALL.runtime)} with the atlas app · trailing latest: ${word(ALL.trailing)} · ${COUNTED}`, 'lbls')}`;
const VH = SY + 90 + SCHED_ROWS.length * 16;

// ---- the findings, derived ----
const partedLine = (d) => `${d.name} resolves ${listOf(d.tree)} from the tree and ${listOf(d.npm)} in the npm layer`;
const spreadLine = (d) => `${d.name} resolves ${listOf(d.npm)}`;
const TRAIL_WORDS = TRAILING.length ? `${word(TRAILING.length)} — ${listOf(TRAILING.map((p) => `${p.name} ${versionOf(p)} under ${p.latest}`))}` : word(0);

export const SHEET2F_SCALE = `${word(CONSUMERS.length).toUpperCase()} CONSUMERS, PIN BY PIN`;
export const SHEET2F_VERDICT = `the consumers’ pins, layer by layer: ${word(PNPM.length)} pnpm members read ${fmt(ALL.fromTree)} family pins from the tree and ${word(NPM.length)} npm consumers, the atlas app among them, read ${fmt(ALL.fromLock)} from their own lockfiles; pins trailing npm’s latest: ${word(TRAILING.length)}${PARTED.length ? `; ${listOf(PARTED.map(partedLine))}` : ''}`;
const ARIA = `An isometric drawing of the repository's consumers as stacks of pins, in panels by sheet 2C's builds. Each of the ${word(CONSUMERS.length)} consumers is one stack on a two-by-one footprint: a thin plate for each of its runtime dependencies, then a brick course for each family part it pins, in the part's sheet 2 hue, each course lettered at its right with its range, the version it resolves and npm's latest, and each plate with the version it resolves. A pnpm member's family courses are dashed, read from the tree; an npm consumer's are solid, read from its own lockfile. A schedule below gives every consumer's pins, runtime and overrides.`;

const svg = `<svg viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${ARIA}">
${defs(P)}
${txt(VW - 30, 16, `SCALE — one 2×1 footprint for every consumer: a course per family pin, a plate per runtime dependency · a pnpm member reads its pins from the tree, an npm consumer from its own lockfile`, 'lbls', 'end')}
${txt(VW - 30, 30, 'each course lettered range → resolved · latest, each plate its resolved version · a dashed layer is the tree’s own build, linked · a red-hatched course trails npm’s latest · the atlas app’s panel is edged in accent', 'lblf', 'end')}
${laid.map(panelSvg).join('\n')}
${schedule}
</svg>`;

export const sheet2f = {
  num: '2F', id: 'companions-pins', rev: 'B',
  title: 'THE PINNED BUILDS',
  sub: `ALTITUDE 2 — SIBLING PLATE, THE PINS: the ${word(CAB.consumers)} consumers in the cabinet’s tree and the atlas’s own app as stacks of what they pin, a course per family part and a plate per runtime dependency, each read where its installer reads it — the tree for a pnpm member, its own lockfile for an npm consumer — against npm’s latest · rows read census-pins.json, both readings, @ ${PINS.sha}`,
  scale: SHEET2F_SCALE,
  form: 'BUILD INSTRUCTIONS',
  svg,
  caption: `The consumers' pins, layer by layer, in sheet 2C's builds. The ${word(PNPM.length)} pnpm members read their ${fmt(ALL.fromTree)} family pins from the tree; the ${word(NPM.length)} npm consumers, the examples and the atlas app, read their ${fmt(ALL.fromLock)} from their own lockfiles. Pins trailing npm's latest: ${word(TRAILING.length)}.`,
  notes: `
<p><strong>Two altitudes.</strong> Sheet 2E seats each consumer on the family parts it pins; this plate opens the pin itself. A pnpm member — the sample apps and the docs site — names a family part <code>catalog:workspace</code>, which the workspace's catalog reads <code>workspace:*</code>, and resolves it to the tree: the part's own build at the ref, linked, its version the member's own. An embedded example under <code>examples/&lt;key&gt;/</code> and the atlas's own app install with npm from the registry, each through its own <code>package-lock.json</code>, so each pin is a published version. Of ${plural(ALL.pins, 'family pin')}, ${fmt(ALL.fromTree)} read from the tree and ${fmt(ALL.fromLock)} from a lockfile, ${fmt(CAB.fromLock)} of them in the cabinet's tree and ${fmt(ALL.fromLock - CAB.fromLock)} the atlas app's, read from <code>git archive ${ATLAS_APP.ref}</code> @ ${ATLAS_APP.sha}.</p>
<p><strong>The npm layer.</strong> The npm consumers' lockfiles are ${listOf(LOCK_VERSIONS.map((v) => `version ${v} in ${word(lockCount(v))}`))}. Their overrides and patches are their own manifests': ${extrasGroups(NPM).join('; ')}. The pnpm members install under the workspace's ${plural(Object.keys(WS.overrides ?? {}).length, 'override')} and ${fmt(PATCHED_TREE.size)} patch${PATCHED_TREE.size === 1 ? '' : 'es'} in <code>pnpm-workspace.yaml</code>: ${listOf([...PATCHED_TREE].map((n) => `<code>${n}</code>`))}.</p>
<p><strong>Where the layers part.</strong> Below the family courses each stack carries a plate per runtime dependency, its version read the same way: ${deps(ALL.runtime)} over the ${word(CONSUMERS.length)} consumers. ${PARTED.length ? `Where the tree and the npm layer run different majors, ${listOf(PARTED.map(partedLine))}.` : 'The tree and the npm layer run the same majors.'}${SPREAD.length ? ` Across the npm consumers alone, ${listOf(SPREAD.map(spreadLine))}, each lockfile holding its own resolution of the range.` : ''}</p>
<p><strong>Against latest.</strong> Every family pin is read against the <code>latest</code> tag ${npmLink('lit-ui-router')} and its siblings carry in <code>census-npm.json</code> at the same sha. Pins trailing it: ${TRAIL_WORDS}; pins ahead of it: ${word(AHEAD.length)}. A trailing course is hatched red. Every number on this sheet is read from <code>www/atlas.lit-ui-router.dev/data/census-pins.json</code>, <code>census-builds.json</code> and <code>census-bricks.json</code> — ${COUNTED}.</p>`,
  key: [
    keyRow('<polygon points="4,10 16,4 36,10 36,15 16,9 4,15" class="sk fp"/><ellipse cx="13" cy="7" rx="4" ry="2.3" class="sk fp2"/><ellipse cx="26" cy="7" rx="4" ry="2.3" class="sk fp2"/>', 'a family pin — one brick course in its sheet 2 hue, read from a lockfile: the npm consumer’s own'),
    keyRow('<polygon points="4,10 16,4 36,10 36,15 16,9 4,15" class="sk fp" stroke-dasharray="3 2"/>', 'a dashed course — a family pin read from the tree: the pnpm member links the part’s own build at the ref'),
    keyRow(`<polygon points="4,10 16,4 36,10 36,15 16,9 4,15" class="skr" style="fill:${TRAIL_SIDE}"/>`, 'a red-hatched course — a pin whose resolved version trails npm’s latest'),
    keyRow('<polygon points="4,12 16,7 36,12 36,14 16,9 4,14" class="sk fp"/>', 'a runtime plate — one per non-family dependency the consumer installs, lettered with its resolved version; dashed when it is a workspace member'),
    keyRow(`<rect x="8" y="1" width="32" height="17" rx="8.5" class="ska fp"/><text x="24" y="13" class="lbla" text-anchor="middle">9 E</text>`, 'a consumer’s tag — its number and kind as sheet 2E tags it: S sample app, D docs site, E example, A atlas app'),
    keyRow('<rect x="4" y="2" width="40" height="14" class="ska fnone" stroke-dasharray="5 4" opacity="0.7"/>', 'an accent-edged panel — the atlas app’s build, on its own branch'),
  ].join('\n'),
};
function npmLink(name) {
  part(name);
  return `<a href="${npmUrl(name)}"><code>${name}</code></a>`;
}
