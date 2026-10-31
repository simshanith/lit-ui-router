// Page probe behind sheet 1A: the sample app's contacts page, the document
// sheet 1 raises in plates, measured as a dimensional drawing. Two bases, both
// on the plate: the grep survey and the declared rules read a `git archive` of
// the cabinet's sha (basis.mjs); the box tree is measured in headless Chromium
// on the vanilla app's dist built in this worktree, which must hold the same
// apps/ and packages/ as that sha. Every selector the sheet draws must resolve,
// or the probe stops. Writes www/atlas.lit-ui-router.dev/data/census-document.json.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { ROOT, materialize, refFromArgv } from './basis.mjs';
import { loadCensus, writeData } from './census-query.mjs';

const CABINET = loadCensus();
// Default ref is the cabinet's sha, so this plate measures the tree its siblings measured.
const PINNED = !process.argv.slice(2).includes('--ref');
const basis = materialize(PINNED ? CABINET.sha : refFromArgv());
process.on('exit', () => basis.cleanup());

const APPS = ['vanilla', 'mobx', 'effect', 'signals'];
const DIST = { vanilla: 'dist/vanilla', mobx: 'dist', effect: 'dist', signals: 'dist' };
const stop = (msg) => { throw new Error(`census-document: ${msg}`); };

