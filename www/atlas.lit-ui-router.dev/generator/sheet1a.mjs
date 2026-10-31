import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, keyRow, schedule, leader, dimH, dimV, rad, nb, detailRef } from './helpers.mjs';

const P = 's1a';

// ---- the plate: the sample app's contacts page, measured (census-document.mjs) ----
const D = JSON.parse(readFileSync(new URL('../data/census-document.json', import.meta.url), 'utf8'));
const ROW = (code) => {
  const r = D.rows.find((x) => x.code === code);
  if (!r) throw new Error(`census-document.json: no row ${code}`);
  return r;
};
const V = (code) => ROW(code).value;
const SLOT = (code) => {
  const s = D.slots.find((x) => x.code === code);
  if (!s) throw new Error(`census-document.json: no slot ${code}`);
  return s;
};
const MARKS = (at, role) => {
  const m = D.marks.filter((x) => x.at === at && x.role === role).map((x) => x.rect);
  if (!m.length) throw new Error(`census-document.json: no ${role} marks @${at}`);
  return m;
};
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
// the notes say every sample app draws this one geometry
if (D.css.identical !== D.css.of || D.shells.identical !== D.shells.of) throw new Error(`sheet 1A: ${D.css.identical}/${D.css.of} stylesheets and ${D.shells.identical}/${D.shells.of} shells match — the notes claim one geometry`);
const APPS = WORD[D.css.of];
const UIVIEWS = D.survey.filter((s) => s.tag === '<ui-view>' && s.where === 'sample-app-shared').reduce((a, s) => a + s.n, 0);
const SHELL_VIEWS = D.survey.find((s) => s.tag === '<ui-view>' && s.where === 'sample-app-lit-vanilla' && s.file.endsWith('main/App.ts'))?.n;
if (!SHELL_VIEWS) throw new Error('census-document.json: no <ui-view> count for the vanilla shell');
for (const s of ['TAB', 'ROW', 'NEST']) if (SLOT(s).word !== { TAB: 'HUG', ROW: 'FILL', NEST: 'FLEX' }[s]) throw new Error(`sheet 1A: slot ${s} reads ${SLOT(s).word}`);
if (SLOT('LIST').word !== 'HUG' || SLOT('VIEW').word !== 'FILL' || !SLOT('NEST').wrapped) throw new Error('sheet 1A: the plan letters LIST HUG, VIEW FILL and a nested view that wraps at 390');

