import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { box, detailRef, dimH, dimV, keyRow, nb, schedule, txt, DIMENSIONAL, NASA_MANUAL } from './helpers.mjs';

const P = 'sA5';
const VB_W = 1560;

// ---- the plate: the chrome measured in the built app, outside the cabinet ------------------------------
const PLATE = JSON.parse(readFileSync(new URL('../data/survey-chrome.json', import.meta.url), 'utf8'));
const BASIS = `${PLATE.ref} @ ${PLATE.sha}`;
const [WIDE, NARROW] = PLATE.widths;
if (!PLATE.dpr) throw new Error('appendix A5: survey-chrome.json names no device pixel ratio');
const rowsOf = (code) => PLATE.rows.filter((r) => r.code === code);
const pick = (code, test, what) => {
  const r = rowsOf(code).find((x) => test(x.source));
  if (!r) throw new Error(`appendix A5: survey-chrome.json has no ${what} row for ${code}`);
  return r;
};
// the value as drawn at one width: a row measured at both widths answers either
const at = (code, w = WIDE) => pick(code, (s) => s.startsWith('measured') && s.includes(`@${w}`), `@${w}`).value;
const declared = (code) => pick(code, (s) => s === 'chrome.mjs', 'chrome.mjs').value;
const derived = (code) => pick(code, (s) => s === 'derived', 'derived');
const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v);
const INSTANCES = PLATE.instances.routed;
if (!INSTANCES || PLATE.instances.bare !== INSTANCES) throw new Error(`appendix A5: ${PLATE.instances.routed} sheets on the routed pages against ${PLATE.instances.bare} on the bare plates`);

// every code the drawing letters must stand in the plate, so it stands in a schedule
const DRAWN = new Set();
const c = (code) => {
  if (!rowsOf(code).length) throw new Error(`appendix A5: the drawing letters ${code}, which survey-chrome.json does not carry`);
  DRAWN.add(code);
  return code;
};

// ---- the values the plan is laid out by, at 1:1 for the wide reading ---------------------------
const B = at('B'), B2 = at('B2'), S1 = at('S1'), S2 = at('S2'), S3 = at('S3');
const H1 = at('H1'), S6 = at('S6'), T1 = at('T1'), S7 = at('S7'), T2 = at('T2'), S8 = at('S8'), S9 = at('S9');
const Z1 = at('Z1'), Z2 = at('Z2'), S11 = at('S11'), G2 = at('G2'), S13 = at('S13'), W5 = at('W5'), AR = at('AR');
const S12 = at('S12'), S14 = at('S14'), S15 = at('S15'), Z3 = at('Z3'), G6 = at('G6');
const SPLIT = declared('N');
if (G6 % 2) throw new Error(`appendix A5: the title block carries ${G6} cells, which do not pair on two columns`);
if (at('K') !== 'sticky' || at('K', NARROW) !== 'static') throw new Error('appendix A5: the key block is drawn sticky wide and static narrow, and the plate says otherwise');
const tracks = (v) => String(v).trim().split(/\s+/).length;
if (tracks(at('G5')) !== 2 || tracks(at('G1')) !== 2 || tracks(at('G1', NARROW)) !== 1) throw new Error('appendix A5: the notes say two tracks wide, one narrow, and two in the title block; the plate says otherwise');
if (at('G3') !== 1) throw new Error(`appendix A5: the notes run ${at('G3')} columns at ${WIDE}, and the plan draws one`);

// ---- the plan: one sheet, spacing at 1:1, slots schematic --------------------------------
const PX = 470, PY = 130, PW = 720;
const CX0 = PX + B + S2, CX1 = PX + PW - B - S2, CW = CX1 - CX0;
let y = PY + B + S2;
const Y = {};
Y.head = y; y += H1; Y.headEnd = y;
y += S6; Y.title = y; y += T1; Y.titleEnd = y;
y += S7; Y.sub = y; y += 18; Y.subEnd = y;
y += S8 + S9; Y.plate = y; y += Math.round(CW / AR); Y.plateEnd = y;
y += 10; Y.sched = y; y += 72; Y.schedEnd = y;
y += 28; Y.cap = y; y += 48; Y.capEnd = y;
y += 40; Y.grid = y; y += S13; Y.cols = y;
const NOTES_W = CW - G2 - W5;
const KX = CX0 + NOTES_W + G2;
Y.key = Y.cols; Y.keyEnd = Y.key + 64;
Y.tb = Y.keyEnd + 20;
const TB_ROWS = 2 + (G6 - 2) / 2, TB_ROW = 34;
Y.tbEnd = Y.tb + TB_ROWS * TB_ROW;
Y.notesEnd = Y.tbEnd;
const PH = Y.tbEnd + S2 + B - PY;
const BOTTOM = PY + PH;

const slot = (x, yy, w, h, label, { hug = false, sub = '' } = {}) => box(x, yy, w, h, hug ? 'skf fp2' : 'skf fnone', 0).replace('/>', ' stroke-dasharray="4 3"/>')
  + txt((x + 8).toFixed(1), (yy + Math.min(h / 2 + 4, 15)).toFixed(1), label, 'lbls')
  + (sub ? txt((x + 8).toFixed(1), (yy + Math.min(h / 2 + 4, 15) + 13).toFixed(1), sub, 'lblf') : '');

const FB = { x: CX1 - Z1, y: Y.plate - S11 - Z2 };
const TB_SHEET = { x: KX + W5 / 2, y: Y.tb + (TB_ROWS - 1) * TB_ROW };