// ---- the survey: the ref's own source ----------------------------------------
const src = (rel) => readFileSync(join(basis.dir, rel), 'utf8');
const tsUnder = (prefix) => basis.files.filter((f) => f.startsWith(prefix) && /\.ts$/.test(f) && !/\.(spec|test|test-d)\.ts$/.test(f) && !f.endsWith('.d.ts'));
// comments name the tags too; only code counts
const code = (f) => src(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const count = (files, re) => files.map((f) => [f, (code(f).match(re) ?? []).length]).filter(([, n]) => n > 0);
const UIVIEW = /<ui-view[\s>]/g;
const UISREF = /\buiSref\(/g;

const survey = [];
const shared = count(tsUnder('apps/sample-app-shared/src/'), UIVIEW);
for (const [f, n] of shared) survey.push({ where: 'sample-app-shared', file: f, tag: '<ui-view>', n });
// the shell each app writes for itself: its markup skeleton, tag.class[name] in order
const skeleton = (rel) => [...src(rel).matchAll(/<(ui-view|div|main|nav|ul|li|a)\b([^>]*)>/g)]
  .map(([, tag, attrs]) => `${tag}${(/class="([^"$]*)"/.exec(attrs)?.[1] ?? '').split(/\s+/).filter(Boolean).map((c) => `.${c}`).join('')}${/name="([^"]+)"/.exec(attrs) ? `[${/name="([^"]+)"/.exec(attrs)[1]}]` : ''}`)
  .join(' ');
const shells = {};
for (const app of APPS) {
  const dir = `apps/sample-app-lit-${app}/src/`;
  const files = tsUnder(dir);
  if (!files.length) stop(`${dir} holds no source at ${basis.sha}`);
  for (const [f, n] of count(files, UIVIEW)) survey.push({ where: `sample-app-lit-${app}`, file: f, tag: '<ui-view>', n });
  for (const [f, n] of count(files, UISREF)) survey.push({ where: `sample-app-lit-${app}`, file: f, tag: 'uiSref(', n });
  shells[app] = ['main/App.ts', 'main/NavHeader.ts'].map((f) => {
    if (!basis.files.includes(`${dir}app/${f}`)) stop(`${dir}app/${f} missing at ${basis.sha}`);
    return skeleton(`${dir}app/${f}`);
  }).join(' | ');
}
for (const [f, n] of count(tsUnder('apps/sample-app-shared/src/'), UISREF)) survey.push({ where: 'sample-app-shared', file: f, tag: 'uiSref(', n });
const shellSame = APPS.filter((a) => shells[a] === shells.vanilla);
const STYLESHEETS = basis.files.filter((f) => /^apps\/sample-app-[^/]+\/src\/.*\.css$/.test(f));

// the declared rules the sheet cites, read out of the ref's stylesheet
const CSS = src('apps/sample-app-shared/src/styles.css');
const decl = (selector, prop) => {
  for (let at = CSS.indexOf(`\n${selector} {`); at !== -1; at = CSS.indexOf(`\n${selector} {`, at + 1)) {
    const v = new RegExp(`\\n\\s*${prop}:\\s*([^;]+);`).exec(CSS.slice(at, CSS.indexOf('}', at)))?.[1];
    if (v) return `styles.css ${selector} { ${prop}: ${v} }`;
  }
  return stop(`styles.css has no rule "${selector}" declaring ${prop}`);
};
const CONTACTS = 'apps/sample-app-shared/public/static/data/contacts.json';
if (!basis.files.includes(CONTACTS)) stop(`${CONTACTS} missing at ${basis.sha}`);
const contacts = JSON.parse(src(CONTACTS));

// ---- the build: this worktree's vanilla dist, checked against the sha ---------
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const HEAD = git('rev-parse', '--short', 'HEAD');
const drift = git('diff', '--name-only', basis.sha, 'HEAD', '--', 'apps', 'packages');
const dirty = git('status', '--porcelain', '--', 'apps', 'packages');
if (drift || dirty) stop(`the worktree's apps/ and packages/ differ from ${basis.sha}: ${drift || dirty}`);
const lastSrc = Number(git('log', '-1', '--format=%ct', 'HEAD', '--', 'apps', 'packages')) * 1000;
const cssOf = (app) => {
  const assets = join(ROOT, `apps/sample-app-lit-${app}`, DIST[app], 'assets');
  if (!existsSync(assets)) stop(`no build at ${assets} — run turbo run build --filter=sample-app-lit-${app}`);
  const css = readdirSync(assets).filter((f) => f.endsWith('.css'));
  if (css.length !== 1) stop(`${assets} holds ${css.length} stylesheets`);
  const file = join(assets, css[0]);
  if (statSync(file).mtimeMs < lastSrc) stop(`${file} predates the last apps/ commit — rebuild`);
  return { app, file: `apps/sample-app-lit-${app}/${DIST[app]}/assets/${css[0]}`, bytes: statSync(file).size, sha256: createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16) };
};
const builds = APPS.map(cssOf);
const cssSame = builds.filter((b) => b.sha256 === builds[0].sha256).length;

const SERVE = join(ROOT, 'apps/sample-app-lit-vanilla', DIST.vanilla);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer((req, res) => {
  let f = join(SERVE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(SERVE) || !existsSync(f) || statSync(f).isDirectory()) f = join(SERVE, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

// ---- the measurement ----------------------------------------------------------
const SEL = {
  body: 'body', root: '#root', router: 'ui-router', view: 'ui-router > div > ui-view', shell: 'sample-app',
  header: '.navheader', nav: 'ul.nav-tabs', tab: 'ul.nav-tabs > li.active > a', tabLi: 'ul.nav-tabs > li.active',
  right: 'ul.nav-tabs > li.navbar-right', btn: 'li.navbar-right > a.btn:not(.fa-home)', main: 'sample-app main',
  named: 'ui-view[name="contacts"]', list: 'sample-contact-list', ul: 'sample-contact-list ul.selectlist',
  newRow: 'sample-contact-list ul > li:first-child', spacer: 'sample-contact-list ul > li:nth-child(2)',
  row: 'sample-contact-list a.selected', nested: 'sample-contacts ui-view', detail: 'sample-contact-view .contact',
  act: 'sample-contact-view .contact a.btn',
};
const { chromium } = createRequire(join(ROOT, 'tools/embed-heights/package.json'))('playwright');
const browser = await chromium.launch();
const measure = async (width, height) => {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript(() => {
    sessionStorage.setItem('appConfig', JSON.stringify({ emailAddress: 'myself@angular.dev', sort: '+date', restDelay: 0 }));
    sessionStorage.setItem('featureFlags', JSON.stringify({ 'enable-visualizer': false, 'enable-api-docs': false }));
  });
  await page.goto(`${ORIGIN}/app/contacts`);
  await page.waitForSelector('sample-contact-list li:nth-child(3) a');
  await page.evaluate(() => document.fonts.ready);
  const listPath = new URL(page.url()).pathname;
  await page.click('sample-contact-list li:nth-child(3) a');
  await page.waitForSelector(SEL.detail);
  await page.evaluate(() => document.fonts.ready);
  const detailPath = new URL(page.url()).pathname;
  const boxes = await page.evaluate((sel) => {
    const out = {};
    for (const [k, s] of Object.entries(sel)) {
      const el = document.querySelector(s);
      if (!el) { out[k] = null; continue; }
      const r = el.getBoundingClientRect(), c = getComputedStyle(el);
      let depth = 0;
      for (let p = el; p.parentElement; p = p.parentElement) depth++;
      out[k] = { x: r.x, y: r.y, w: r.width, h: r.height, depth, display: c.display, flexGrow: Number(c.flexGrow), flex: c.flex,
        pt: parseFloat(c.paddingTop), pr: parseFloat(c.paddingRight), pb: parseFloat(c.paddingBottom), pl: parseFloat(c.paddingLeft),
        mt: parseFloat(c.marginTop), mb: parseFloat(c.marginBottom), bt: parseFloat(c.borderTopWidth), bb: parseFloat(c.borderBottomWidth),
        rad: parseFloat(c.borderTopLeftRadius), lh: parseFloat(c.lineHeight), fs: parseFloat(c.fontSize),
        minH: c.minHeight, maxW: c.maxWidth, pw: el.parentElement.getBoundingClientRect().width };
    }
    out.rows = document.querySelectorAll('sample-contact-list ul > li').length - 2;
    // the repeated marks the plan draws: every tab, button, row and action
    const MARKS = { tab: 'ul.nav-tabs > li:not(.navbar-right) > a', navbtn: 'li.navbar-right > a.btn', menu: 'sample-user-menu',
      li: 'sample-contact-list ul > li', newbtn: 'sample-contact-list li:first-child .btn', act: 'sample-contact-view .contact .btn' };
    out.marks = Object.entries(MARKS).flatMap(([role, s]) => [...document.querySelectorAll(s)].map((el) => {
      const r = el.getBoundingClientRect();
      return { role, rect: [r.x, r.y, r.width, r.height] };
    }));
    out.bootstrap = getComputedStyle(document.querySelector('ul.nav-tabs')).borderBottomStyle;
    return out;
  }, SEL);
  await page.close();
  for (const k of Object.keys(SEL)) if (!boxes[k]) stop(`@${width}: no element for ${k} (${SEL[k]})`);
  for (const [role, n] of [['tab', 3], ['navbtn', 2], ['menu', 1], ['newbtn', 1], ['act', 2]])
    if (boxes.marks.filter((m) => m.role === role).length !== n) stop(`@${width}: the plan draws ${n} ${role}, the page holds ${boxes.marks.filter((m) => m.role === role).length}`);
  if (boxes.bootstrap !== 'solid') stop(`@${width}: bootstrap 3.3.7 did not load (nav-tabs border ${boxes.bootstrap})`);
  return { width, height, listPath, detailPath, ...boxes };
};
const W = await measure(1280, 900);
const N = await measure(390, 844);
await browser.close();
server.close();
if (W.rows !== contacts.length) stop(`the list draws ${W.rows} rows, contacts.json holds ${contacts.length}`);

// ---- the rows -----------------------------------------------------------------
const r2 = (v) => Math.round(v * 100) / 100;
const rows = [];
const row = (code, variable, value, unit, source, declared = '', formula = '') => rows.push({ code, variable, value: r2(value), unit, source, declared, formula });
const BS = 'bootstrap 3.3.7';
const closes = (code, got, want) => { if (Math.abs(got - want) > 0.5) stop(`${code}: the formula gives ${r2(got)}, the page measures ${r2(want)}`); };
const M1 = 'measured @1280', M2 = 'measured @390';

row('VW', 'viewport width', W.width, 'px', 'viewport');
row('VH', 'viewport height', W.height, 'px', 'viewport');
row('VW2', 'phone viewport width', N.width, 'px', 'viewport');
row('VH2', 'phone viewport height', N.height, 'px', 'viewport');
row('S1', 'header margin', W.header.mt, 'px', M1, decl('.navheader', 'margin'));
row('S2', 'tab padding-block', W.tab.pt, 'px', M1, `${BS} .nav > li > a { padding: 10px 15px }`);
row('S3', 'tab padding-inline', W.tab.pl, 'px', M1, `${BS} .nav > li > a { padding: 10px 15px }`);
row('S4', 'nav button padding-block', W.btn.pt, 'px', M1, decl('.navheader .nav-tabs > li.navbar-right > a.btn', 'padding-block'));
row('S5', 'nav button padding-inline', W.btn.pl, 'px', M1, decl('.navheader .nav-tabs > li.navbar-right > a.btn', 'padding-inline'));
row('S6', 'list padding-block', W.ul.pt, 'px', M1, decl('.selectlist', 'padding-block'));
row('S7', 'row padding-block', W.row.pt, 'px', M1, decl('.selectlist a', 'padding-block'));
row('S8', 'row padding-inline', W.row.pl, 'px', M1, decl('.selectlist a', 'padding-inline'));
row('S9', 'detail padding-block', W.detail.pt, 'px', M1, decl('.contact', 'padding-block'));
row('S10', 'detail padding-inline', W.detail.pl, 'px', M1, decl('.contact', 'padding-inline'));
row('S11', 'body padding-block-end', W.body.pb, 'px', M1, decl('body', 'padding-block-end'));
row('B', 'tab border', W.tab.bt, 'px', M1, `${BS} .nav-tabs > li > a { border: 1px solid transparent }`);
row('M1', 'tab overlap', -W.tabLi.mb, 'px', M1, `${BS} .nav-tabs > li { margin-bottom: -1px }`);
row('R1', 'tab corner radius', W.tab.rad, 'px', M1, decl('.navheader .nav-tabs li a', 'border-start-start-radius'));
row('R2', 'nav button radius', W.btn.rad, 'px', M1, decl('.navheader .nav-tabs > li.navbar-right > a.btn', 'border-radius'));
row('LH', 'body line-height', W.tab.lh, 'px', M1, `${BS} body { line-height: 1.42857143 }`);
row('LR', 'row line-height', W.row.lh, 'px', M1, `${BS} body { line-height: 1.42857143 } at ${decl('.selectlist a', 'font-size')}`);
const H1 = 2 * W.tab.pt + W.tab.lh + 2 * W.tab.bt; closes('H1', H1, W.tab.h);
row('H1', 'tab height', W.tab.h, 'px', M1, '', `2·S2 + LH + 2·B = ${r2(H1)}`);
const H2 = 2 * W.row.pt + W.row.lh; closes('H2', H2, W.row.h);
row('H2', 'row height', W.row.h, 'px', M1, '', `2·S7 + LR = ${r2(H2)}`);
const H3 = 2 * W.btn.pt + W.btn.lh + 2 * W.btn.bt; closes('H3', H3, W.btn.h);
row('H3', 'nav button height', W.btn.h, 'px', M1, '', `2·S4 + LH + 2·B = ${r2(H3)}`);
const M = -W.tabLi.mb;
if (W.nav.bb !== W.tab.bt) stop(`the nav rule is ${W.nav.bb}, the tab border ${W.tab.bt}: B names one width`);
const H5 = W.tab.h - M + W.nav.bb; closes('H5', H5, W.nav.h);
row('H5', 'header height', W.nav.h, 'px', M1, '', `H1 − M1 + B = ${r2(H5)}`);
const H4 = W.tab.h + W.btn.h - 2 * M + W.nav.bb; closes('H4', H4, N.nav.h);
row('H4', 'header height, wrapped', N.nav.h, 'px', M2, '', `H1 + H3 − 2·M1 + B = ${r2(H4)}`);
row('T1', 'view top', W.main.y, 'px', M1, '', `S1 + H5 = ${r2(W.header.mt + W.nav.h)}`);
closes('T1', W.header.mt + W.nav.h, W.main.y);
row('T2', 'view top, wrapped', N.main.y, 'px', M2, '', `S1 + H4 = ${r2(N.header.mt + N.nav.h)}`);
closes('T2', N.header.mt + N.nav.h, N.main.y);
row('W1', 'list width', W.list.w, 'px', M1, 'HUG — flex: 0 1 auto, sized by its longest row');
if (Math.abs(W.list.w - N.list.w) > 0.01) stop(`the list hugs ${W.list.w} @1280 and ${N.list.w} @390`);
row('W2', 'nested view width', W.nested.w, 'px', M1, 'FLEX — .flex-h > * { flex: 1 1 }', `VW − W1 = ${r2(W.width - W.list.w)}`);
closes('W2', W.width - W.list.w, W.nested.w);
row('W3', 'nested view width, wrapped', N.nested.w, 'px', M2, 'the row wraps: .flex-h { flex-flow: row wrap }', `VW2 = ${N.width}`);
closes('W3', N.width, N.nested.w);
row('H7', 'button row height', W.newRow.h, 'px', M1);
row('N', 'contact rows', W.rows, 'rows', M1, `contacts.json · ${contacts.length} records`);
const H6 = 2 * W.ul.pt + W.newRow.h + W.spacer.h + W.rows * W.row.h; closes('H6', H6, W.list.h);
row('H6', 'list height', W.list.h, 'px', M1, '', `2·S6 + H7 + LH + N·H2 = ${r2(H6)}`);
row('H8', 'detail height', W.detail.h, 'px', M1, 'HUG — sized by the contact');
row('H9', 'root height', W.root.h, 'px', M1, '', `VH − S11 = ${r2(W.height - W.body.pb)}`);
closes('H9', W.height - W.body.pb, W.root.h);
row('Y1', 'detail top, wrapped', N.nested.y, 'px', M2, '', `T2 + H6 = ${r2(N.main.y + N.list.h)}`);
closes('Y1', N.main.y + N.list.h, N.nested.y);
if (Math.abs(N.detail.h - W.detail.h) > 0.5) stop(`the detail stands ${W.detail.h} @1280 and ${N.detail.h} @390: H8 names one height`);
row('H10', 'page height, wrapped', N.body.h, 'px', M2, '', `Y1 + H8 + S11 = ${r2(N.nested.y + N.detail.h + N.body.pb)}`);
closes('H10', N.nested.y + N.detail.h + N.body.pb, N.body.h);

// ---- the slots: HUG / FLEX / FILL read off the computed box -------------------
const word = (b) => (b.flexGrow > 0 ? 'FLEX' : Math.abs(b.w - b.pw) < 0.5 ? 'FILL' : 'HUG');
const SLOTS = [
  ['NAV', 'nav', 'ul.nav-tabs'], ['TAB', 'tab', '<a uiSref> tab'], ['BTN', 'btn', '<a uiSref> button'],
  ['VIEW', 'named', '<ui-view name="contacts">'], ['LIST', 'list', '<sample-contact-list>'],
  ['ROW', 'row', '<a uiSref> row'], ['NEST', 'nested', '<ui-view>, nested'], ['DETAIL', 'detail', '.contact'],
  ['ACT', 'act', '<a uiSref> action'],
];
const box = (b) => [r2(b.x), r2(b.y), r2(b.w), r2(b.h)];
const slots = SLOTS.map(([code, k, element]) => ({ code, element, selector: SEL[k], display: W[k].display, flex: W[k].flex,
  word: word(W[k]), at1280: box(W[k]), word390: word(N[k]), at390: box(N[k]), wrapped: Math.abs(N[k].y - W[k].y - (N.main.y - W.main.y)) > 0.5 }));

// ---- the layers: window → link, as sheet 1 raises them ---------------------------
const LAYERS = [['window', null], ['body', 'body'], ['#root', 'root'], ['<ui-router>', 'router'], ['<ui-view>', 'view'],
  ['<ui-view name="contacts">', 'named'], ['<ui-view>, nested', 'nested'], ['<a uiSref>', 'row']];
const layers = LAYERS.map(([name, k]) => (k ? { name, selector: SEL[k], depth: W[k].depth, rect: box(W[k]) } : { name, selector: 'viewport', depth: 0, rect: [0, 0, W.width, W.height] }));

for (const r of rows) console.log(r.code.padEnd(5), r.variable.padEnd(28), String(r.value).padStart(8), r.unit, '·', r.source, r.formula ? `· ${r.formula}` : '');
console.log('slots', slots.map((s) => `${s.code} ${s.word}/${s.word390}`).join(' · '));
console.log('css', builds.map((b) => `${b.app} ${b.sha256}`).join(' · '), `· ${cssSame}/${APPS.length} identical`);
console.log('shells identical', shellSame.join(', '));
console.log('pages', W.listPath, '→', W.detailPath);

writeData('census-document.json', {
  ref: PINNED ? CABINET.ref : basis.ref,
  sha: basis.sha,
  commitDate: basis.commitDate,
  generatedAtTime: new Date().toISOString(),
  wasGeneratedBy: 'www/atlas.lit-ui-router.dev/generator/census-document.mjs',
  used: `git archive ${PINNED ? CABINET.ref : basis.ref} @ ${basis.sha} (survey, declared rules) + chromium on apps/sample-app-lit-vanilla/${DIST.vanilla} built at ${HEAD} (apps/ and packages/ identical to ${basis.sha}), 1280×900 and 390×844, after document.fonts.ready`,
  wasAssociatedWith: ['playwright chromium (tools/embed-heights)', 'getBoundingClientRect', 'getComputedStyle', 'bootstrap 3.3.7 (CDN, as the app ships it)'],
  build: { app: 'sample-app-lit-vanilla', dir: `apps/sample-app-lit-vanilla/${DIST.vanilla}`, builtAt: HEAD, flags: 'visualizer off, api-docs off (sessionStorage featureFlags): the routed page alone', listPath: W.listPath, detailPath: W.detailPath },
  css: { identical: cssSame, of: APPS.length, sha256: builds[0].sha256, bytes: builds[0].bytes, sources: STYLESHEETS },
  shells: { identical: shellSame.length, of: APPS.length, skeleton: shells.vanilla },
  rows,
  slots,
  layers,
  marks: [W, N].flatMap((m) => m.marks.map(({ role, rect }) => ({ at: m.width, role, rect: rect.map(r2) }))),
  survey,
}, ['rows', 'slots', 'layers', 'marks', 'survey', 'css.sources']);