const f = (v) => Number(v).toFixed(1);
const rect = (x, y, w, h, cls, extra = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" class="${cls}"${extra}/>`;
const hatch = (x, y, w, h, pat = 'hx') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="url(#${P}-${pat})"/>` + rect(x, y, w, h, 'skf fnone');
const tabPath = (x, y, w, h, r, cls) => `<path d="M${f(x)},${f(y + h)} V${f(y + r)} A${f(r)},${f(r)} 0 0 1 ${f(x + r)},${f(y)} H${f(x + w - r)} A${f(r)},${f(r)} 0 0 1 ${f(x + w)},${f(y + r)} V${f(y + h)}" class="${cls}"/>`;
// a view onto page coordinates: origin, scale, and an optional crop window in page px
const view = (ox, oy, s, crop = null) => {
  const X = (x) => ox + (x - (crop?.[0] ?? 0)) * s;
  const Y = (y) => oy + (y - (crop?.[1] ?? 0)) * s;
  const cut = ([x, y, w, h]) => {
    if (!crop) return [x, y, w, h];
    const x0 = Math.max(x, crop[0]), y0 = Math.max(y, crop[1]);
    const x1 = Math.min(x + w, crop[0] + crop[2]), y1 = Math.min(y + h, crop[1] + crop[3]);
    return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
  };
  // a cropped box strokes only the edges it really has; the crop line is not one of them
  const R = (r, cls, extra = '') => {
    const c = cut(r);
    if (!c) return '';
    const [x, y, w, h] = c;
    if (x === r[0] && y === r[1] && w === r[2] && h === r[3]) return rect(X(x), Y(y), w * s, h * s, cls, extra);
    const stroke = cls.split(' ').filter((k) => k.startsWith('sk')).join(' ');
    const fill = cls.split(' ').filter((k) => !k.startsWith('sk') && k !== 'fnone').join(' ');
    const e = [[x === r[0], X(x), Y(y), X(x), Y(y + h)], [y === r[1], X(x), Y(y), X(x + w), Y(y)],
      [x + w === r[0] + r[2], X(x + w), Y(y), X(x + w), Y(y + h)], [y + h === r[1] + r[3], X(x), Y(y + h), X(x + w), Y(y + h)]];
    const d = e.filter(([real]) => real).map(([, x1, y1, x2, y2]) => `M${f(x1)},${f(y1)} L${f(x2)},${f(y2)}`).join(' ');
    return (fill ? rect(X(x), Y(y), w * s, h * s, fill) : '') + (stroke && d ? `<path d="${d}" class="${stroke}"${extra}/>` : '');
  };
  return { X, Y, R, s };
};
const DASH = ' stroke-dasharray="4 3"';
const SEAM = ' stroke-dasharray="7 4"';

// ---- the plan at 1280 ---------------------------------------------------------
const S = 0.55, PX = 100, PY = 210;
const A1 = view(PX, PY, S);
const VW = V('VW'), VH = V('VH');
const NAV = SLOT('NAV').at1280, TAB = SLOT('TAB').at1280, VIEW = SLOT('VIEW').at1280, LIST = SLOT('LIST').at1280;
const ROWR = SLOT('ROW').at1280, NEST = SLOT('NEST').at1280, DET = SLOT('DETAIL').at1280;
const inset = ([x, y, w, h], i, b) => [x + i, y + b, w - 2 * i, h - 2 * b];
const content = inset(DET, V('S10'), V('S9'));

const page = (A, at, frameH) => {
  const sl = (c) => SLOT(c)[at === 1280 ? 'at1280' : 'at390'];
  const [nx, ny, nw, nh] = sl('NAV');
  const det = sl('DETAIL');
  return [
    A.R([0, 0, at === 1280 ? VW : V('VW2'), frameH], 'sk fnone'),
    `<line x1="${f(A.X(nx))}" y1="${f(A.Y(ny + nh))}" x2="${f(A.X(nx + nw))}" y2="${f(A.Y(ny + nh))}" class="sks"/>`,
    ...MARKS(at, 'tab').map(([x, y, w, h]) => tabPath(A.X(x), A.Y(y), w * A.s, h * A.s, V('R1') * A.s, (x === TAB[0] ? 'sk fp2' : 'sks fnone'))),
    ...MARKS(at, 'navbtn').map((r) => A.R(r, 'sk fp2', ` rx="${f(V('R2') * A.s)}"`)),
    ...MARKS(at, 'menu').map((r) => A.R(r, 'skf fnone', DASH)),
    A.R(sl('LIST'), 'sk fp2'),
    ...MARKS(at, 'li').slice(2).map((r) => A.R(r, 'skf fnone')),
    ...MARKS(at, 'newbtn').map((r) => A.R(r, 'sk fp', ` rx="${f(V('R2') * A.s)}"`)),
    A.R(sl('ROW'), 'ska fp'),
    A.R(sl('VIEW'), 'sks fnone', ' stroke-dasharray="6 3"'),
    A.R(det, 'sk fnone'),
    A.R(inset(det, V('S10'), V('S9')), 'skf fnone', DASH),
    ...MARKS(at, 'act').map((r) => A.R(r, 'sk fp2', ` rx="${f(V('R2') * A.s)}"`)),
    A.R(sl('NEST'), 'ska fnone', SEAM),
  ].join('\n');
};

const plan1280 = [
  txt(PX, 150, `PLAN — ${D.build.detailPath} AT ${VW} × ${VH} · SCALE ${S} : 1`, 'lblb'),
  hatch(A1.X(0), A1.Y(V('H9')), VW * S, (VH - V('H9')) * S),
  page(A1, 1280, VH),
  // chained codes: across the top, down both sides
  dimH(P, A1.X(0), A1.X(VW), 170, PY, PY, 'VW'),
  dimH(P, A1.X(0), A1.X(LIST[2]), 192, PY, A1.Y(LIST[1]), 'W1 · HUG'),
  dimH(P, A1.X(LIST[2]), A1.X(VW), 192, A1.Y(LIST[1]), PY, 'W2 · FLEX'),
  dimV(P, A1.Y(NAV[1]), A1.Y(NAV[1] + NAV[3]), 78, PX, PX, 'H5'),
  dimV(P, A1.Y(LIST[1]), A1.Y(LIST[1] + LIST[3]), 78, PX, PX, 'H6 · HUG'),
  dimV(P, PY, A1.Y(V('H9')), 54, PX, PX, 'H9'),
  dimV(P, A1.Y(V('H9')), A1.Y(VH), 54, PX, PX, 'S11'),
  dimV(P, PY, A1.Y(VH), 30, PX, PX, 'VH'),
  dimV(P, PY, A1.Y(DET[1]), 826, A1.X(VW), A1.X(VW), 'T1', { side: 'r' }),
  dimV(P, A1.Y(DET[1]), A1.Y(DET[1] + DET[3]), 826, A1.X(VW), A1.X(VW), 'H8 · HUG', { side: 'r' }),
  // slots lettered in their own air
  txt(A1.X(600), A1.Y(29), 'NAV · FILL', 'lbls', 'middle'),
  nb(A1.X(700), A1.Y(25), 4),
  txt(A1.X(content[0] + content[2] / 2), A1.Y(content[1] + content[3] / 2) - 4, 'CONTENT SLOT · HUG', 'lbls', 'middle'),
  txt(A1.X(content[0] + content[2] / 2), A1.Y(content[1] + content[3] / 2) + 9, '.contact · FILL, inset S9 / S10', 'lblf', 'middle'),
  nb(A1.X(content[0] + content[2] / 2) + 74, A1.Y(content[1] + content[3] / 2) - 8, 1),
  txt(A1.X(MARKS(1280, 'act')[1][0] + MARKS(1280, 'act')[1][2]) + 8, A1.Y(MARKS(1280, 'act')[1][1] + 21), 'uiSref ACTIONS · HUG', 'lblf'),
  txt(A1.X(NEST[0] + NEST[2] / 2), A1.Y((DET[1] + DET[3] + NEST[1] + NEST[3]) / 2) - 4, '<ui-view> · FLEX', 'lblb', 'middle'),
  txt(A1.X(NEST[0] + NEST[2] / 2), A1.Y((DET[1] + DET[3] + NEST[1] + NEST[3]) / 2) + 10, 'nested in <sample-contacts>, unnamed', 'lblf', 'middle'),
  nb(A1.X(NEST[0] + NEST[2] / 2) + 62, A1.Y((DET[1] + DET[3] + NEST[1] + NEST[3]) / 2) - 8, 2),
  txt(A1.X(LIST[2] / 2), A1.Y(LIST[1] + LIST[3]) + 19, 'LIST · HUG', 'lbls', 'middle'),
  txt(A1.X(VW) - 6, A1.Y(LIST[1] + LIST[3]) + 19, '<ui-view name="contacts"> · FILL', 'lbls', 'end'),
  // the three details
  detailRef(A1.X(TAB[0] + TAB[2] / 2), A1.Y(TAB[1] + TAB[3] / 2), 16, 'DETAIL A', 262, 224),
  detailRef(A1.X(LIST[2]) + 13, A1.Y(DET[1]) + 22, 16, 'DETAIL C', 290, 266),
  detailRef(A1.X(ROWR[2] / 2), A1.Y(ROWR[1] + ROWR[3] / 2), 16, 'DETAIL B', 290, 300),
].join('\n');

// ---- the plan at 390 ----------------------------------------------------------
const QX = 950, QY = 210;
const A2 = view(QX, QY, S);
const VW2 = V('VW2'), VH2 = V('VH2'), H10 = V('H10');
const L2 = SLOT('LIST').at390, N2 = SLOT('NEST').at390, NAV2 = SLOT('NAV').at390;
const plan390 = [
  txt(QX, 150, `PLAN — THE SAME PAGE AT ${VW2} × ${VH2} · SCALE ${S} : 1`, 'lblb'),
  hatch(A2.X(0), A2.Y(H10 - V('S11')), VW2 * S, V('S11') * S),
  page(A2, 390, H10),
  `<line x1="${f(A2.X(0) - 8)}" y1="${f(A2.Y(VH2))}" x2="${f(A2.X(VW2) + 8)}" y2="${f(A2.Y(VH2))}" class="sks" stroke-dasharray="10 3 2 3"/>`,
  txt(A2.X(VW2) - 4, A2.Y(VH2) - 4, 'FOLD', 'lblf', 'end'),
  dimH(P, A2.X(0), A2.X(VW2), 170, QY, QY, 'VW2'),
  dimH(P, A2.X(0), A2.X(L2[2]), 192, QY, A2.Y(L2[1]), 'W1'),
  dimV(P, A2.Y(NAV2[1]), A2.Y(NAV2[1] + NAV2[3]), 1186, A2.X(VW2), A2.X(VW2), 'H4'),
  dimV(P, A2.Y(L2[1]), A2.Y(L2[1] + L2[3]), 1186, A2.X(VW2), A2.X(VW2), 'H6 · HUG'),
  dimV(P, A2.Y(N2[1]), A2.Y(N2[1] + N2[3]), 1186, A2.X(VW2), A2.X(VW2), 'H8'),
  dimV(P, A2.Y(N2[1] + N2[3]), A2.Y(H10), 1186, A2.X(VW2), A2.X(VW2), 'S11'),
  dimV(P, QY, A2.Y(VH2), 1210, A2.X(VW2), A2.X(VW2), 'VH2'),
  dimV(P, QY, A2.Y(H10), 1234, A2.X(VW2), A2.X(VW2), 'H10'),
  txt(A2.X((L2[2] + VW2) / 2), A2.Y(L2[1] + 160), 'LIST · HUG', 'lbls', 'middle'),
  txt(A2.X((L2[2] + VW2) / 2), A2.Y(L2[1] + 160) + 13, 'W1 at both widths', 'lblf', 'middle'),
  txt(A2.X((L2[2] + VW2) / 2), A2.Y(N2[1]) - 40, '<ui-view> · FLEX', 'lbls', 'middle'),
  txt(A2.X((L2[2] + VW2) / 2), A2.Y(N2[1]) - 27, 'wraps under the list', 'lblf', 'middle'),
  txt(A2.X((L2[2] + VW2) / 2), A2.Y(N2[1]) - 14, 'to the full line, W3', 'lblf', 'middle'),
  nb(A2.X((L2[2] + VW2) / 2), A2.Y(N2[1]) - 60, 3),
].join('\n');

// ---- detail A: the active tab, an <a uiSref>, at 3 : 1 --------------------------
const AX = 70, AY = 800;
const DA = view(AX, AY, 3, [TAB[0] - 12, TAB[1], TAB[2] + 24, TAB[3]]);
const [tx, ty, tw, th] = TAB;
const tL = DA.X(tx), tR = DA.X(tx + tw), tT = DA.Y(ty), tB = DA.Y(ty + th);
const navLine = DA.Y(NAV[1] + NAV[3]) - V('B') * 1.5;
const detailA = [
  txt(40, 742, 'DETAIL A — THE ACTIVE TAB, AN <a uiSref> · SCALE 3 : 1', 'lblb'),
  `<line x1="${f(tL - 36)}" y1="${f(DA.Y(0))}" x2="${f(tR + 36)}" y2="${f(DA.Y(0))}" class="skf" stroke-dasharray="10 3 2 3"/>`,
  `<line x1="${f(tL - 36)}" y1="${f(navLine)}" x2="${f(tL)}" y2="${f(navLine)}" class="sks"/>`,
  `<line x1="${f(tR)}" y1="${f(navLine)}" x2="${f(tR + 36)}" y2="${f(navLine)}" class="sks"/>`,
  tabPath(tL, tT, tw * 3, th * 3, V('R1') * 3, 'sk fp2'),
  rect(DA.X(tx + V('B') + V('S3')), DA.Y(ty + V('B') + V('S2')), (tw - 2 * (V('B') + V('S3'))) * 3, V('LH') * 3, 'skf fnone', DASH),
  txt((tL + tR) / 2, DA.Y(ty + th / 2) + 4, 'LABEL · HUG', 'lblf', 'middle'),
  dimH(P, tL, DA.X(tx + V('B') + V('S3')), 772, tT, tT, 'S3'),
  dimH(P, DA.X(tx + tw - V('B') - V('S3')), tR, 772, tT, tT, 'S3'),
  dimV(P, DA.Y(0), tT, AX - 20, null, null, 'S1', { side: 'l' }),
  dimV(P, DA.Y(ty + V('B')), DA.Y(ty + V('B') + V('S2')), tR + 22, tR, tR, 'S2', { side: 'r' }),
  dimV(P, DA.Y(ty + V('B') + V('S2')), DA.Y(ty + V('B') + V('S2') + V('LH')), tR + 22, tR, tR, 'LH', { side: 'r' }),
  dimV(P, DA.Y(ty + th - V('B') - V('S2')), DA.Y(ty + th - V('B')), tR + 22, tR, tR, 'S2', { side: 'r' }),
  dimV(P, tT, tB, tR + 62, tR, tR, 'H1', { side: 'r' }),
  rad(tR, tT, V('R1') * 3, 'tr', 'R1', 18),
  nb(AX - 26, 872, 4),
].join('\n');

// ---- detail B: the selected row, the active <a uiSref>, at 2 : 1 ------------------
const BX = 70, BY = 1000;
const DB = view(BX, BY, 2, [0, ROWR[1] - 6, LIST[2], ROWR[3] + 12]);
const [, ry, rw, rh] = ROWR;
const detailB = [
  txt(40, 952, 'DETAIL B — ONE ROW, THE ACTIVE <a uiSref> · SCALE 2 : 1', 'lblb'),
  DB.R(LIST, 'fp2'),
  `<line x1="${f(DB.X(0))}" y1="${f(DB.Y(ry - 6))}" x2="${f(DB.X(0))}" y2="${f(DB.Y(ry + rh + 6))}" class="sks"/>`,
  `<line x1="${f(DB.X(rw))}" y1="${f(DB.Y(ry - 6))}" x2="${f(DB.X(rw))}" y2="${f(DB.Y(ry + rh + 6))}" class="sks"/>`,
  ...MARKS(1280, 'li').slice(2).map((r) => DB.R(r, 'skf fnone')),
  DB.R(ROWR, 'ska fp'),
  DB.R([V('S8'), ry + V('S7'), rw - 2 * V('S8'), V('LR')], 'skf fnone', DASH),
  txt(DB.X(rw / 2), DB.Y(ry + rh / 2) + 4, 'LABEL SLOT · ROW FILLS THE LIST', 'lblf', 'middle'),
  dimH(P, DB.X(0), DB.X(V('S8')), 986, DB.Y(ry), DB.Y(ry), 'S8'),
  dimH(P, DB.X(0), DB.X(rw), 1078, DB.Y(ry + rh + 6), DB.Y(ry + rh + 6), 'W1', { below: true }),
  dimV(P, DB.Y(ry), DB.Y(ry + V('S7')), DB.X(rw) + 16, DB.X(rw), DB.X(rw), 'S7', { side: 'r' }),
  dimV(P, DB.Y(ry + V('S7')), DB.Y(ry + V('S7') + V('LR')), DB.X(rw) + 16, null, null, 'LR', { side: 'r' }),
  dimV(P, DB.Y(ry + rh - V('S7')), DB.Y(ry + rh), DB.X(rw) + 16, DB.X(rw), DB.X(rw), 'S7', { side: 'r' }),
  dimV(P, DB.Y(ry), DB.Y(ry + rh), DB.X(rw) + 52, DB.X(rw), DB.X(rw), 'H2', { side: 'r' }),
].join('\n');

// ---- detail C: the nested view's seam, at 2 : 1 --------------------------------
const CROP = [120, NAV[1] + NAV[3] - 6, 170, 120];
const DC = view(540, 800, 2, CROP);
const cBox = [540, 800, CROP[2] * 2, CROP[3] * 2];
const seamX = DC.X(LIST[2]);
const detailC = [
  txt(540, 742, 'DETAIL C — THE NESTED VIEW’S SEAM · SCALE 2 : 1', 'lblb'),
  rect(...cBox, 'skf fnone', ' stroke-dasharray="2 3"'),
  `<line x1="${f(cBox[0])}" y1="${f(DC.Y(NAV[1] + NAV[3]))}" x2="${f(cBox[0] + cBox[2])}" y2="${f(DC.Y(NAV[1] + NAV[3]))}" class="sks"/>`,
  DC.R(LIST, 'sk fp2'),
  ...MARKS(1280, 'li').slice(2).map((r) => DC.R(r, 'skf fnone')),
  ...MARKS(1280, 'newbtn').map((r) => DC.R(r, 'sk fp')),
  DC.R(ROWR, 'ska fp'),
  DC.R(DET, 'sk fnone'),
  DC.R(content, 'skf fnone', DASH),
  DC.R(NEST, 'ska fnone', SEAM),
  txt(DC.X(content[0]) + 70, DC.Y(content[1]) + 60, 'CONTENT SLOT', 'lblf', 'middle'),
  dimH(P, seamX, DC.X(content[0]), 786, DC.Y(content[1]), DC.Y(content[1]), 'S10'),
  dimV(P, DC.Y(DET[1]), DC.Y(content[1]), cBox[0] + cBox[2] + 14, DC.X(content[0]), null, 'S9', { side: 'r' }),
  dimV(P, DC.Y(LIST[1]), DC.Y(LIST[1] + V('S6')), cBox[0] - 14, cBox[0], cBox[0], 'S6', { side: 'l' }),
  leader(seamX, cBox[1] + cBox[3] + 10, seamX, cBox[1] + cBox[3] - 6),
  txt(seamX, cBox[1] + cBox[3] + 22, 'THE SEAM — LIST HUG | NESTED <ui-view> FLEX', 'lbls', 'middle'),
].join('\n');

// ---- the layer stack: window to link, flat with offsets ----------------------------
const LS = 0.1, SX = 940, SY = 975, DX = 14, DY = 12, LX = 1186;
const stack = D.layers.map((l, i) => {
  const [x, y, w, h] = l.rect;
  return { ...l, i, x: SX + i * DX + x * LS, y: SY - i * DY + y * LS, w: w * LS, h: h * LS };
});
let lastY = Infinity;
const stackLabels = stack.map((l) => {
  const y = Math.min(l.y + l.h + 3, lastY - 13);
  lastY = y;
  return leader(LX - 4, y - 3.5, l.x + l.w - 3, l.y + l.h - 2) + txt(LX, y, `${l.name} · depth ${l.depth}`, 'lbls');
});
const accentLayer = (l) => l.selector === SLOT('NEST').selector || l.selector === SLOT('ROW').selector;
const layerStack = [
  txt(930, 870, `LAYERS @${VW} — WINDOW TO LINK, FLAT WITH OFFSETS`, 'lblb'),
  ...stack.map((l) => rect(l.x, l.y, l.w, l.h, accentLayer(l) ? 'ska fp' : 'sk fp', l.selector === SLOT('NEST').selector ? SEAM : '')),
  ...stackLabels,
].join('\n');

const notes = [
  txt(30, 40, 'NOTES — UNLESS OTHERWISE SPECIFIED', 'lblb'),
  nb(36, 58, 1), txt(50, 62, 'slots, not content: every name and field is the app’s sample data, drawn as a slot', 'lbls'),
  nb(36, 76, 2), txt(50, 80, 'HUG is sized by its content · FLEX takes what the row leaves · FILL takes the parent’s width', 'lbls'),
  nb(36, 94, 3), txt(50, 98, `at ${VW2} the row wraps: the nested <ui-view> drops under the list and takes the full line`, 'lbls'),
  nb(36, 112, 4), txt(50, 116, 'tab padding S2 / S3 is bootstrap 3.3.7’s; every other spacing is the shared styles.css’s', 'lbls'),
  txt(30, 134, 'CSS px · codes, not numbers: the schedules under the plate carry every value, and derived ones as formulas', 'lblf'),
  txt(1400, 40, `BASIS — survey and declared rules: ${D.ref} @ ${D.sha}`, 'lblf', 'end'),
  txt(1400, 54, `measured: ${D.build.app} built at ${D.build.builtAt}, apps/ and packages/ identical to ${D.sha}`, 'lblf', 'end'),
  txt(1400, 68, `chromium at ${VW} × ${VH} and ${VW2} × ${VH2}, after document.fonts.ready · ${D.build.listPath} → ${D.build.detailPath}`, 'lblf', 'end'),
].join('\n');

const ARIA = `A dimensional drawing of the sample app's contacts page at ${D.build.detailPath}: a plan at ${VW} by ${VH} pixels with the nav as a full-width bar of hugging tabs, the named contacts view filling the page under it, the contact list hugging its rows at the left and the nested, unnamed view flexing beside it with the contact's content slot inset at its top; chained dimension codes run along the top and down both sides. A second plan shows the same page at ${VW2} wide, where the nav wraps to two rows and the nested view drops under the list at full width. Three details enlarge the active tab with its padding, one list row with the active link, and the seam between the list and the nested view; a layer stack at the lower right draws the page's layers from the window to the link, flat with offsets.`;

const svg = `<svg viewBox="0 0 1420 1110" role="img" aria-label="${ARIA}">
${defs(P)}
${notes}
${plan1280}
${plan390}
${detailA}
${detailB}
${detailC}
${layerStack}
</svg>`;

// ---- schedules: every code on the drawing ------------------------------------------
const SPACING = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'B', 'M1', 'R1', 'R2'];
const SIZE = ['VW', 'VH', 'VW2', 'VH2', 'LH', 'LR', 'H1', 'H2', 'H3', 'H5', 'H4', 'H6', 'H7', 'N', 'H8', 'H9', 'H10', 'T1', 'T2', 'W1', 'W2', 'W3', 'Y1'];
const line = (code) => {
  const r = ROW(code);
  return [code, r.variable, r.value, r.source, r.formula || r.declared || '—'];
};
const wh = (r) => `${f(r[2])} × ${f(r[3])}`;
const SCHEDULES = [
  schedule('SPACING — padding, margin, border, radius (px)', ['code', 'variable', 'value', 'source', 'declared'], SPACING.map(line)),
  schedule('SIZE — viewports, heights, widths, tops (px)', ['code', 'variable', 'value', 'source', 'formula / declared'], SIZE.map(line),
    'every formula closes on the page within half a pixel, or census-document.mjs stops'),
  schedule('SLOTS — HUG, FLEX, FILL read off the computed box', ['code', 'element', `@${VW}`, `@${VW2}`, `w × h @${VW}`, `w × h @${VW2}`],
    D.slots.map((s) => [s.code, s.element, s.word, s.wrapped ? `${s.word390}, wrapped` : s.word390, wh(s.at1280), wh(s.at390)])),
];
// every code lettered on the drawing is a row in a schedule
for (const [, code] of svg.matchAll(/class="lbld"[^>]*>([A-Z]+\d*)/g))
  if (![...SPACING, ...SIZE].includes(code)) throw new Error(`sheet 1A: ${code} is drawn and scheduled nowhere`);