const titleBlock = (() => {
  const out = [box(KX, Y.tb, W5, TB_ROWS * TB_ROW, 'sk fnone')];
  for (let i = 1; i < TB_ROWS; i++) out.push(`<line x1="${KX}" y1="${Y.tb + i * TB_ROW}" x2="${KX + W5}" y2="${Y.tb + i * TB_ROW}" class="sks"/>`);
  out.push(`<line x1="${KX + W5 / 2}" y1="${Y.tb + 2 * TB_ROW}" x2="${KX + W5 / 2}" y2="${Y.tb + TB_ROWS * TB_ROW}" class="sks"/>`);
  out.push(txt(KX + 10, Y.tb + 21, 'PROJECT · SPAN 2', 'lblf'), txt(KX + 10, Y.tb + TB_ROW + 21, 'SHEET TITLE · SPAN 2', 'lblf'));
  out.push(txt(KX + 10, Y.tb + 2 * TB_ROW + 21, 'FIELD · VALUE', 'lblf'), txt(KX + W5 / 2 + 10, Y.tb + 2 * TB_ROW + 21, 'FIELD · VALUE', 'lblf'));
  out.push(txt(TB_SHEET.x + 10, TB_SHEET.y + 21, 'SHEET NO', 'lblf'));
  out.push(box(KX + W5 - 2 - Z3 - 10, TB_SHEET.y + (TB_ROW - Z3) / 2, Z3, Z3, 'sk fnone'));
  return out.join('\n');
})();

const plan = `
<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" class="sk2 fp"/>
<rect x="${PX + B + S1}" y="${PY + B + S1}" width="${PW - 2 * (B + S1)}" height="${PH - 2 * (B + S1)}" class="skf fnone"/>
<line x1="${PX - 20}" y1="${BOTTOM + S3}" x2="${PX + PW + 20}" y2="${BOTTOM + S3}" class="skf" stroke-dasharray="10 4 2 4"/>
${txt(PX + PW / 2, BOTTOM + S3 + 16, 'THE NEXT SHEET', 'lblf', 'middle')}
${slot(CX0, Y.head + 8, 250, 18, 'PROJECT MARK · HUG', { hug: true })}
${slot(CX1 - 140, Y.head + 8, 140, 18, 'SHEET NO · HUG', { hug: true })}
<line x1="${CX0}" y1="${Y.headEnd}" x2="${CX1}" y2="${Y.headEnd}" class="sk"/>
${slot(CX0, Y.title, 320, T1, 'TITLE SLOT · HUG', { hug: true })}
${slot(CX0, Y.sub, CW, 18, 'SUB SLOT · FILL · WRAPS')}
<rect x="${CX0}" y="${Y.plate}" width="${CW}" height="${Y.plateEnd - Y.plate}" class="sks fp2"/>
<rect x="${CX0 + 14}" y="${Y.plate + 14}" width="${CW - 28}" height="${Y.plateEnd - Y.plate - 28}" class="skf fnone" stroke-dasharray="4 3"/>
${txt(CX0 + CW / 2, (Y.plate + Y.plateEnd) / 2 - 6, 'PLATE · FILL', 'lblb', 'middle')}
${txt(CX0 + CW / 2, (Y.plate + Y.plateEnd) / 2 + 10, 'the drawing, one SVG at its own viewBox ratio', 'lbls', 'middle')}
<rect x="${FB.x}" y="${FB.y}" width="${Z1}" height="${Z2}" class="ska fp"/>
${txt(FB.x + Z1 / 2, FB.y + Z2 / 2 + 4, 'FILL · HUG', 'lbls', 'middle')}
<rect x="${CX0}" y="${Y.sched}" width="${CW}" height="${Y.schedEnd - Y.sched}" class="sk fnone"/>
<line x1="${CX0}" y1="${Y.sched + 20}" x2="${CX1}" y2="${Y.sched + 20}" class="sk"/>
<line x1="${CX0 + CW / 2}" y1="${Y.sched + 20}" x2="${CX0 + CW / 2}" y2="${Y.schedEnd}" class="skf" stroke-dasharray="4 3"/>
${txt(CX0 + 10, Y.sched + 14, 'SCHEDULE TITLE · FILL', 'lblf')}
${txt(CX0 + 10, Y.sched + 44, 'TABLE · FILL', 'lbls')}
${txt(CX0 + CW / 2 + 10, Y.sched + 44, 'TABLE · FILL · PAST N ROWS', 'lbls')}
<line x1="${CX0}" y1="${Y.cap}" x2="${CX0}" y2="${Y.capEnd}" class="sk"/>
${slot(CX0 + S12, Y.cap, 420, Y.capEnd - Y.cap, `CAPTION SLOT · FLEX TO ${c('W4')}`, { sub: `italic prose · ${c('T6')}` })}
<line x1="${CX0}" y1="${Y.grid}" x2="${CX1}" y2="${Y.grid}" class="sk"/>
${slot(CX0, Y.cols, NOTES_W, Y.notesEnd - Y.cols, 'NOTES · FLEX', { sub: `${c('G3')} columns of prose · ${c('T7')}` })}
${slot(KX, Y.key, W5, Y.keyEnd - Y.key, 'KEY ROWS · HUG', { hug: true, sub: `swatch · reading · ${c('T8')}` })}
${titleBlock}
`;

