// Outside the cabinet: the atlas's own sheet chrome, measured in the built app at two widths and filed survey-, not census-.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './basis.mjs';
import { writeData } from './census-query.mjs';
import { APP_DIST, originOf, serveSet } from './plates.mjs';

const ATLAS = fileURLToPath(new URL('../', import.meta.url));
const DIST = join(ATLAS, APP_DIST);
const PAGE = '/sheet/7/';
const BARE_PAGE = '/plate/7/';
const WIDTHS = [1440, 390];
const DPR = 2;
const CHROME_SRC = readFileSync(new URL('./chrome.mjs', import.meta.url), 'utf8');
if (!existsSync(join(DIST, 'sheet'))) throw new Error(`survey-chrome: no ${APP_DIST}/sheet/ — run ship.mjs app first`);

// a code constant or a CSS declaration, read off chrome.mjs's own source
const fromSource = (re, what) => {
  const m = re.exec(CHROME_SRC);
  if (!m) throw new Error(`survey-chrome: chrome.mjs carries no ${what}`);
  return m[1];
};
const SCHEDULE_SPLIT = Number(fromSource(/const SCHEDULE_SPLIT = (\d+);/, 'SCHEDULE_SPLIT'));
const BODY_PAD = fromSource(/body \{[^}]*?padding: (clamp\([^;]+\));/, 'body padding clamp');
const TITLE_SIZE = fromSource(/\.sheet-title \{[^}]*?font-size: (clamp\([^;]+\));/, '.sheet-title size clamp');
const PLATE_CAP = fromSource(/--plate-cap: ([^;]+);/, '--plate-cap');
const NOTES_COLS = fromSource(/\.notes \{\s*column-count: ([^;]+);/, '.notes column-count');
const CAP_MAX = fromSource(/figcaption \{ max-width: (min\([^;]+\));/, 'figcaption max-width beside the key');
const STICKY_APP = (/--sticky-top: (\d+px);/.exec(readFileSync(new URL('../app/index.html', import.meta.url), 'utf8')) ?? [])[1];
if (!STICKY_APP) throw new Error('survey-chrome: app/index.html carries no --sticky-top');
// the frame's declared widths: chromium draws a 1.5px border at 1 CSS px at every device pixel ratio
const DECLARED = {
  B: fromSource(/\.sheet \{[^}]*?border: ([\d.]+)px solid/, '.sheet border'),
  B4: fromSource(/\.schedules \{[^}]*?border: ([\d.]+)px solid/, '.schedules border'),
  B5: fromSource(/figcaption \{[^}]*?border-inline-start: ([\d.]+)px solid/, 'figcaption rule'),
  B6: fromSource(/\.titleblock \{[^}]*?border: ([\d.]+)px solid/, '.titleblock border'),
};
const FILL_RAISE = fromSource(/\.plate > \.fill \{[^}]*?inset-block-end: (calc\([^;]+\));/, '.plate > .fill raise');

// every instance: each .sheet section on a routed sheet page or a bare plate, lanes and their notes sheets included
const countSheets = (dir) => readdirSync(join(DIST, dir)).filter((d) => existsSync(join(DIST, dir, d, 'index.html')))
  .map((d) => (readFileSync(join(DIST, dir, d, 'index.html'), 'utf8').match(/<section class="sheet[ "]/g) ?? []).length);
const routed = countSheets('sheet');
const bare = countSheets('plate');
if ([...routed, ...bare].some((n) => n < 1)) throw new Error('survey-chrome: a built page carries no .sheet section');
const sum = (a) => a.reduce((x, y) => x + y, 0);

// in the page: every box the chrome draws, read after fonts.ready; a missing selector is returned, not guessed
const MEASURE = () => {
  const q = (s) => document.querySelector(s);
  const need = ['.sheet', '.sheet-head', '.sheet-title', '.sheet-sub', '.plate', '.figure-wrap', '.figure-wrap svg', '.plate > .fill',
    '.schedules', '.schedule td', '.schedule th', 'figcaption', '.notes-grid', '.notes', '.notes p', '.keyblock', '.keyblock td', '.titleblock', '.titleblock > div', '.titleblock .chop'];
  const missing = need.filter((s) => !q(s));
  if (missing.length) return { missing };
  const cs = (s, pseudo) => getComputedStyle(q(s), pseudo);
  const px = (v) => Number.parseFloat(v);
  const r = (s) => q(s).getBoundingClientRect();
  const sheet = cs('.sheet'), before = cs('.sheet', '::before'), head = cs('.sheet-head');
  const plate = cs('.plate'), fillR = r('.plate > .fill'), plateR = r('.plate');
  const cap = cs('figcaption'), grid = cs('.notes-grid'), tb = cs('.titleblock'), cell = cs('.titleblock > div');
  return {
    sheetW: r('.sheet').width,
    B: px(sheet.borderTopWidth), inset: px(before.top), rule: px(before.borderTopWidth), pad: px(sheet.paddingTop),
    marginEnd: px(sheet.marginBottom),
    headH: r('.sheet-head').height, headPadT: px(head.paddingTop), headPadB: px(head.paddingBottom), headRule: px(head.borderBottomWidth), headGap: px(head.marginBottom),
    title: px(cs('.sheet-title').fontSize), titleGap: px(cs('.sheet-title').marginBottom),
    sub: px(cs('.sheet-sub').fontSize), subGap: px(cs('.sheet-sub').marginBottom),
    plateTop: px(plate.marginTop), plateBot: px(plate.marginBottom), plateW: plateR.width,
    svgW: r('.figure-wrap svg').width, svgMin: px(cs('.figure-wrap svg').minWidth), ar: Number(q('.plate').style.getPropertyValue('--plate-ar')),
    fillW: fillR.width, fillH: fillR.height, fillRaise: plateR.top - fillR.bottom, fillFont: px(cs('.plate > .fill').fontSize),
    td: px(cs('.schedule td').fontSize), th: px(cs('.schedule th').fontSize), schedBorder: px(cs('.schedules').borderTopWidth),
    capFont: px(cap.fontSize), capPad: px(cap.paddingLeft), capRule: px(cap.borderLeftWidth), capW: r('figcaption').width,
    cols: grid.gridTemplateColumns, gap: px(grid.columnGap), gridPad: px(grid.paddingTop), inset2: px(grid.getPropertyValue('--inset')),
    noteCols: Number(cs('.notes').columnCount) || 1, noteColGap: px(cs('.notes').columnGap), noteP: px(cs('.notes p').fontSize),
    keyW: r('.keyblock').width, keyTd: px(cs('.keyblock td').fontSize), keyPos: cs('.keyblock').position,
    tbW: r('.titleblock').width, tbCols: tb.gridTemplateColumns, tbCells: document.querySelectorAll('.titleblock > div').length, tbBorder: px(tb.borderTopWidth),
    cellPadX: px(cell.paddingLeft), cellPadT: px(cell.paddingTop), cellPadB: px(cell.paddingBottom),
    chop: r('.titleblock .chop').width,
    bodyPad: px(getComputedStyle(document.body).paddingLeft),
    stickyTop: px(getComputedStyle(document.body).getPropertyValue('--sticky-top')),
    docW: document.documentElement.scrollWidth, vw: innerWidth,
  };
};
const BARE = () => {
  if (!document.querySelector('.sheet')) return { missing: ['.sheet'] };
  const b = getComputedStyle(document.body);
  return { bodyPad: Number.parseFloat(b.paddingLeft), stickyTop: Number.parseFloat(b.getPropertyValue('--sticky-top')) };
};
const COVER = () => {
  const s = document.querySelector('.sheet');
  if (!s) return { missing: ['.sheet'] };
  const c = getComputedStyle(s), b = getComputedStyle(s, '::before');
  return { B: Number.parseFloat(c.borderTopWidth), inset: Number.parseFloat(b.top), pad: Number.parseFloat(c.paddingTop), docW: document.documentElement.scrollWidth, vw: innerWidth };
};

const { chromium } = createRequire(join(ROOT, 'tools/embed-heights/package.json'))('playwright');
const server = await serveSet(DIST);
const browser = await chromium.launch();
const at = {};
try {
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: DPR });
    const read = async (path, fn) => {
      await page.goto(`${originOf(server)}${path}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const m = await page.evaluate(fn);
      if (m.missing) throw new Error(`survey-chrome: ${path} at ${w} has no ${m.missing.join(', ')}`);
      return m;
    };
    at[w] = { sheet: await read(PAGE, MEASURE), cover: await read('/', COVER), bare: await read(BARE_PAGE, BARE) };
    Object.assign(at[w].sheet, { barePad: at[w].bare.bodyPad, bareSticky: at[w].bare.stickyTop });
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

// the cover's sheet is the same frame: a drift between it and the routed sheet is a finding, not a row
for (const w of WIDTHS) for (const k of ['B', 'inset', 'pad']) {
  if (at[w].cover[k] !== at[w].sheet[k]) throw new Error(`survey-chrome: the cover's ${k} is ${at[w].cover[k]} at ${w}, the sheet's ${at[w].sheet[k]}`);
}

const rows = [];
const fix = (v) => Math.round(v * 100) / 100;
const row = (code, name, value, unit, source, formula = null) => rows.push({ code, name, value: typeof value === 'number' ? fix(value) : value, unit, source, formula });
const both = (code, name, key, unit = 'px', formula = null) => {
  const [a, b] = WIDTHS.map((w) => at[w].sheet[key]);
  if (a === b) row(code, name, a, unit, `measured @${WIDTHS[0]} and @${WIDTHS[1]}`, formula);
  else for (const w of WIDTHS) row(code, name, at[w].sheet[key], unit, `measured @${w}`, formula);
};
const M = at[WIDTHS[0]].sheet;

// frame
row('B', 'sheet border, declared', Number(DECLARED.B), 'px', 'chrome.mjs');
both('B', 'sheet border, as chromium draws it', 'B');
both('B2', 'inner rule', 'rule');
both('S1', 'inner rule inset (::before)', 'inset');
row('S1R', 'inner rule offset from the outer edge', M.B + M.inset, 'px', 'derived', 'B + S1');
both('S2', 'sheet padding', 'pad');
row('S2C', 'clearance, inner rule to content', M.pad - M.inset - M.rule, 'px', 'derived', 'S2 − S1 − B2');
both('S3', 'sheet margin-block-end', 'marginEnd');
both('W', 'sheet width', 'sheetW');
// head
both('H1', 'sheet-head height', 'headH');
both('S4', 'sheet-head padding-block-start', 'headPadT');
both('S5', 'sheet-head padding-block-end', 'headPadB');
both('B3', 'sheet-head rule', 'headRule');
both('S6', 'sheet-head margin-block-end', 'headGap');
both('T1', 'sheet-title size', 'title', 'px', TITLE_SIZE);
both('S7', 'sheet-title margin-block-end', 'titleGap');
both('T2', 'sheet-sub size', 'sub');
both('S8', 'sheet-sub margin-block-end', 'subGap');
// plate
both('S9', 'plate margin-block-start', 'plateTop');
both('S10', 'plate margin-block-end', 'plateBot');
both('W1', 'plate width', 'plateW');
both('W2', 'drawing min-width', 'svgMin');
both('W3', 'drawing width', 'svgW', 'px', `max(W2, min(W1, ${PLATE_CAP} · AR))`);
both('AR', 'plate aspect ratio (--plate-ar, sheet 7)', 'ar', '');
row('CAP', 'plate height cap (--plate-cap)', PLATE_CAP, '', 'chrome.mjs');
both('Z1', 'fill button width · HUG', 'fillW');
both('Z2', 'fill button height', 'fillH');
both('S11', 'fill button raise above the plate', 'fillRaise', 'px', FILL_RAISE);
both('T3', 'fill button lettering', 'fillFont');
// schedule
both('T4', 'schedule cell size', 'td');
both('T5', 'schedule head size', 'th');
row('B4', 'schedule frame, declared', Number(DECLARED.B4), 'px', 'chrome.mjs');
both('B4', 'schedule frame, as chromium draws it', 'schedBorder');
row('N', 'schedule split (rows past N set two tables)', SCHEDULE_SPLIT, 'rows', 'chrome.mjs');
// caption
both('T6', 'figcaption size', 'capFont');
both('S12', 'figcaption padding-inline-start', 'capPad');
row('B5', 'figcaption rule, declared', Number(DECLARED.B5), 'px', 'chrome.mjs');
both('B5', 'figcaption rule, as chromium draws it', 'capRule');
both('W4', 'figcaption width', 'capW', 'px', `${CAP_MAX} past 1180 wide`);
// notes grid
both('G1', 'notes-grid columns', 'cols', '');
both('G2', 'notes-grid gap', 'gap');
both('S13', 'notes-grid padding-block-start', 'gridPad');
both('W5', 'key column (--inset)', 'inset2');
both('G3', 'notes column count', 'noteCols', '', NOTES_COLS);
both('G4', 'notes column gap', 'noteColGap');
both('T7', 'notes paragraph size', 'noteP');
// key and title block
both('W6', 'keyblock width', 'keyW');
both('T8', 'key row size', 'keyTd');
both('K', 'keyblock position', 'keyPos', '');
both('W7', 'title block width', 'tbW', 'px', 'min(460px, 100%)');
both('G5', 'title block columns', 'tbCols', '');
both('G6', 'title block cells', 'tbCells', 'cells');
row('B6', 'title block frame, declared', Number(DECLARED.B6), 'px', 'chrome.mjs');
both('B6', 'title block frame, as chromium draws it', 'tbBorder');
both('S14', 'title block cell padding-inline', 'cellPadX');
both('S15', 'title block cell padding-block-start', 'cellPadT');
both('Z3', 'chop', 'chop');
// page
both('P', 'body padding, bare plate', 'barePad', 'px', BODY_PAD);
both('P2', 'body padding, routed app', 'bodyPad');
both('ST', '--sticky-top, bare plate', 'bareSticky');
both('ST2', '--sticky-top, routed app (app/index.html)', 'stickyTop', 'px', `ST raised to ${STICKY_APP} for the utility bar`);

for (const w of WIDTHS) {
  const s = at[w].sheet;
  if (s.docW > s.vw) throw new Error(`survey-chrome: ${PAGE} scrolls sideways at ${w} (${s.docW} > ${s.vw})`);
}

const sha = execFileSync('git', ['-C', ROOT, 'rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8' }).trim();
const commitDate = execFileSync('git', ['-C', ROOT, 'show', '-s', '--format=%cI', 'HEAD'], { encoding: 'utf8' }).trim();
const ref = execFileSync('git', ['-C', ROOT, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
writeData('survey-chrome.json', {
  ref,
  sha,
  commitDate,
  generatedAtTime: new Date().toISOString(),
  wasGeneratedBy: 'www/atlas.lit-ui-router.dev/generator/survey-chrome.mjs',
  used: `${APP_DIST} built by ship.mjs app from the ${ref} tree @ ${sha}, served and read in chromium at ${WIDTHS.join(' and ')} wide, device pixel ratio ${DPR}, after fonts.ready`,
  wasAssociatedWith: ['playwright chromium', 'git'],
  page: PAGE,
  widths: WIDTHS,
  dpr: DPR,
  instances: { routedPages: routed.length, routed: sum(routed), barePages: bare.length, bare: sum(bare) },
  rows,
}, ['rows']);

for (const r of rows) console.log(r.code.padEnd(5), r.name.padEnd(46), String(r.value).padStart(12), (r.unit ?? '').padEnd(6), r.source, r.formula ? `= ${r.formula}` : '');
console.log(`survey-chrome.json: ${ref} @ ${sha} · ${rows.length} rows · ${sum(routed)} .sheet sections on ${routed.length} routed pages + ${sum(bare)} on ${bare.length} bare plates · cover frame agrees at ${WIDTHS.join(' and ')}`);