// the homes the notes name: the shared stylesheet on main, bootstrap's own docs, the plate and its probe on www/atlas
const REPO = 'https://github.com/simshanith/lit-ui-router';
const HOME = {
  styles: `${REPO}/blob/main/apps/sample-app-shared/src/styles.css`,
  shared: `${REPO}/tree/main/apps/sample-app-shared`,
  bootstrap: 'https://getbootstrap.com/docs/3.3/',
  plate: `${REPO}/blob/www/atlas/www/atlas.lit-ui-router.dev/data/census-document.json`,
  probe: `${REPO}/blob/www/atlas/www/atlas.lit-ui-router.dev/generator/census-document.mjs`,
};

export const SHEET1A_VERDICT = `alternate plate — sheet 1's document at reading size: the sample app's contacts page measured in Chromium, ${V('N')} rows in a list that hugs W1 beside a nested view that flexes and wraps under it at ${VW2}, one geometry for all ${APPS} sample apps`;

export const sheet1a = {
  num: '1A', id: 'document', rev: 'A',
  title: 'THE DOCUMENT, DIMENSIONED',
  sub: `ALTITUDE 1 — ALTERNATE PLATE: sheet 1’s document at reading size — the sample app’s contacts page at ${D.build.detailPath}, measured in Chromium at ${VW} and ${VW2} wide and drawn as slots with chained codes, three details and the layer stack sheet 1 raises · rows read census-document.json @ ${D.sha}, measured on the vanilla build at ${D.build.builtAt}`,
  scale: 'ONE PAGE',
  form: 'DIMENSIONED PLAN',
  svg,
  schedules: SCHEDULES,
  caption: `The contacts page of the sample app, drawn the way a dimensional drawing draws a component: the shell's nav, the named view it fills, the list that hugs its rows and the nested view that flexes beside it, every distance a code. At ${VW2} the row wraps and the nested view drops under the list. The stack at the lower right is the page's layers from the window to the link, the plates sheet 1 raises.`,
  notes: `
<p><strong>Method.</strong> The page is the vanilla sample app's contacts state, <code>${D.build.listPath}</code> and then one contact at <code>${D.build.detailPath}</code>, served from its built <code>dist</code> and measured in headless Chromium at ${VW} × ${VH} and ${VW2} × ${VH2} after <code>document.fonts.ready</code> settles: <code>getBoundingClientRect</code> for every box, <code>getComputedStyle</code> for every padding, margin, border, radius and flex. The visualizer and the API docs are switched off, so the routed page stands alone. <a href="${HOME.probe}"><code>census-document.mjs</code></a> writes the readings to <a href="${HOME.plate}"><code>census-document.json</code></a>, reads each declared rule out of <a href="${HOME.styles}"><code>styles.css</code></a> at ${D.ref} @ ${D.sha}, and stops when a selector is missing or a formula misses the page by half a pixel. The build is this branch's at ${D.build.builtAt}, whose <code>apps/</code> and <code>packages/</code> match ${D.sha} file for file.</p>
<p><strong>One geometry for ${APPS} apps.</strong> The ${APPS} sample apps take their stylesheet and their pages from <a href="${HOME.shared}"><code>sample-app-shared</code></a>, and their ${D.css.of} built stylesheets are byte-identical (${D.css.bytes.toLocaleString('en-US')} bytes, sha-256 ${D.css.sha256}…). Each app writes its own shell, and the ${D.shells.of} shells carry the same markup: a nav of <code>uiSref</code> tabs and ${WORD[SHELL_VIEWS]} <code>&lt;ui-view&gt;</code> slots in <code>&lt;main&gt;</code>. The shared pages hold ${WORD[UIVIEWS]} more, the root view and the nested ones inside contacts and messages. The tab padding is <a href="${HOME.bootstrap}">Bootstrap 3.3.7</a>'s, which the apps load from a CDN; every other spacing on the plate is the shared stylesheet's.</p>
<p><strong>What the drawing says.</strong> Under the nav, the shell's named <code>&lt;ui-view name="contacts"&gt;</code> fills the page. Inside it the contact list carries no width of its own: it hugs its longest name at W1 = ${V('W1')} px at both widths, and its height is a sum, H6 = 2·S6 + H7 + LH + N·H2, over ${V('N')} rows. The nested <code>&lt;ui-view&gt;</code> is unnamed and flexes into the rest of the row, W2 = VW − W1; the contact's content sits inset in it by S9 and S10, and every link on the page — tab, row, action — carries <code>uiSref</code> and hugs its label. At ${VW2} the nav wraps to two rows, H4 = H1 + H3 − 2·M1 + B, and the list row wraps too: the nested view drops under the list and takes the full line, so the page grows to H10 below a fold at VH2.</p>
<p><strong>Sheet 1's plates are this page's layers.</strong> Sheet 1 raises its document as plates from the window to the link; the stack at the lower right is the same climb, measured: window, <code>body</code>, <code>#root</code>, <code>&lt;ui-router&gt;</code>, the root <code>&lt;ui-view&gt;</code>, the shell's named view, the nested view and the active row's link, each at its real rectangle and its depth in the DOM. A layer stack is honest here because the page really is layered. Sheet 1 letters its window <code>/people</code> with a named detail view; the sample app's own names are <code>contacts</code> for the view the shell fills and none for the nested one the detail lands in.</p>`,
  key: [
    keyRow('<line x1="4" y1="12" x2="44" y2="12" class="sks"/><path d="M4,12 l6,-2.5 v5 z M44,12 l-6,-2.5 v5 z" class="fis"/><text x="24" y="9" class="lbld" text-anchor="middle">S1</text>', 'a dimension, lettered with its code — the value is in the schedules'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="skf fnone" stroke-dasharray="4 3"/>', 'a slot: content drawn as a placeholder, never as copy'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="sk fp2"/>', 'a control or the list: the parts that hug'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="ska fnone" stroke-dasharray="7 4"/>', 'the nested <code>&lt;ui-view&gt;</code>, the one that flexes'),
    keyRow('<rect x="6" y="5" width="36" height="8" class="ska fp"/>', 'the active row’s <code>&lt;a uiSref&gt;</code>'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="sks fnone" stroke-dasharray="6 3"/>', 'the shell’s named <code>&lt;ui-view name="contacts"&gt;</code>'),
    keyRow(`<rect x="6" y="3" width="36" height="12" fill="url(#${P}-hx)"/><rect x="6" y="3" width="36" height="12" class="skf fnone"/>`, 'the body’s bottom padding, S11'),
    keyRow('<circle cx="24" cy="9" r="7" class="skf fnone" stroke-dasharray="6 3"/>', 'a detail circle — the panel drawn larger below the plans'),
    keyRow('<rect x="18" y="3" width="12" height="12" class="sk fp"/><text x="24" y="12.5" class="lbls" text-anchor="middle">1</text>', 'a boxed note number — the note of that number at the top left'),
  ].join('\n'),
};