// ---- the plan's dimensions ----------------------------------------------------------------------------
const L = PX - 14;
const R = PX + PW + 18;
const planDims = [
  dimH(P, PX, PX + PW, PY - 40, PY, PY, `${c('W')} · FLEX`),
  dimH(P, CX0, CX1, PY - 18, null, null, c('W1'), {}),
  // left chain: the head, the title, the sub, the plate's top margin
  dimV(P, PY + B, Y.head, L, null, null, c('S2'), { side: 'l' }),
  dimV(P, Y.head, Y.headEnd, L, CX0, CX0, c('H1'), { side: 'l' }),
  dimV(P, Y.headEnd, Y.title, L, null, CX0, c('S6'), { side: 'l' }),
  dimV(P, Y.title, Y.titleEnd, L, null, CX0, c('T1'), { side: 'l' }),
  dimV(P, Y.sub, Y.subEnd, L, null, CX0, c('T2'), { side: 'l' }),
  dimV(P, Y.subEnd, Y.subEnd + S8, L, null, null, c('S8'), { side: 'l', dy: 2 }),
  dimV(P, Y.subEnd + S8, Y.plate, L, null, CX0, c('S9'), { side: 'l' }),
  dimV(P, Y.plate, Y.plateEnd, L, null, CX0, `W1 ÷ ${c('AR')}`),
  dimV(P, Y.grid, Y.cols, L, CX0, CX0, c('S13'), { side: 'l' }),
  dimV(P, Y.notesEnd, BOTTOM - B, L, CX0, null, c('S2'), { side: 'l' }),
  dimV(P, BOTTOM, BOTTOM + S3, L, PX, null, c('S3'), { side: 'l' }),
  // right chain: the fill button above the plate, the key block's stack
  dimV(P, FB.y, FB.y + Z2, R, FB.x + Z1, FB.x + Z1, c('Z2'), { side: 'r' }),
  dimV(P, FB.y + Z2, Y.plate, R, null, CX1, c('S11'), { side: 'r' }),
  dimV(P, Y.tb, Y.tbEnd, R, KX + W5, KX + W5, `${TB_ROWS} ROWS · ${c('G6')} CELLS`),
  // bottom chain: notes, the gutter, the key column
  dimH(P, CX0, CX0 + NOTES_W, BOTTOM + 22, Y.notesEnd, Y.notesEnd, `NOTES · FLEX · ${c('G1')}`, { below: true }),
  dimH(P, CX0 + NOTES_W, KX, BOTTOM + 22, Y.notesEnd, Y.tbEnd, c('G2'), { below: true }),
  dimH(P, KX, KX + W5, BOTTOM + 22, Y.tbEnd, Y.tbEnd, `${c('W5')} = ${c('W7')}`, { below: true }),
  // the top run: the fill button's width, the caption's inset
  dimH(P, FB.x, FB.x + Z1, FB.y - 8, FB.y, FB.y, c('Z1'), { dy: 0 }),
  dimH(P, CX0, CX0 + S12, Y.capEnd + 14, Y.capEnd, Y.capEnd, c('S12'), { below: true }),
].join('\n');
const planNotes = [
  nb(PX - 2, PY - 2, 1),
  nb(PX + PW + 10, BOTTOM + 10, 2),
  nb(CX0 + CW - 14, Y.plateEnd - 14, 3),
  nb(FB.x - 14, FB.y + Z2 / 2, 4),
  nb(CX1 - 12, Y.sched + 10, 5),
  nb(CX0 + NOTES_W - 14, Y.cols + 14, 6),
  nb(KX - 10, Y.tb + 10, 7),
].join('\n');

