import { readdirSync, readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { box, esc, isoBlock, isoPt, keyRow, leader, nb, schedule, txt, NASA_MANUAL } from './helpers.mjs';
import { depthSort } from './iso-hidden.mjs';

const P = 'sA6';
const VB_W = 1560;

// ---- the catalogue: each rule read from the file that states it, each guard from the file that holds it ----
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const flat = (s) => s.replace(/\s+/g, ' ');
const SOURCES = { 'docs/ISOMETRIC.md': flat(read('../docs/ISOMETRIC.md')), 'docs/COPY.md': flat(read('../docs/COPY.md')) };
const SHEET_FILES = readdirSync(new URL('./', import.meta.url)).filter((f) => /^sheet[0-9a-z]+\.mjs$/i.test(f) && f !== 'sheetA6.mjs');
const callers = (fn) => SHEET_FILES.filter((f) => read(`./${f}`).includes(`${fn}(`)).length;
const holds = (file, needle) => {
  if (!read(`./${file}`).includes(needle)) throw new Error(`appendix A6: the schedule names ${file} as a guard, and it no longer carries ${needle}`);
  return file;
};
const PLOT_SHEETS = callers('assertPlots');
const FACE_SHEETS = callers('solidFaces');
if (!PLOT_SHEETS || !FACE_SHEETS) throw new Error('appendix A6: a guard the schedule names is called by no sheet');
const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

// status: what stops the fault. 'no guard' rows are the candidates.
const RULES = [
  { wrong: 'lettering on a mass face', right: 'lettering in clear air, a leader to the face', src: ['docs/ISOMETRIC.md', 'It sits in clear air, never on a mass face.'],
    guard: `${holds('audit-frames.mjs', 'const collectHits')} hits`, status: 'the audit exits 1' },
  { wrong: 'a mass past the viewBox', right: 'the drawing inside its viewBox, with air', src: ['docs/ISOMETRIC.md', '**escapes:** an element outside the viewBox'],
    guard: `${holds('audit-frames.mjs', 'const collectEscapes')} escapes`, status: 'the audit exits 1' },
  { wrong: 'two footprints that overlap', right: 'disjoint footprints, painted back to front', src: ['docs/ISOMETRIC.md', 'The precondition is disjoint footprints.'],
    guard: `assertPlots in ${holds('iso-hidden.mjs', 'export function assertPlots')}, called by ${plural(PLOT_SHEETS, 'sheet')}`, status: 'the build throws' },
  { wrong: 'a face as stroke and fill in one polygon', right: 'face(): the fill its own element under the outline', src: ['docs/ISOMETRIC.md', 'therefore draws no fill at all'],
    guard: `solidFaces in ${holds('iso-hidden.mjs', 'export const solidFaces')}, called by ${plural(FACE_SHEETS, 'sheet')}`, status: 'a repair, not a stop' },
  { wrong: 'a solid hairline leader', right: 'leader(): dashed, with a landing dot', src: ['docs/ISOMETRIC.md', 'A solid hairline reads as a road.'], guard: null, status: 'no guard' },
  { wrong: 'dash drawn as a hidden edge', right: 'dash as a kind of line: a phantom field', src: ['docs/ISOMETRIC.md', 'It never marks a hidden edge.'], guard: null, status: 'no guard' },
  { wrong: 'accent on five elements', right: 'accent on two, its meaning in the key', src: ['docs/ISOMETRIC.md', 'two elements a plate at most'], guard: null, status: 'no guard' },
  { wrong: 'a title box inside the drawing', right: 'the title in the chrome, the drawing bare', src: ['docs/ISOMETRIC.md', 'the drawing does not say it again in a title box.'], guard: null, status: 'no guard' },
  { wrong: 'a count written by hand', right: 'a count read from the plate, held by a throw', src: ['docs/COPY.md', 'A hand-written count is a claim the build does not check.'],
    guard: `per-sheet throws, as TALLEST in ${holds('sheet3b.mjs', 'if (TALLEST.id !==')}`, status: 'the build throws' },
];
for (const [i, r] of RULES.entries()) {
  const [file, needle] = r.src;
  if (!SOURCES[file].includes(needle)) throw new Error(`appendix A6: pair ${i + 1} cites ${file} for "${needle}", which it no longer says`);
}
const N = RULES.length;
const CANDIDATES = RULES.filter((r) => !r.guard).length;
const STOPPED = RULES.filter((r) => /throws|exits/.test(r.status)).length;
if (CANDIDATES + STOPPED + RULES.filter((r) => r.status === 'a repair, not a stop').length !== N) throw new Error('appendix A6: a pair stands in no status');
if (N !== 9) throw new Error(`appendix A6: the sub and caption count nine pairs, and the catalogue holds ${N}`);

// ---- the panels: every pair at one scale, the incorrect left and crossed, the correct right ----
const PW = 220, PH = 160, GAP = 30, CW = 2 * PW + GAP, COLS = [45, 45 + CW + 25, 45 + 2 * (CW + 25)];
const ROW0 = 100, PITCH = 250;
const f1 = (v) => Number(v).toFixed(1);
// lettering drawn as two rules: a stand-in, so a fault the panel shows is no fault on this plate
const scribe = (x, y, w, cls = 'sk') => `<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(x + w)}" y2="${f1(y)}" class="${cls}"/><line x1="${f1(x)}" y1="${f1(y + 5)}" x2="${f1(x + w * 0.6)}" y2="${f1(y + 5)}" class="${cls}"/>`;
const blk = (ox, oy, x, y, s, h, opts) => isoBlock(P, ox, oy, x, y, s, s, h, opts);
const pts = (ox, oy, arr) => arr.map(([x, y, z]) => isoPt(ox, oy, x, y, z).map(f1).join(',')).join(' ');
// the fault itself: stroke class and fill attribute on one polygon, so the class's fill:none wins
const hollowBlock = (ox, oy, x, y, s, h) => {
  const t = h;
  const top = pts(ox, oy, [[x, y, t], [x + s, y, t], [x + s, y + s, t], [x, y + s, t]]);
  const left = pts(ox, oy, [[x, y + s, t], [x + s, y + s, t], [x + s, y + s, 0], [x, y + s, 0]]);
  const right = pts(ox, oy, [[x + s, y, t], [x + s, y + s, t], [x + s, y + s, 0], [x + s, y, 0]]);
  return [left, right, top].map((p, i) => `<polygon points="${p}" class="sk" fill="${i === 2 ? 'var(--paper)' : 'var(--paper-2)'}"/>`).join('\n');
};
const hiddenEdges = (ox, oy, s, h) => {
  const o = isoPt(ox, oy, 0, 0, 0);
  return [[s, 0, 0], [0, s, 0], [0, 0, h]].map(([x, y, z]) => {
    const e = isoPt(ox, oy, x, y, z);
    return `<line x1="${f1(o[0])}" y1="${f1(o[1])}" x2="${f1(e[0])}" y2="${f1(e[1])}" class="sks" stroke-dasharray="3 2"/>`;
  }).join('');
};
const phantom = (ox, oy, x, y, w, d) => `<polygon points="${pts(ox, oy, [[x, y, 0], [x + w, y, 0], [x + w, y + d, 0], [x, y + d, 0]])}" class="skf fnone" stroke-dasharray="4 3"/>`;
const sorted = (ox, oy, masses) => depthSort(masses).map((m) => blk(ox, oy, m.x, m.y, m.w, m.h, m.opts)).join('\n');

// each drawer takes the panel's top-left and whether it draws the incorrect use
const DRAW = [
  (px, py, bad) => {
    const ox = px + (bad ? 110 : 80), oy = py + 76;
    const top = isoPt(ox, oy, 20, 20, 36);
    return blk(ox, oy, 0, 0, 40, 36) + (bad
      ? scribe(ox - 29, oy + 6, 21)
      : scribe(px + 142, py + 30, 54) + leader(px + 138, py + 32, top[0], top[1]));
  },
  (px, py, bad) => {
    const ox = px + (bad ? 196 : 110), oy = py + 80;
    const frame = box(px + 16, py + 16, PW - 32, PH - 32, 'skf fnone');
    const id = `${P}-clip-${bad ? 'w' : 'r'}`;
    return frame + `<clipPath id="${id}"><rect x="${px + 16}" y="${py + 16}" width="${PW - 32}" height="${PH - 32}" class="fnone"/></clipPath>`
      + `<g clip-path="url(#${id})">${blk(ox, oy, 0, 0, 36, 32)}</g>`;
  },
  (px, py, bad) => {
    const ox = px + 96, oy = py + 70;
    const far = { x: 0, y: 0, w: 36, d: 36, h: 30 }, near = bad ? { x: 20, y: 14, w: 36, d: 36, h: 46 } : { x: 44, y: 6, w: 36, d: 36, h: 46 };
    return bad ? blk(ox, oy, near.x, near.y, near.w, near.h) + blk(ox, oy, far.x, far.y, far.w, far.h) : sorted(ox, oy, [far, near]);
  },
  (px, py, bad) => {
    const ox = px + 110, oy = py + 88;
    return blk(ox, oy, 0, 0, 30, 60) + (bad ? hollowBlock(ox, oy, 32, 32, 30, 50) : blk(ox, oy, 32, 32, 30, 50));
  },
  (px, py, bad) => {
    const ox = px + 80, oy = py + 76;
    const end = isoPt(ox, oy, 20, 20, 36);
    const line = bad ? `<line x1="${px + 138}" y1="${py + 32}" x2="${f1(end[0])}" y2="${f1(end[1])}" class="skf"/>` : leader(px + 138, py + 32, end[0], end[1]);
    return blk(ox, oy, 0, 0, 40, 36) + scribe(px + 142, py + 30, 54) + line;
  },
  (px, py, bad) => {
    const ox = px + 84, oy = py + 70;
    return phantom(ox, oy, 52, -6, 40, 40) + blk(ox, oy, 0, 0, 40, 36) + (bad ? hiddenEdges(ox, oy, 40, 36) : '');
  },
  (px, py, bad) => {
    const ox = px + 34, oy = py + 104, H = [14, 26, 20, 40, 18];
    const blocks = H.map((h, i) => blk(ox, oy, i * 22, -i * 22, 16, h, { capCls: bad || i === 3 ? 'fa' : 'fp' })).join('\n');
    const lead = isoPt(ox, oy, 66 + 8, -66 + 8, 40);
    return blocks + (bad ? '' : scribe(lead[0] + 18, py + 26, 44, 'ska') + leader(lead[0] + 16, py + 30, lead[0], lead[1]));
  },
  (px, py, bad) => {
    const ox = px + (bad ? 128 : 100), oy = py + (bad ? 74 : 88);
    const blocks = blk(ox, oy, 0, 0, 30, 34) + blk(ox, oy, 38, 4, 26, 22);
    return blocks + (bad
      ? box(px + 14, py + 104, 80, 40, 'sk fp') + scribe(px + 22, py + 118, 56) + scribe(px + 22, py + 130, 40, 'sks')
      : scribe(px + 14, py + 14, 70) + `<line x1="${px + 8}" y1="${py + 30}" x2="${px + PW - 8}" y2="${py + 30}" class="skf"/>`);
  },
  (px, py, bad) => {
    const ox = px + 70, oy = py + 100, H = [20, 48, 30];
    const blocks = H.map((h, i) => blk(ox, oy, i * 26, -i * 26, 20, h)).join('\n');
    const end = isoPt(ox, oy, 26 + 10, -26 + 10, 48);
    return blocks + scribe(px + 140, py + 26, 52) + leader(px + 136, py + 28, end[0], end[1])
      + (bad ? '' : txt(px + 134, py + 52, 'held by a throw', 'lblf'));
  },
];
if (DRAW.length !== N) throw new Error(`appendix A6: ${DRAW.length} pairs drawn against ${N} in the catalogue`);

const cross = (px, py) => `<line x1="${px + 8}" y1="${py + 8}" x2="${px + PW - 8}" y2="${py + PH - 8}" class="skr" opacity="0.7"/><line x1="${px + PW - 8}" y1="${py + 8}" x2="${px + 8}" y2="${py + PH - 8}" class="skr" opacity="0.7"/>`;
const cell = (r, i) => {
  const x = COLS[i % 3], y = ROW0 + Math.floor(i / 3) * PITCH, xr = x + PW + GAP;
  const ny = y + PH + 22;
  return `<g>
${txt(x, y - 8, 'INCORRECT', 'lblf')}${txt(xr, y - 8, 'CORRECT', 'lblf')}
${box(x, y, PW, PH, 'skf fnone')}${box(xr, y, PW, PH, 'skf fnone')}
${DRAW[i](x, y, true)}
${cross(x, y)}
${DRAW[i](xr, y, false)}
${nb(x + 6, ny - 4, i + 1)}${txt(x + 20, ny, r.wrong, 'lbl')}
${txt(x + 20, ny + 15, `→ ${r.right}`, 'lbls')}
${txt(x + 20, ny + 30, r.guard ? `${r.guard} · ${r.status}` : 'no guard · a candidate for one', r.guard ? 'lblf' : 'lblr')}
</g>`;
};
const VB_H = ROW0 + 2 * PITCH + PH + 70;
const header = `${txt(1515, 34, 'SCALE — every pair at one scale: the incorrect use at left, crossed; its correct form at right', 'lbls', 'end')}
${txt(1515, 48, `${N} pairs · ${STOPPED} stopped by the build or the audit · ${CANDIDATES} with no guard, candidates for one`, 'lblf', 'end')}
${txt(1515, 62, 'lettering inside a panel is drawn as two rules, so a fault on show is no fault on this plate', 'lblf', 'end')}`;
const ARIA = `The atlas's own incorrect uses, ${N} numbered pairs on a three by three grid. In each pair the incorrect use stands at left, crossed in red, and its correct form at right at the same scale; under each pair its number, the rule, and the guard that catches it or the words no guard. `
  + RULES.map((r, i) => `${i + 1}: ${r.wrong}, against ${r.right}; ${r.guard ? r.guard : 'no guard'}.`).join(' ');
const svg = `<svg viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-label="${esc(ARIA)}">
${defs(P)}
${header}
${RULES.map(cell).join('\n')}
</svg>`;

export const SHEETA6_VERDICT = `meta — the atlas's own incorrect uses, each drawn beside its correct form: ${N} pairs, ${STOPPED} stopped by the build or the audit, ${CANDIDATES} with no guard and so candidates for one`;

export const sheetA6 = {
  num: 'A6', id: 'incorrect-uses', rev: 'A',
  head: 'APPENDIX A6 · META',
  appendix: true,
  title: 'THE INCORRECT USES',
  sub: `APPENDIX · META — the drawing rules the atlas keeps, each broken beside its correct form at one scale, numbered, and tied to the guard that catches it · ${N} pairs, ${CANDIDATES} with no guard`,
  scale: 'THE ATLAS ITSELF',
  form: 'PAIRED SCHEMATIC',
  svg,
  schedules: [schedule(
    'THE INCORRECT USES — each pair, its rule and its guard',
    ['no.', 'incorrect use', 'correct form', 'rule', 'guard', 'status'],
    RULES.map((r, i) => [i + 1, r.wrong, r.right, `${r.src[0]}: ${r.src[1].replace(/\*\*/g, '')}`, r.guard ?? 'no guard', r.status]),
    `Candidates ${CANDIDATES} of ${N}: the rules no guard holds`,
  )],
  caption: `The atlas's own drawing rules as nine numbered pairs, each incorrect use crossed in red beside its correct form at one scale. Under each pair, and in the schedule, stands the guard that catches it, or no guard, which makes the rule a candidate for one.`,
  notes: `
<p><strong>Method.</strong> The page follows page 1.6 of the <a href="${NASA_MANUAL.page}">NASA Graphics Standards Manual</a> (NHB 1430.2, January 1976, Danne &amp; Blackburn, in NASA's later reprint, <a href="${NASA_MANUAL.pdf}">PDF</a>), whose incorrect uses draw nine wrong logotypes, number them and name each in a sentence. Here the subject is the atlas's own drawing rules: each rule is read at build time from the file that states it, <code>docs/ISOMETRIC.md</code> or <code>docs/COPY.md</code>, and each guard from the file that holds it, so a rule whose wording moves, or a guard that loses its check, stops the build. The counts of sheets calling <code>assertPlots</code> and <code>solidFaces</code> are read off the sheet modules the same way.</p>
<p><strong>The pairs.</strong> 1, lettering on a mass face, and 2, a mass past the viewBox, are two of the three counts of <code>generator/audit-frames.mjs</code>, which exits 1 on any. 3, overlapping footprints, throws in <code>assertPlots</code> on the ${PLOT_SHEETS} sheets that call it. 4, a face written as stroke and fill in one polygon, draws no fill, because each stroke class declares <code>fill: none</code> and the class outranks the attribute; the rear block's edges read through the front one. <code>solidFaces</code> rewrites such a face on the ${plural(FACE_SHEETS, 'sheet')} that call it, and stops nothing; <code>face()</code> is the correct form. 9, a count written by hand, is held sheet by sheet with a throw against the plate, sheet 3B's <code>TALLEST</code> among them. 5, a solid hairline leader, 6, a dash drawn as a hidden edge, 7, accent on five elements, and 8, a title box inside the drawing, have no guard: the rules stand in <code>docs/ISOMETRIC.md</code> and in review alone, and these ${CANDIDATES} are the candidates.</p>
<p><strong>The plate keeps its own rules.</strong> The frame audit reads this plate as it reads the others, so lettering inside a panel is drawn as two rules standing for a line of text: pair 1's incorrect panel sets its rules on the block's face, a fault the audit cannot see because no text is there. Pair 2's block is cut by a drawn frame standing for the viewBox, inside the real one. Pair 4's incorrect panel is written the incorrect way, a stroke class and a fill attribute on one polygon. Pair 7 is the one place the plate spends accent: five caps in the incorrect panel, one cap and its callout in the correct one, and the key names that meaning. The third count of the audit, text-on-text, and the history words the atlas-copy skill greps for by hand stand outside the nine.</p>`,
  key: [
    keyRow('<rect x="4" y="2" width="40" height="14" class="skf fnone"/><line x1="8" y1="4" x2="40" y2="14" class="skr"/><line x1="40" y1="4" x2="8" y2="14" class="skr"/>', 'an incorrect use, crossed'),
    keyRow('<rect x="4" y="2" width="40" height="14" class="skf fnone"/>', 'its correct form, at the same scale'),
    keyRow('<line x1="8" y1="7" x2="40" y2="7" class="sk"/><line x1="8" y1="12" x2="27" y2="12" class="sk"/>', 'a line of lettering, drawn as two rules'),
    keyRow('<rect x="18" y="3" width="12" height="12" class="sk fp"/>', 'a pair number, the schedule\'s'),
    keyRow('<rect x="14" y="3" width="20" height="12" class="sk fa"/>', 'accent, in pair 7 only: the specimen of its own rule'),
    keyRow('<text x="4" y="13" class="lblr">no guard</text>', 'a rule no guard holds: a candidate'),
  ].join('\n'),
};