// ---- detail A: the double frame's corner at 4:1 ---------------------------------------------------
const DA = { x: 1290, y: 210, k: 4, n: 220 };
const dk = (v) => v * DA.k;
const detailA = `
${txt(1246, DA.y - 96, 'DETAIL A — THE DOUBLE FRAME', 'lblt')}
${txt(1246, DA.y - 80, `SCALE 4:1 · the sheet's top-left corner, square`, 'lbls')}
<rect x="${DA.x}" y="${DA.y}" width="${DA.n}" height="${dk(B)}" class="fi"/>
<rect x="${DA.x}" y="${DA.y}" width="${dk(B)}" height="${DA.n}" class="fi"/>
<path d="M${DA.x + dk(B + S1)},${DA.y + DA.n} V${DA.y + dk(B + S1)} H${DA.x + DA.n}" class="skf fnone" stroke-width="${dk(B2)}"/>
<path d="M${DA.x + dk(B + S2)},${DA.y + DA.n} V${DA.y + dk(B + S2)} H${DA.x + DA.n}" class="sks fnone" stroke-dasharray="4 3"/>
${txt(DA.x + dk(B + S2) + 8, DA.y + dk(B + S2) + 20, 'CONTENT EDGE', 'lblf')}
${dimH(P, DA.x, DA.x + dk(B), DA.y - 16, DA.y, DA.y, c('B'), { dx: -16 })}
${dimH(P, DA.x + dk(B + S1), DA.x + dk(B + S1 + B2), DA.y - 16, DA.y + dk(B + S1), DA.y + dk(B + S1), c('B2'), { dx: 16 })}
${dimH(P, DA.x + dk(B), DA.x + dk(B + S1), DA.y - 38, null, null, c('S1'))}
${dimH(P, DA.x + dk(B + S1 + B2), DA.x + dk(B + S2), DA.y - 38, null, DA.y + dk(B + S2), c('S2C'))}
${dimH(P, DA.x + dk(B), DA.x + dk(B + S2), DA.y - 60, null, null, c('S2'))}
${dimV(P, DA.y, DA.y + dk(B + S1), DA.x - 18, DA.x, DA.x + dk(B + S1), c('S1R'), { side: 'l' })}
`;

// ---- detail B: the fill button at 3:1 -------------------------------------------------------------
const DB = { x: 1290, y: 520, k: 3 };
const fk = (v) => v * DB.k;
const detailB = `
${txt(1246, DB.y - 52, 'DETAIL B — THE FILL BUTTON', 'lblt')}
${txt(1246, DB.y - 36, 'SCALE 3:1 · hung above the plate\'s top edge', 'lbls')}
<rect x="${DB.x}" y="${DB.y}" width="${fk(Z1)}" height="${fk(Z2)}" class="ska fp"/>
${slot(DB.x + 18, DB.y + 22, fk(Z1) - 36, fk(Z2) - 44, `LABEL · HUG · ${c('T3')}`, { hug: true })}
<line x1="${DB.x - 30}" y1="${DB.y + fk(Z2 + S11)}" x2="${DB.x + fk(Z1) + 10}" y2="${DB.y + fk(Z2 + S11)}" class="sks"/>
${txt(DB.x - 30, DB.y + fk(Z2 + S11) + 16, 'THE PLATE\'S TOP EDGE', 'lblf')}
${dimH(P, DB.x, DB.x + fk(Z1), DB.y - 6, null, null, c('Z1'), { dy: -1 })}
${dimV(P, DB.y, DB.y + fk(Z2), DB.x + fk(Z1) + 18, DB.x + fk(Z1), DB.x + fk(Z1), c('Z2'), { side: 'r' })}
${dimV(P, DB.y + fk(Z2), DB.y + fk(Z2 + S11), DB.x + fk(Z1) + 18, null, null, c('S11'), { side: 'r', dy: 6 })}
`;

// ---- detail C: one title-block cell at 2:1 --------------------------------------------------------
const DC = { x: 1262, y: 820, k: 1.2 };
const CELL_W = at('G5').split(' ')[0];
const cw = Number.parseFloat(CELL_W) * DC.k, ch = TB_ROW * DC.k * 1.3;
const ck = (v) => v * DC.k;
const detailC = `
${txt(1246, DC.y - 52, 'DETAIL C — THE CHOP', 'lblt')}
${txt(1246, DC.y - 36, 'SCALE 1.2:1 · the title block\'s last cell', 'lbls')}
<path d="M${DC.x},${DC.y} H${DC.x + cw} V${DC.y + ch} H${DC.x}" class="sk fnone"/>
<line x1="${DC.x}" y1="${DC.y}" x2="${DC.x}" y2="${DC.y + ch}" class="sks"/>
${slot(DC.x + ck(S14), DC.y + ck(S15), 90, 16, 'FIELD · HUG', { hug: true })}
${slot(DC.x + ck(S14), DC.y + ck(S15) + 22, 70, 16, 'VALUE · HUG', { hug: true })}
<rect x="${DC.x + cw - ck(2 + Z3)}" y="${DC.y + (ch - ck(Z3)) / 2}" width="${ck(Z3)}" height="${ck(Z3)}" class="sk fnone"/>
<rect x="${DC.x + cw - ck(2 + Z3) + 4}" y="${DC.y + (ch - ck(Z3)) / 2 + 4}" width="${ck(Z3) - 8}" height="${ck(Z3) - 8}" class="sks fnone"/>
${dimH(P, DC.x, DC.x + ck(S14), DC.y - 10, null, null, c('S14'), { dx: -10 })}
${dimV(P, DC.y, DC.y + ck(S15), DC.x - 12, null, null, c('S15'), { side: 'l' })}
${dimH(P, DC.x + cw - ck(2 + Z3), DC.x + cw - ck(2), DC.y + ch + 16, DC.y + (ch + ck(Z3)) / 2, DC.y + (ch + ck(Z3)) / 2, c('Z3'), { below: true })}
${dimH(P, DC.x, DC.x + cw, DC.y + ch + 46, DC.y + ch, DC.y + ch, `${c('G5')} · ONE TRACK OF TWO`, { below: true })}
${dimV(P, DC.y, DC.y + ch, DC.x + cw + 16, DC.x + cw, DC.x + cw, c('B6'), { side: 'r' })}
`;

// ---- the phone plan: what stacks at the narrow reading ------------------------------------------
const PP = { x: 70, y: 600, k: 0.75 };
const pk = (v) => v * PP.k;
const PSW = pk(at('W', NARROW)), PCW = pk(at('W1', NARROW));
const pcx = PP.x + pk(B + S2);
let py = PP.y + pk(B + S2);
const PYS = {};
PYS.head = py; py += pk(at('H1', NARROW)); PYS.headEnd = py;
py += pk(S6); PYS.title = py; py += pk(at('T1', NARROW)) + 4; PYS.sub = py; py += 30; PYS.subEnd = py;
py += pk(S8 + S9); PYS.plate = py; py += 130; PYS.plateEnd = py;
py += 34; PYS.cap = py; py += 54; PYS.capEnd = py;
py += 22; PYS.grid = py; py += pk(S13); PYS.notes = py; py += 110; PYS.notesEnd = py;
py += pk(G2); PYS.key = py; py += 36; PYS.keyEnd = py; py += 10; PYS.tb = py; py += 5 * 18; PYS.tbEnd = py;
const PBOT = py + pk(S2 + B);
const PDRAW = pk(at('W2', NARROW));
// the drawing's run past the wrap is broken: it is drawn 80 long and lettered W2
const PRUN = PCW + 80;
const phone = `
${txt(PP.x - 30, PP.y - 66, `THE PHONE PLAN — ${NARROW} WIDE`, 'lblt')}
${txt(PP.x - 30, PP.y - 50, 'SCALE 0.75:1 · one track; the run past the wrap is broken', 'lbls')}
<rect x="${PP.x}" y="${PP.y}" width="${PSW}" height="${PBOT - PP.y}" class="sk2 fp"/>
<rect x="${PP.x + pk(B + S1)}" y="${PP.y + pk(B + S1)}" width="${PSW - 2 * pk(B + S1)}" height="${PBOT - PP.y - 2 * pk(B + S1)}" class="skf fnone"/>
${slot(pcx, PYS.head + 4, 200, 14, 'PROJECT MARK · HUG', { hug: true })}
${slot(pcx, PYS.head + pk(at('H1', NARROW)) - 20, 100, 14, 'SHEET NO', { hug: true })}
<line x1="${pcx}" y1="${PYS.headEnd}" x2="${pcx + PCW}" y2="${PYS.headEnd}" class="sk"/>
${slot(pcx, PYS.title, 180, Math.max(14, pk(at('T1', NARROW))), 'TITLE · HUG', { hug: true })}
${slot(pcx, PYS.sub, PCW, 30, 'SUB · FILL · WRAPS')}
<rect x="${pcx}" y="${PYS.plate}" width="${PCW}" height="${PYS.plateEnd - PYS.plate}" class="sks fp2"/>
<path d="M${pcx + PCW},${PYS.plate + 6} H${pcx + PRUN} l-6,${(PYS.plateEnd - PYS.plate - 12) / 3} l12,${(PYS.plateEnd - PYS.plate - 12) / 3} l-6,${(PYS.plateEnd - PYS.plate - 12) / 3} H${pcx + PCW}" class="ska fnone" stroke-dasharray="6 4"/>
${txt(pcx + 10, PYS.plate + 20, 'PLATE · FILL', 'lblb')}
${txt(pcx + 10, PYS.plate + 36, 'scrolls in its wrap', 'lbls')}
${txt(PP.x + PSW + 6, (PYS.plate + PYS.plateEnd) / 2 + 4, 'SCROLL →', 'lbla')}
${slot(pcx + pk(at('S12', NARROW)), PYS.cap, PCW - pk(at('S12', NARROW)), PYS.capEnd - PYS.cap, 'CAPTION · FILL', { sub: `${c('T6')} at the narrow size` })}
<line x1="${pcx}" y1="${PYS.cap}" x2="${pcx}" y2="${PYS.capEnd}" class="sk"/>
<line x1="${pcx}" y1="${PYS.grid}" x2="${pcx + PCW}" y2="${PYS.grid}" class="sk"/>
${slot(pcx, PYS.notes, PCW, PYS.notesEnd - PYS.notes, 'NOTES · FILL · ONE TRACK')}
${slot(pcx, PYS.key, PCW, PYS.keyEnd - PYS.key, 'KEY ROWS · HUG · STATIC', { hug: true })}
${box(pcx, PYS.tb, PCW, PYS.tbEnd - PYS.tb, 'sk fnone')}
${txt(pcx + 10, PYS.tb + 16, 'TITLE BLOCK · W7', 'lblf')}
${dimH(P, PP.x, PP.x + PSW, PP.y - 20, PP.y, PP.y, `${c('W')} @${NARROW}`)}
${dimH(P, pcx, pcx + PCW, PYS.plateEnd + 10, PYS.plateEnd, PYS.plateEnd, `${c('W1')} = W − 2·S2 − 2·B`, { below: true })}
${dimH(P, pcx, pcx + PRUN, PYS.plate - 10, null, null, `${c('W2')} · BROKEN`)}
${dimV(P, PYS.head, PYS.headEnd, PP.x - 10, pcx, pcx, `${c('H1')} · WRAPS`)}
${dimV(P, PYS.title, PYS.title + pk(at('T1', NARROW)), PP.x + PSW + 14, pcx + 180, pcx + 180, c('T1'), { side: 'r' })}
${dimV(P, PYS.key, PYS.keyEnd, PP.x + PSW + 14, pcx + PCW, pcx + PCW, c('K'), { side: 'r' })}
${nb(PP.x + PSW - 16, PYS.notes + 14, 6)}
`;
if (pcx + PRUN > PX - 40) throw new Error(`appendix A5: the phone plan's broken run reaches ${(pcx + PRUN).toFixed(0)}, into the plan's left chain`);
if (PDRAW <= PRUN) throw new Error('appendix A5: the drawing\'s floor is shorter than its broken run; draw it whole');
const PHONE_BOTTOM = PBOT;

// ---- the notes, top-left, numbered as the plan's boxes ------------------------------------------------
const N = [
  [1, `The frame is a double rule: a ${c('B')} border and a ${c('B2')} rule inset ${c('S1')}; content stands ${c('S2')} in.`],
  [2, 'Every corner of the chrome is square: no radius is declared, so no R code stands.'],
  [3, `The plate fills the column at the drawing's own ratio ${c('AR')}, capped by ${c('CAP')}, never under ${c('W2')}.`],
  [4, `The fill button hangs ${c('S11')} above the plate; it is the one control the sheet carries.`],
  [5, `A schedule is an HTML table at ${c('T4')}; past ${c('N')} rows it sets two tables side by side.`],
  [6, `The notes grid is two tracks wide and one narrow; the key rides at ${c('ST2')} from the top.`],
  [7, `The title block is ${G6} cells on two tracks, the chop a ${c('Z3')} square in the last.`],
];
const NX = 30, NY = 132;
const notesSvg = [
  txt(NX, NY - 32, 'NOTES — UNLESS OTHERWISE SPECIFIED', 'lblt'),
  ...N.map(([n, s], i) => nb(NX + 6, NY + i * 34 - 4, n) + txt(NX + 20, NY + i * 34, s.length > 58 ? s.slice(0, s.lastIndexOf(' ', 58)) : s, 'lbls')
    + (s.length > 58 ? txt(NX + 20, NY + i * 34 + 14, s.slice(s.lastIndexOf(' ', 58) + 1), 'lbls') : '')),
  txt(NX, NY + N.length * 34 + 6, `Spacing drawn at 1:1 at ${WIDE} wide; slots are schematic, never copy.`, 'lblf'),
  txt(NX, NY + N.length * 34 + 20, 'Every dimension is a code; each code is a row in the schedules below.', 'lblf'),
  txt(NX, NY + N.length * 34 + 34, 'HUG — sized by content · FLEX — takes what is left · FILL — the parent\'s width.', 'lblf'),
  txt(NX, NY + N.length * 34 + 48, `Read from data/survey-chrome.json · ${BASIS}.`, 'lblf'),
].join('\n');
for (const [, s] of N) if (s.length > 116) throw new Error(`appendix A5: a note runs past two lines: ${s}`);

const UPPER_H = Math.ceil(Math.max(BOTTOM + S3 + 40, PHONE_BOTTOM + 30, DC.y + 120));

// ---- the grid: the chrome's tracks as hairlines over a schematic sheet at each width ---------------
const px = (v) => Number.parseFloat(v);
const trackList = (v) => String(v).trim().split(/\s+/).map(px);
// slot heights are schematic, as the plan's are; every x and every track is the plate's
const SCHEM = {
  [WIDE]: { titleW: 320, sub: 18, cap: 48, notes: 0 },
  [NARROW]: { titleW: 240, sub: 36, cap: 60, notes: 200 },
};
const sheetAt = (w) => {
  const s = SCHEM[w];
  const b = at('B', w), x0 = b + at('S2', w), w1 = at('W1', w), g1 = trackList(at('G1', w)), g2 = at('G2', w), g5 = trackList(at('G5', w));
  const sum = g1.reduce((a, v) => a + v, 0) + g2 * (g1.length - 1);
  if (Math.abs(sum - w1) > 0.01) throw new Error(`appendix A5: the notes tracks G1 and gutter G2 sum to ${sum} at ${w}, against W1 ${w1}`);
  const w7 = at('W7', w);
  if (Math.abs(2 * b + g5[0] + g5[1] - w7) > 0.01) throw new Error(`appendix A5: the title block's tracks G5 and frame B do not close on W7 ${w7} at ${w}`);
  const els = [];
  let yy = x0;
  const put = (x, ww, h) => { els.push({ x, y: yy, w: ww, h }); yy += h; };
  put(x0, w1, at('H1', w)); yy += S6;
  put(x0, s.titleW, at('T1', w)); yy += S7;
  put(x0, w1, s.sub); yy += S8 + S9;
  put(x0, w1, at('W3', w) / AR); yy += 10;
  put(x0, w1, 72); yy += 28;
  put(x0, at('W4', w), s.cap); yy += 40;
  const gridY = yy; yy += S13;
  const cols = yy;
  let key, tb;
  if (g1.length === 2) {
    const kx = x0 + g1[0] + g2;
    key = { x: kx, y: cols, w: at('W6', w), h: 64 };
    tb = { x: kx, y: key.y + key.h + 20, w: w7, h: TB_ROWS * TB_ROW };
    els.push({ x: x0, y: cols, w: g1[0], h: tb.y + tb.h - cols });
  } else {
    els.push({ x: x0, y: cols, w: g1[0], h: s.notes });
    key = { x: x0, y: cols + s.notes + g2, w: at('W6', w), h: 64 };
    tb = { x: x0, y: key.y + key.h + 20, w: w7, h: TB_ROWS * TB_ROW };
  }
  els.push(key, tb);
  return { w, W: at('W', w), H: tb.y + tb.h + x0, b, x0, w1, g1, g2, g5, gridY, key, tb, els, sticky: at('K', w) === 'sticky' };
};
const GRID = { y: UPPER_H + 10, gap: 26 };
GRID.top = GRID.y + 110;
const GROUPS = [{ s: sheetAt(WIDE), k: 0.25, x: 70 }, { s: sheetAt(NARROW), k: 0.3 }];
GROUPS[1].x = GROUPS[0].x + 3 * GROUPS[0].s.W * GROUPS[0].k + 2 * GRID.gap + 70;
const gridPanel = ({ s, k }, ox, mode) => {
  const X = (v) => ox + v * k, Yg = (v) => GRID.top + v * k;
  const ln = (x1, y1, x2, y2) => `<line x1="${X(x1).toFixed(1)}" y1="${Yg(y1).toFixed(1)}" x2="${X(x2).toFixed(1)}" y2="${Yg(y2).toFixed(1)}" class="skf"/>`;
  const rect = (x, yy, ww, h, cls) => `<rect x="${X(x).toFixed(1)}" y="${Yg(yy).toFixed(1)}" width="${(ww * k).toFixed(1)}" height="${(h * k).toFixed(1)}" class="${cls}"/>`;
  const inset = s.b + S1, bottom = s.H - s.x0;
  const hairlines = [rect(0, 0, s.W, s.H, 'skf fnone'), rect(inset, inset, s.W - 2 * inset, s.H - 2 * inset, 'skf fnone')];
  const edges = [s.x0];
  let tx = s.x0;
  s.g1.forEach((t, i) => { tx += t; edges.push(tx); if (i < s.g1.length - 1) { tx += s.g2; edges.push(tx); } });
  for (const ex of edges) hairlines.push(ln(ex, s.x0, ex, bottom));
  hairlines.push(ln(s.x0, s.x0, s.x0 + s.w1, s.x0), ln(s.x0, bottom, s.x0 + s.w1, bottom));
  const t5 = [s.tb.x + s.b, s.tb.x + s.b + s.g5[0], s.tb.x + s.b + s.g5[0] + s.g5[1]];
  for (const ex of t5) hairlines.push(ln(ex, s.tb.y, ex, s.tb.y + s.tb.h));
  if (s.sticky) hairlines.push(ln(s.key.x, s.key.y, s.key.x + s.key.w, s.key.y));
  const out = [];
  if (mode === 'grid') out.push(rect(0, 0, s.W, s.H, 'fp'), ...hairlines);
  else out.push(rect(0, 0, s.W, s.H, 'sk2 fp'), rect(inset, inset, s.W - 2 * inset, s.H - 2 * inset, 'skf fnone'));
  if (mode === 'blocked') out.push(...s.els.map((e) => rect(e.x, e.y, e.w, e.h, 'skf fp2')), ...hairlines.slice(2));
  if (mode !== 'grid') return out.join('\n');
  // the codes, lettered in the air above and below the panel
  const top = GRID.top, low = Yg(s.H);
  let gx = s.x0;
  s.g1.forEach((t, i) => {
    out.push(dimH(P, X(gx), X(gx + t), top - 10, top, top, c('G1')));
    gx += t;
    if (i < s.g1.length - 1) { out.push(dimH(P, X(gx), X(gx + s.g2), top - 28, top, top, c('G2'))); gx += s.g2; }
  });
  out.push(dimH(P, X(s.b), X(inset), top - 28, null, null, c('S1'), { dx: -6 }));
  out.push(dimH(P, X(t5[0]), X(t5[1]), low + 10, low, low, c('G5'), { below: true }));
  out.push(dimH(P, X(t5[1]), X(t5[2]), low + 10, low, low, c('G5'), { below: true }));
  if (s.sticky) out.push(txt(X(s.key.x + 12).toFixed(1), (Yg(s.key.y) + 12).toFixed(1), `${c('K')} · TOP AT ${c('ST')}`, 'lbld'));
  return out.join('\n');
};
const PANEL_WORDS = [['empty', '1 · THE EMPTY SHEET', '1 · EMPTY'], ['grid', '2 · THE GRID', '2 · GRID'], ['blocked', '3 · BLOCKED IN', '3 · BLOCKED']];
const gridGroup = (g, gi) => {
  const pw = g.s.W * g.k;
  const out = [txt(g.x, GRID.y + 62, `AT ${g.s.w} WIDE · ${g.s.g1.length} ${g.s.g1.length === 1 ? 'TRACK' : 'TRACKS'} · SCALE ${g.k}:1`, 'lblb')];
  PANEL_WORDS.forEach(([mode, wide, narrow], i) => {
    const ox = g.x + i * (pw + GRID.gap);
    out.push(gridPanel(g, ox, mode), txt(ox, GRID.top + g.s.H * g.k + 44, gi === 0 ? wide : narrow, 'lbls'));
  });
  return out.join('\n');
};
const GRID_RIGHT = GROUPS[1].x + 3 * GROUPS[1].s.W * GROUPS[1].k + 2 * GRID.gap;
if (GRID_RIGHT > VB_W - 40) throw new Error(`appendix A5: the grid row runs to ${GRID_RIGHT.toFixed(0)}, past the sheet's ${VB_W - 40}`);
const GRID_BOTTOM = GRID.top + Math.max(...GROUPS.map((g) => g.s.H * g.k)) + 44;
const gridRow = `
${txt(30, GRID.y + 20, 'THE GRID — THE CHROME\'S TRACKS AS HAIRLINES', 'lblt')}
${txt(30, GRID.y + 36, 'after the NASA Graphics Standards Manual, pages 5.14–5.16: the empty sheet, the grid alone, the elements blocked in on it', 'lbls')}
${GROUPS.map(gridGroup).join('\n')}
`;

const VB_H = Math.ceil(GRID_BOTTOM + 30);
const header = `${txt(1520, 34, `SCALE — spacing 1:1 at ${WIDE} wide · detail A 4:1 · detail B 3:1 · detail C 1.2:1 · the phone plan 0.75:1`, 'lbls', 'end')}
${txt(1520, 48, `${INSTANCES} instances, one geometry: every .sheet section on the routed pages and the bare plates`, 'lblf', 'end')}
${txt(1520, 62, `measured in chromium at ${WIDE} and ${NARROW} wide on ${PLATE.page}, after fonts.ready`, 'lblf', 'end')}`;

const ARIA = `A dimensional drawing of the sheet chrome every plate in the atlas is set in. Notes at top left, numbered one to ${N.length}. `
  + `At the centre, the plan of one sheet at ${WIDE} wide, spacing at one to one: the double frame, the sheet head, title and sub slots, the plate with its fill button above, a schedule, the caption, the notes and the key column with the title block, dimensioned in codes. `
  + `At right, three details: the double frame's corner at four to one, the fill button at three to one, and the title block's last cell with its chop at one point two to one. `
  + `At lower left, the same sheet at ${NARROW} wide, where the head wraps, the drawing scrolls past its wrap and the key stacks under the notes. Along the foot, the grid row: the sheet at each width three times, empty, as its tracks drawn in hairlines alone, and with its elements blocked in as grey slots on those tracks. Every code is a row in the schedules under the drawing.`;

const detailRefs = [
  detailRef(PX + 12, PY + 12, 24, 'A', 1226, DA.y - 100),
  detailRef(FB.x + Z1 / 2, FB.y + Z2 / 2, 50, 'B', 1226, DB.y - 56),
  detailRef(TB_SHEET.x + W5 / 4, TB_SHEET.y + TB_ROW / 2, 70, 'C', 1226, DC.y - 56),
].join('\n');
const svg = `<svg viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-label="${ARIA}">
${defs(P)}
${header}
${notesSvg}
${plan}
${planDims}
${planNotes}
${detailRefs}
${detailA}
${detailB}
${detailC}
${phone}
${gridRow}
</svg>`;

// ---- schedules: every row of the plate, by kind ---------------------------------------------------------
const KIND = {
  Spacing: (code) => /^S\d+[A-Z]?$/.test(code),
  Size: (code) => /^(B\d?|W\d?|Z\d|AR|CAP|H\d)$/.test(code),
  Type: (code) => /^T\d$/.test(code),
  Grid: (code) => /^(G\d|N|K|P\d?|ST\d?)$/.test(code),
};
for (const r of PLATE.rows) {
  const n = Object.values(KIND).filter((t) => t(r.code)).length;
  if (n !== 1) throw new Error(`appendix A5: plate row ${r.code} falls in ${n} schedules, not one`);
}
const valueOf = (r) => `${fmt(r.value)}${r.unit && r.unit !== '' ? ` ${r.unit}` : ''}`;
const HEAD = ['code', 'variable', 'value', 'source', 'formula'];
const SCHEDULES = Object.entries(KIND).map(([kind, test]) => schedule(
  `${kind.toUpperCase()} — ${kind === 'Spacing' ? 'padding, margins and insets' : kind === 'Size' ? 'borders, widths, heights and squares' : kind === 'Type' ? 'lettering sizes' : 'tracks, counts and positions'}`,
  HEAD,
  PLATE.rows.filter((r) => test(r.code)).map((r) => [r.code, r.name, valueOf(r), r.source, r.formula ?? '—']),
));
if (SCHEDULES.length !== 4) throw new Error(`appendix A5: the caption counts four schedules, and ${SCHEDULES.length} stand`);
for (const code of DRAWN) if (!SCHEDULES.some((s) => s.rows.some((r) => r[0] === code))) throw new Error(`appendix A5: ${code} is lettered on the drawing and stands in no schedule`);

const D = derived('S1R');
const CODES = new Set(PLATE.rows.map((r) => r.code)).size;
export const SHEETA5_VERDICT = `meta — the sheet chrome every plate is set in, dimensioned: ${INSTANCES} instances, one geometry; ${CODES} variables measured in chromium at ${WIDE} and ${NARROW} wide or read from chrome.mjs; the ${declared('B')} px frame draws at ${at('B')} px`;

export const sheetA5 = {
  num: 'A5', id: 'self-chrome', rev: 'B',
  head: 'APPENDIX A5 · META',
  appendix: true,
  title: 'THE SHEET, DIMENSIONED',
  sub: `APPENDIX · META — the sheet every plate is set in, as a dimensional drawing: the double frame, the head, the plate and its fill button, the schedule, the caption, the notes and the title block, in codes · ${INSTANCES} instances, one geometry · measured at ${BASIS}, outside the cabinet`,
  scale: 'THE ATLAS ITSELF',
  form: 'DIMENSIONED PLAN',
  svg,
  schedules: SCHEDULES,
  caption: `The atlas's own sheet chrome drawn as a component: one sheet in plan at ${WIDE} wide with its spacing at 1:1, three details drawn larger and the same sheet at ${NARROW} wide. Every dimension is a code, and every code is a row in the four schedules under the drawing, measured in chromium or read from chrome.mjs.`,
  notes: `
<p><strong>Method — the built app, measured.</strong> <code>generator/survey-chrome.mjs</code> serves the built app and reads one routed sheet, <code>${PLATE.page}</code>, the cover and the bare plate in chromium at ${WIDE} and ${NARROW} wide, after <code>document.fonts.ready</code>: every box the chrome draws, by <code>getBoundingClientRect</code> and <code>getComputedStyle</code>. A constant the CSS cannot show, such as the schedule split <code>SCHEDULE_SPLIT</code>, and every clamp expression are read off <code>chrome.mjs</code>'s own source and filed as their own rows. A missing selector stops the probe; the cover's frame and the routed sheet's must agree at both widths. The plate is <code>data/survey-chrome.json</code>, ${PLATE.rows.length} rows of ${CODES} codes at ${BASIS}: the atlas is not on main, so the plate stands outside the cabinet, as the other self-portraits do.</p>
<p><strong>Codes, not numbers.</strong> The drawing letters codes; the values stand in the schedules. S is spacing, B a border or rule, W a width, H a height, Z a square, T a lettering size, G a grid track or count. A derived row carries its formula: the inner rule stands ${fmt(D.value)} px in from the outer edge, ${D.formula}. A row the two widths agree on is one row; a row they part on is two, one per width. The idiom is <a href="${DIMENSIONAL.skill}"><code>dimensional-drawing</code></a> by enesozturk (MIT), after <a href="${DIMENSIONAL.apple}">Apple's accessory dimensional drawings</a>: codes on the drawing, every code a row of a schedule, derived values written as formulas, nothing invented. The atlas sets it in its own chrome, in both themes, with colour kept editorial.</p>
<p><strong>What the drawing says.</strong> The chrome declares a ${declared('B')} px frame on the sheet, the schedules, the caption's rule and the title block, and chromium draws each at ${at('B')} px at a device pixel ratio of ${PLATE.dpr}; the inner rule's offset follows the frame it is drawn by. Every corner is square. At ${NARROW} wide the head wraps to ${fmt(at('H1', NARROW))} px against ${fmt(at('H1'))}, the title steps down its clamp from ${at('T1')} to ${at('T1', NARROW)} px, the drawing keeps its ${at('W2')} px floor and scrolls inside a ${at('W1', NARROW)} px wrap, and the key leaves its sticky seat to stand under the notes.</p>
<p><strong>The grid.</strong> The row along the foot lays the chrome's tracks as hairlines over a schematic sheet at each measured width, the way the <a href="${NASA_MANUAL.page}">NASA Graphics Standards Manual</a> (NHB 1430.2, 1976, in NASA's later reprint) draws its grid over a spread and then blocks the elements in, on <a href="${NASA_MANUAL.pdf}">pages 5.14–5.16</a>: the empty sheet, the grid alone, the elements set on it as grey slots. The grid is the outer frame, the inner rule S1 in, the content edge, the notes grid's tracks G1 with the G2 gutter between them, the title block's two G5 tracks, and at ${WIDE} wide the key's top, the edge that rides ST under the viewport on the bare plate and ST2 in the routed app. At ${NARROW} wide the notes grid is one track and the key is static, so no sticky line stands. The tracks are the plate's at each width; the slot heights are schematic, as the plan's are. The hairlines are the chrome's faint line, so the accent stays on the fill button and the phone plan's scroll run.</p>`,
  key: [
    keyRow('<rect x="4" y="2" width="40" height="14" class="sk2 fnone"/><rect x="8" y="6" width="32" height="6" class="skf fnone"/>', 'the sheet: the outer frame and the inner rule'),
    keyRow('<rect x="4" y="3" width="40" height="12" class="skf fp2" stroke-dasharray="4 3"/>', 'a slot that hugs its content'),
    keyRow('<rect x="4" y="3" width="40" height="12" class="skf fnone" stroke-dasharray="4 3"/>', 'a slot that fills or flexes'),
    keyRow('<rect x="10" y="3" width="28" height="12" class="ska fp"/>', 'the fill button, the sheet\'s one control'),
    keyRow(`<line x1="6" y1="9" x2="42" y2="9" class="sks" marker-start="url(#${P}-as)" marker-end="url(#${P}-as)"/>`, 'a dimension, lettered with its code'),
    keyRow('<circle cx="24" cy="9" r="7" class="skf fnone" stroke-dasharray="6 3"/>', 'a detail circle, drawn larger at right'),
    keyRow('<rect x="18" y="3" width="12" height="12" class="sk fp"/>', 'a boxed note number'),
    keyRow('<rect x="4" y="2" width="40" height="14" class="skf fp2"/><line x1="16" y1="0" x2="16" y2="18" class="skf"/><line x1="32" y1="0" x2="32" y2="18" class="skf"/>', 'a grid hairline over an element blocked in on its tracks'),
  ].join('\n'),
};
