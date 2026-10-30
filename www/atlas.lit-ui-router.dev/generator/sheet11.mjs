import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, isoBlock, isoPt, keyRow, npmUrl, schedule, leader } from './helpers.mjs';
import { assertPlots } from './iso-hidden.mjs';
import { COMPILE_TIME } from './sheet2.mjs';

const P = 's11';
const OX = 480, OY = 195;

// ---- census: every byte on this sheet comes from www/atlas.lit-ui-router.dev/data/census-doors.json ----
// The plate is the checked-in snapshot census-doors.mjs writes: every exported
// entry of every publishable package bundled ALONE with rolldown — minified,
// declared deps + peers external — the price a consumer pays at that door, and
// exactly the <pkg>-<label>-esm series the repo uploads to codecov.
// Sheet 10's plate supplies the one buyer's-receipt figure quoted in the notes.
const PLATE = JSON.parse(readFileSync(new URL('../data/census-doors.json', import.meta.url), 'utf8'));
const BUNDLE = JSON.parse(readFileSync(new URL('../data/census-bundle.json', import.meta.url), 'utf8'));
// what npm serves the ssr quarter under is read off the registry plate, and the
// repo's own version off census-files.json, never typed
const NPM = JSON.parse(readFileSync(new URL('../data/census-npm.json', import.meta.url), 'utf8'));
const FILES = JSON.parse(readFileSync(new URL('../data/census-files.json', import.meta.url), 'utf8'));
const vkey = (v) => { const [core, pre] = v.split('-'); return [...core.split('.').map(Number), pre ? 0 : 1]; };
const ahead = (a, b) => { const x = vkey(a), y = vkey(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
const SSR_NPM = NPM.rows.find((r) => r.name === 'lit-ui-router-ssr');
const SSR_REPO = FILES.members.find((m) => m.name === 'lit-ui-router-ssr')?.version;
if (!SSR_NPM || !SSR_REPO) throw new Error('sheet 11: census-npm.json or census-files.json has no lit-ui-router-ssr');
if (SSR_NPM.tags?.rc && ahead(SSR_NPM.tags.rc, SSR_NPM.version)) throw new Error('sheet 11: census-npm.json leads lit-ui-router-ssr with an rc, and the ssr paragraph says latest serves its newest work');
if (SSR_NPM.version !== SSR_REPO) throw new Error(`sheet 11: npm serves lit-ui-router-ssr ${SSR_NPM.version} under latest, and the ssr paragraph says that is the ref's ${SSR_REPO}`);
// the notes quote latest for every quarter, so no rc may lead one
const RC_LED = NPM.rows.filter((r) => r.tags?.rc && ahead(r.tags.rc, r.version) && PLATE.rows.some((d) => d.pkg === r.name));
if (RC_LED.length) throw new Error(`sheet 11: the notes quote latest for every quarter, but census-npm.json leads [${RC_LED.map((r) => r.name)}] with an rc`);
// what npm serves a quarter under latest, checked against the version its package.json carries at the ref
const latest = (name) => {
  const r = NPM.rows.find((x) => x.name === name);
  const repo = FILES.members.find((m) => m.name === name)?.version;
  if (!r || r.version !== repo) throw new Error(`sheet 11: npm serves ${name} ${r?.version} under latest, and the notes say that is the ref's ${repo}`);
  return r.version;
};
// a package's registry page; the name is checked against the registry plate first
const npmLink = (name, text = `<code>${name}</code>`) => {
  if (!NPM.rows.some((r) => r.name === name)) throw new Error(`census-npm.json: no row named ${name}`);
  return `<a href="${npmUrl(name)}">${text}</a>`;
};
// the homes the notes name beyond the registry
const HOME = {
  repo: 'https://github.com/simshanith/lit-ui-router',
  rolldown: 'https://rolldown.rs',
  codecov: 'https://docs.codecov.com/docs/javascript-bundle-analysis',
  hono: 'https://hono.dev',
  fetch: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API',
  vite: 'https://vite.dev',
  connect: 'https://github.com/senchalabs/connect',
  eslint: 'https://eslint.org',
  jsPlugins: 'https://oxc.rs/docs/guide/usage/linter/js-plugins.html',
};
const door = (pkg, name) => {
  const d = PLATE.rows.find((x) => x.pkg === pkg && x.door === name);
  if (!d) throw new Error(`census-doors.json: no ${pkg} door ${name}`);
  return d;
};
const group = (name) => {
  const g = BUNDLE.rows.find((x) => x.group === name);
  if (!g) throw new Error(`census-bundle.json: no row for group ${name}`);
  return g;
};
const BASIS = `counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.commitDate.slice(0, 10)})`;
const DOOR_N = PLATE.rows.length;
const PKG_N = new Set(PLATE.rows.map((r) => r.pkg)).size;

// Footprint ∝ √min bytes, height = gz bytes.
const SIDE = (m) => Math.max(12, 0.35 * Math.sqrt(m));
const HT = (gz) => Math.max(6, gz / 40);

// Manual drawing order — quarter by quarter, tall doors in back; badge numbers
// follow it, so it is kept by hand and the lint plugin's door sits last.
const ORDER = [
  ['lit-ui-router', '.'],
  ['lit-ui-router', './pure'],
  ['lit-ui-router', './register'],
  ['lit-ui-router', './ui-router.register'],
  ['lit-ui-router', './ui-view.register'],
  ['lit-ui-router', './context'],
  ['lit-ui-router-effect', '.'],
  ['lit-ui-router-mobx', '.'],
  ['lit-ui-router-signals', '.'],
  ['lit-ui-router-ssr', '.'],
  ['lit-ui-router-ssr', './client'],
  ['lit-ui-router-ssr', './register'],
  ['ui-router-navigation-location-plugin', '.'],
  ['ui-router-server', '.'],
  ['ui-router-server', './redirects'],
  ['ui-router-server', './matcher'],
  ['ui-router-server', './hono'],
  ['ui-router-server', './fetch'],
  ['ui-router-server', './vite'],
  ['ui-router-server', './connect'],
  ['ui-router-server', './simulate'],
  ['ui-router-server', './location'],
  ['ui-router-server', './url-config'],
  ['ui-router-server', './ssr'],
  ['ui-router-server', './ssr/client'],
  ['ui-router-server', './prerender'],
  ['ui-router-effect', '.'],
  ['ui-router-signals', '.'],
  ['ui-router-mobx', '.'],
  ['ui-router-registry', '.'],
  ['ui-router-registry', './effect'],
  ['ui-router-registry', './mobx'],
  ['ui-router-registry', './signals'],
  ['eslint-plugin-lit-ui-router', '.'],
];
// A door the plate carries but the drawing does not place is a build error.
if (ORDER.length !== DOOR_N) {
  throw new Error(`census-doors.json carries ${DOOR_N} doors; sheet 11 places ${ORDER.length}`);
}

// the registry's quarter, in the open ground north of the server storefront: its index door
// in back, the three adapter-typing doors stepping forward
const REG_X = 436, REG_Y = -260;
// Manual plan: one quarter per package, tall doors in back. [pkg + door → x, y]
const PLAN = {
  // set back from the plate's top edge: the bare door stands 234 px tall at this
  // ref and its badge left the viewBox from [30, 15], then from [26, 46], then at 240 px from [26, 74]
  'lit-ui-router|.': [26, 86],
  'lit-ui-router|./pure': [98, 45],
  'lit-ui-router|./register': [185, 60],
  'lit-ui-router|./ui-router.register': [252, 92],
  'lit-ui-router|./ui-view.register': [180, 140],
  'lit-ui-router|./context': [305, 105],
  // to the quarter's south edge: at [40, 365] its badge stood in the register note
  'lit-ui-router-effect|.': [46, 385],
  'lit-ui-router-mobx|.': [155, 310],
  // the signals binding west of the flagship's quarter, the renderer-free pair south-west under the mobx lettering
  'lit-ui-router-signals|.': [-140, 196],
  'ui-router-signals|.': [178, 494],
  'ui-router-effect|.': [208, 596],
  'ui-router-mobx|.': [345, 520],
  // three doors in the bridge quarter: the prerender index and client in back, the
  // served <ui-view> registration in front
  'lit-ui-router-ssr|.': [592, 262],
  'lit-ui-router-ssr|./client': [632, 262],
  'lit-ui-router-ssr|./register': [652, 300],
  'ui-router-navigation-location-plugin|.': [460, 370],
  'ui-router-server|.': [425, 15],
  'ui-router-server|./redirects': [495, 40],
  'ui-router-server|./matcher': [565, 70],
  'ui-router-server|./hono': [640, 95],
  'ui-router-server|./fetch': [445, 120],
  'ui-router-server|./vite': [510, 140],
  'ui-router-server|./connect': [575, 160],
  'ui-router-server|./simulate': [645, 180],
  'ui-router-server|./location': [690, 195],
  'ui-router-server|./url-config': [705, 60],
  // the renderer-free ssr pair on the quarter's east edge, between the url config and the location door
  'ui-router-server|./ssr': [690, 100],
  'ui-router-server|./ssr/client': [705, 140],
  // the prerender loop in back, east of the redirects and north of the matcher
  'ui-router-server|./prerender': [540, 4],
  // recentred in its quarter: the door grew 9.7 → 16.9 KB min at the 1.14.1 ref and
  // its old lot pushed the block's base through the quarter's south-east dashes
  'eslint-plugin-lit-ui-router|.': [320, 258],
  'ui-router-registry|.': [REG_X, REG_Y],
  'ui-router-registry|./effect': [REG_X + 40, REG_Y],
  'ui-router-registry|./mobx': [REG_X, REG_Y + 40],
  'ui-router-registry|./signals': [REG_X + 40, REG_Y + 40],
};

const all = ORDER.map(([pkg, name], i) => {
  const d = door(pkg, name);
  const [x, y] = PLAN[`${pkg}|${name}`];
  return { pkg, door: name, m: d.min, gz: d.gz, x, y, s: SIDE(d.min), h: HT(d.gz), n: i + 1 };
});
const at = (pkg, name) => all.find((r) => r.pkg === pkg && r.door === name);
// hand PLAN, data-driven sides: the quarters may not ship overlapped
assertPlots('sheet 11', all.map(({ n, pkg, door: entry, x, y, s }) => ({ n, name: `${pkg} ${entry}`, part: 'door', x, y, w: s, d: s })));

const bodies = all
  .slice()
  .sort((a, b) => (a.x + a.y + a.s) - (b.x + b.y + b.s))
  .map(({ pkg, x, y, s, h, n }) => {
    const accent = pkg === 'lit-ui-router';
    const blk = isoBlock(P, OX, OY, x, y, s, s, h, { capCls: accent ? 'fa' : 'fp' });
    const [bx, by] = isoPt(OX, OY, x + s / 2, y, h);
    return `${blk}
<circle cx="${bx.toFixed(1)}" cy="${(by - 14).toFixed(1)}" r="9" class="${accent ? 'ska fp' : 'sk fp'}"/>
${txt(bx.toFixed(1), (by - 10.6).toFixed(1), String(n), 'lbls', 'middle')}`;
  })
  .join('\n');

function quarter(x1, y1, x2, y2, label, lx, ly, anchor = 'start') {
  const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
    .map(([px, py]) => isoPt(OX, OY, px, py).map((v) => v.toFixed(1)).join(','))
    .join(' ');
  return `<polygon points="${pts}" class="skf fnone" stroke-dasharray="5 4"/>
${txt(lx, ly, label, 'lblf', anchor)}`;
}

const fmt = (v) => v.toLocaleString('en-US');
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'];
const word = (n) => { if (!WORD[n]) throw new Error(`sheet 11: no number word for ${n} — extend WORD`); return WORD[n]; };
const Cap = (w) => w[0].toUpperCase() + w.slice(1);
const listOf = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const doorsOf = (pkg) => `${word(PLATE.rows.filter((r) => r.pkg === pkg).length)} doors`;

// ---- the readings the callouts and prose quote, all derived from the plate ----
const FLAG = at('lit-ui-router', '.');
const PURE = at('lit-ui-router', './pure');
const UMB = at('lit-ui-router', './register');
const EL1 = at('lit-ui-router', './ui-router.register');
const EL2 = at('lit-ui-router', './ui-view.register');
const SRV = at('ui-router-server', '.');
const SIM = at('ui-router-server', './simulate');
const MOBX = at('lit-ui-router-mobx', '.');
const EFF = at('lit-ui-router-effect', '.');
const SSR = at('lit-ui-router-ssr', '.');
const SSR_CLIENT = at('lit-ui-router-ssr', './client');
const SSR_REG = at('lit-ui-router-ssr', './register');
const NAV = at('ui-router-navigation-location-plugin', '.');
const LINT = at('eslint-plugin-lit-ui-router', '.');
const REG = at('ui-router-registry', '.');
// the registry's doors: the notes price them as one empty emit, door for door
const REG_DOORS = all.filter((r) => r.pkg === 'ui-router-registry');
if (REG_DOORS.some((r) => r.m !== REG.m || r.gz !== REG.gz)) throw new Error(`sheet 11: the notes price the registry's ${REG_DOORS.length} doors alike, and the plate prices them [${REG_DOORS.map((r) => `${r.door} ${r.m}/${r.gz}`)}]`);
const REG_SUBS = REG_DOORS.filter((r) => r !== REG);
// the compile-time packages' doors: types and lint, loaded by a type checker or a lint host and never by a browser
const COMPILED = all.filter((r) => COMPILE_TIME.some((c) => c.name === r.pkg));
const COMPILED_PKGS = [...new Set(COMPILED.map((r) => r.pkg))];
if (COMPILED_PKGS.join() !== 'ui-router-registry,eslint-plugin-lit-ui-router') throw new Error(`sheet 11: the notes name the registry's door and the lint plugin's as the compile-time doors, and the sheet draws [${COMPILED.map((r) => `${r.pkg} ${r.door}`)}]`);
const REG_COST = FLAG.gz - PURE.gz;
const LINT_SHARE = Math.round((LINT.gz / FLAG.gz) * 100);
const ELEM_SUM = EL1.gz + EL2.gz;
// the register callout's leader lands mid-height on the umbrella door's +x face
const UMB_FACE = isoPt(OX, OY, UMB.x + UMB.s, UMB.y + UMB.s / 2, UMB.h / 2);
// the footnote paragraph's two comparisons, checked against the plate
const ELEM_GAP = ELEM_SUM - UMB.gz;
if (!(MOBX.gz < ELEM_GAP && NAV.gz < ELEM_GAP)) throw new Error('sheet 11: the notes price mobx and the plugin under the ./register element-door gap, and the plate does not');
if (!(EFF.gz < FLAG.gz / 2 && SSR.gz < FLAG.gz / 2)) throw new Error('sheet 11: the notes price the effect and ssr index doors under half the flagship door, and the plate does not');
const SIG = at('lit-ui-router-signals', '.');
const USG = at('ui-router-signals', '.');
const UEF = at('ui-router-effect', '.');
const UMX = at('ui-router-mobx', '.');
if (![SIG, USG, UEF, UMX].every((d) => d.gz < ELEM_GAP)) throw new Error('sheet 11: the notes price the four one-door quarters under the ./register element-door gap, and the plate does not');
// the notes tell every quarter once: the flagship, the storefront, a pair, the lone four, the plugins, the compile-time doors
const TOLD = {
  flagship: ['lit-ui-router'], storefront: ['ui-router-server'], pair: ['lit-ui-router-effect', 'lit-ui-router-ssr'],
  alone: ['lit-ui-router-signals', 'ui-router-signals', 'ui-router-effect', 'ui-router-mobx'], plugins: ['lit-ui-router-mobx', 'ui-router-navigation-location-plugin'],
  compiled: COMPILED_PKGS,
};
{
  const told = Object.values(TOLD).flat().sort(), quarters = [...new Set(all.map((r) => r.pkg))].sort();
  if (told.join() !== quarters.join()) throw new Error(`sheet 11: the notes tell the quarters [${told}], and the sheet draws [${quarters}]`);
}
const SRV_GAP = FLAG.gz - SRV.gz;
const ADAPTERS = ['./hono', './fetch', './vite', './connect'].map((d) => at('ui-router-server', d));
const ADAPTER_SPREAD = Math.max(...ADAPTERS.map((a) => a.gz)) - Math.min(...ADAPTERS.map((a) => a.gz));
const RECEIPT = group('lit-ui-router').estGz;
// the cheapest door, and the cheapest a browser opens, read off the plate rather than named in prose
const cheapestOf = (rows) => rows.reduce((a, r) => (r.gz < a.gz ? r : a));
const CHEAPEST = all.find((r) => r === cheapestOf(all));
const CHEAPEST_RUN = cheapestOf(all.filter((r) => !COMPILED.includes(r)));
const EMPTY = (r) => (r.m === 0 ? ', an empty emit' : '');
// the registry paragraph calls its door the plate's cheapest and its lot the sheet's smallest
if (REG !== CHEAPEST || REG.s > Math.min(...all.map((r) => r.s)) || REG.h > Math.min(...all.map((r) => r.h))) throw new Error(`sheet 11: the notes draw the registry's door as the cheapest, at the smallest lot, and the plate's cheapest is ${CHEAPEST.pkg} ${CHEAPEST.door}`);
// the storefront's doors under 1,000 gz, priciest first; the paragraph calls the last the cheapest door a browser opens
const SRV_DOORS = all.filter((r) => r.pkg === 'ui-router-server');
const SMALL = SRV_DOORS.filter((r) => r.gz < 1000).sort((a, b) => b.gz - a.gz);
if (SMALL.length < 2 || SMALL.at(-1) !== CHEAPEST_RUN) throw new Error(`sheet 11: the storefront paragraph ends its small doors on the cheapest door a browser opens, and the plate's is ${CHEAPEST_RUN.pkg} ${CHEAPEST_RUN.door}`);
const SMALL_TAIL = CHEAPEST === CHEAPEST_RUN ? 'the last the cheapest door on the sheet' : `the last the cheapest door a browser opens — only ${CHEAPEST.pkg}’s, at ${CHEAPEST.gz}${EMPTY(CHEAPEST)}, undercuts it`;
const NO_BROWSER = `${listOf(COMPILED_PKGS.map((p) => `${p === REG.pkg ? 'the registry' : 'the lint plugin'}’s`))}`;
// the cover index's fit verdict, told from the plate's own prices
export const SHEET11_VERDICT = `the split view — ${DOOR_N} doors priced alone across ${PKG_N} quarters; the cheapest is ${CHEAPEST.pkg} «${CHEAPEST.door}» at ${CHEAPEST.gz} b${EMPTY(CHEAPEST)}, and ${NO_BROWSER} are the ${word(COMPILED.length)} doors no browser opens`;

const NOTE = {
  'lit-ui-router|.': 'the flagship door',
  'lit-ui-router|./pure': `${REG_COST} gz cheaper — registration off`,
  'lit-ui-router|./register': 'the umbrella — shared core once',
  'lit-ui-router|./ui-router.register': 'one element',
  'lit-ui-router|./ui-view.register': 'one element',
  'lit-ui-router|./context': 'the context seam, split out',
  'lit-ui-router-effect|.': 'the whole effect layer',
  'lit-ui-router-mobx|.': 'the Lit binding over the mobx store',
  'lit-ui-router-signals|.': 'the Lit binding over the signals',
  'ui-router-signals|.': 'route signals, no renderer',
  'ui-router-mobx|.': 'the observable store, no renderer',
  'ui-router-effect|.': 'one route ref, no renderer',
  'lit-ui-router-ssr|.': 'the prerender bridge',
  'lit-ui-router-ssr|./client': 'the browser half — hydrateRoot',
  'lit-ui-router-ssr|./register': 'the served <ui-view>, registered',
  'ui-router-navigation-location-plugin|.': 'the whole plugin',
  'ui-router-server|.': `${SRV_GAP} gz shy of the flagship`,
  'ui-router-server|./redirects': 'redirect machinery',
  'ui-router-server|./matcher': 'standalone matcher',
  'ui-router-server|./hono': 'adapter',
  'ui-router-server|./fetch': 'adapter',
  'ui-router-server|./vite': 'adapter',
  'ui-router-server|./connect': 'adapter',
  'ui-router-server|./simulate': `the headless-router recipe the pool builds — ${SIM.gz} b`,
  'ui-router-server|./location': 'the server location service',
  'ui-router-server|./url-config': 'the mount\'s url config, shared with any router',
  'ui-router-server|./ssr': 'settle and dehydrate, for any renderer',
  'ui-router-server|./ssr/client': 'seed the boot transition, for any renderer',
  'ui-router-server|./prerender': 'the prerender loop — a static site from a mount table, no renderer',
  'ui-router-registry|.': 'an empty emit, types only',
  'ui-router-registry|./effect': 'the effect adapter types, empty emit',
  'ui-router-registry|./mobx': 'the mobx adapter types, empty emit',
  'ui-router-registry|./signals': 'the signals adapter types, empty emit',
  'eslint-plugin-lit-ui-router|.': 'the lint plugin — editor-side, never shipped',
};
for (const r of all) if (!NOTE[`${r.pkg}|${r.door}`]) throw new Error(`sheet 11: door ${r.n}, ${r.pkg} ${r.door}, has no NOTE`);
const SCHEDULE = schedule(
  'STRUCTURE SCHEDULE — minified bytes → gzipped bytes, deps external · note',
  ['#', 'package', 'door', 'minified', 'gzipped', 'note'],
  all.map((r) => [r.n, r.pkg, r.door, r.m, r.gz, NOTE[`${r.pkg}|${r.door}`]]),
);
// the ssr quarter's label is the plate's lowest lettering
const VB_H = 740;
// leaders land on the door each callout names: the server's index tower and the lint plugin's door, mid-face
const SRV_FACE = isoPt(OX, OY, SRV.x + SRV.s, SRV.y + SRV.s / 2, SRV.h * 0.7);
const LINT_FACE = isoPt(OX, OY, LINT.x + LINT.s / 2, LINT.y + LINT.s, LINT.h * 0.15);
const HONO = at('ui-router-server', './hono');
const HONO_FACE = isoPt(OX, OY, HONO.x + HONO.s, HONO.y + HONO.s / 2, HONO.h / 2);

const svg = `<svg viewBox="0 0 1160 ${VB_H}" role="img" aria-label="Every exported entry of the ${PKG_N} publishable packages drawn as an isometric city split into ${PKG_N} package quarters: ${DOOR_N} door-buildings, footprint from minified bytes, height from gzipped bytes with dependencies external. The lit-ui-router quarter shows twin flagship towers for the bare and pure entries plus three register doors and a low context door; the ui-router-server quarter is a ${word(SRV_DOORS.length)}-door storefront whose index tower prices ${SRV_GAP} gzipped bytes under lit-ui-router's; the effect, mobx and signals companions, the navigation-location plugin, ui-router-effect, ui-router-signals and ui-router-mobx stand alone as small one-door quarters; the ssr bridge between the client and server quarters holds three doors, its index, its client half and its register entry; a one-door quarter in the lower middle holds eslint-plugin-lit-ui-router, and a ${word(REG_DOORS.length)}-door quarter in the open ground north of the server storefront holds ui-router-registry, whose doors are empty emits drawn at the sheet's smallest lot; those ${word(COMPILED.length)} doors are the only ones on the sheet no browser ever loads. A schedule below the drawing lists every entry with exact byte counts.">
${defs(P)}

${quarter(20, 0, 330, 200, `lit-ui-router — ${doorsOf('lit-ui-router')}`, 628, 222)}
${quarter(410, 0, 730, 210, `ui-router-server — ${doorsOf('ui-router-server')}`, 1150, 430, 'end')}
${quarter(0, 345, 110, 415, 'lit-ui-router-effect', 176, 445, 'end')}
${quarter(120, 290, 260, 380, 'lit-ui-router-mobx', 240, 478, 'end')}
${quarter(290, 240, 400, 320, 'eslint-plugin-lit-ui-router', 450, 528, 'end')}
${quarter(420, 350, 570, 440, 'navigation-location-plugin', 455, 700)}
${quarter(580, 250, 700, 335, `lit-ui-router-ssr — ${doorsOf('lit-ui-router-ssr')}`, 694, 716)}
${quarter(-170, 170, -90, 240, 'lit-ui-router-signals', 125, 288)}
${quarter(150, 470, 220, 530, 'ui-router-signals', 145, 540, 'end')}
${quarter(180, 570, 250, 630, 'ui-router-effect', 210, 614)}
${quarter(325, 500, 380, 550, 'ui-router-mobx', 384, 650)}
${quarter(424, -272, 502, -194, 'ui-router-registry', 1083, 366, 'middle')}

${bodies}

<!-- a callout's lines stand 14 apart: at 12 they touch -->
${txt(150, 96, `«.» and «./pure»: ${REG_COST} bytes gz apart —`, 'lbla')}
${txt(150, 110, 'the price of registration', 'lbla')}
${leader(368, 102, 452, 128)}
${txt(1120, 108, `the two flagship doors: ${fmt(FLAG.gz)} · ${fmt(SRV.gz)} —`, 'lbl', 'end')}
${txt(1120, 122, `the client door leads the server by ${fmt(SRV_GAP)}`, 'lbl', 'end')}
${leader(960, 128, ...SRV_FACE)}
${txt(628, 238, 'the one-element doors sum to', 'lbls')}
${txt(628, 252, `${fmt(ELEM_SUM)} gz — «./register» ships`, 'lbls')}
${txt(628, 266, `the shared core once, at ${fmt(UMB.gz)}`, 'lbls')}
${leader(624, 240, ...UMB_FACE)}
${txt(250, 560, `the lint plugin's door, ${fmt(LINT.gz)} gz, and the`, 'lbls')}
${txt(250, 574, `registry's ${word(REG_DOORS.length)}: the ${word(COMPILED.length)} no browser ever opens`, 'lbls')}
${leader(456, 556, ...LINT_FACE)}
${txt(1120, 695, `four adapters within ${ADAPTER_SPREAD} bytes of one`, 'lbla', 'end')}
${txt(1120, 709, 'another — thin skins on one server core', 'lbla', 'end')}
${leader(1000, 684, ...HONO_FACE)}

${txt(1120, 26, 'SCALE — 1 px of height ≈ 40 gz bytes', 'lbls', 'end')}
<!-- the recipe outgrew one line and ran across the tallest door's cap: it reads
     as its own stages instead, each hung on the plate's right margin -->
${PLATE.used.split(' + ').map((stage, i) => txt(1120, 40 + i * 14, i ? `+ ${stage}` : `PROBE — ${stage}`, 'lblf', 'end')).join('\n')}
</svg>`;

export const sheet11 = {
  num: 11, id: 'entries', rev: 'M',
  title: 'THE ENTRY QUARTERS',
  sub: `ALTITUDE 2⅞ — the same wire, cut by published package · every exported entry priced alone · ${DOOR_N} doors in ${PKG_N} package quarters, footprint from minified bytes and height from gzipped, dependencies external — ${BASIS}`,
  scale: `${word(PKG_N).toUpperCase()} PACKAGES`,
  form: 'ENTRY QUARTERS',
  svg,
  schedule: SCHEDULE,
  caption: `The split view to sheet 10’s unified city: every exported entry of every publishable package bundled alone and priced — ${PKG_N} package quarters, ${DOOR_N} doors, the codecov bundle-analysis series drawn as skylines.`,
  notes: `
<p><strong>Method:</strong> the same probe as sheet 10's doors strip, run to completion: every exported entry of the ${PKG_N} publishable packages bundled alone with <a href="${HOME.rolldown}">rolldown</a> — minified, declared dependencies and peers external — which is the price a consumer's bundler pays at that door, and byte-for-byte the <code>&lt;pkg&gt;-&lt;label&gt;-esm</code> series CI uploads to <a href="${HOME.codecov}">codecov</a>. Footprint is minified bytes, height gzipped. Every number is read at build time from the checked-in plate <code>www/atlas.lit-ui-router.dev/data/census-doors.json</code> — ${BASIS}, probed as <code>${PLATE.used}</code> — and a door the plate carries that the drawing does not place is a build error, not a stale constant. Sheet 10 is the unified view — one real app's bundle with all of these mixed by the bundler; this sheet cuts the same machinery by published package and entry point. The quarters don't sum and shouldn't: doors overlap (<code>./pure</code> is <code>.</code> minus registration), which is exactly what the split view exists to show.</p>
<p><strong>The twin towers are one building with two doors.</strong> <code>.</code> and <code>./pure</code> differ by ${REG_COST} gzipped bytes — the whole cost of custom-element registration. The register economics run the other way: the two one-element doors sum to ${fmt(ELEM_SUM)} gz while the umbrella <code>./register</code> is ${fmt(UMB.gz)}, because each element door carries the shared element core with it. Take the umbrella or one element door; taking two per-element doors ships the core twice.</p>
<p><strong>The server is a storefront, not a tower.</strong> ${word(SRV_DOORS.length).replace(/^./, (c) => c.toUpperCase())} doors: an index at ${fmt(SRV.gz)} gz, ${fmt(SRV_GAP)} under the client flagship; redirect and matcher wings at ${fmt(at('ui-router-server', './redirects').gz)} and ${fmt(at('ui-router-server', './matcher').gz)}; four framework adapters — <a href="${HOME.hono}">hono</a>, <a href="${HOME.fetch}">fetch</a>, <a href="${HOME.vite}">vite</a>, <a href="${HOME.connect}">connect</a> — packed within ${ADAPTER_SPREAD} bytes of one another, which is what thin skins over one core look like priced; and ${word(SMALL.length)} doors that barely register, ${SMALL.map((d, i) => `${i === SMALL.length - 1 ? 'and ' : ''}<code>${d.door}</code> at ${d.gz}${i ? '' : ' bytes'}`).join(SMALL.length > 2 ? ', ' : ' ')}, ${SMALL_TAIL}.</p>
<p><strong>${Cap(word(TOLD.pair.length))} more quarters, and one of them sits between the other two.</strong> ${npmLink('lit-ui-router-effect')} enters at ${fmt(EFF.gz)} gz through its one door. ${npmLink('lit-ui-router-ssr')} has three: the prerender index at ${fmt(SSR.gz)} gz, <code>./client</code> — the browser half that adopts a served render — at ${fmt(SSR_CLIENT.gz)}, and <code>./register</code>, which defines <code>&lt;ui-router&gt;</code> and a served <code>&lt;ui-view&gt;</code> in place of <code>lit-ui-router/register</code>, at ${fmt(SSR_REG.gz)}. The ssr quarter is drawn in the gap between the client and server quarters because that is where its declarations put it: it is the one package here that peers both ${npmLink('lit-ui-router')} and ${npmLink('ui-router-server')} (sheet 4 draws that bridge). npm serves it under <code>latest</code> at <code>${SSR_NPM.version}</code>, the version its <a href="${HOME.repo}/blob/main/packages/lit-ui-router-ssr/package.json"><code>package.json</code></a> carries at this ref.</p>
<p><strong>${Cap(word(TOLD.alone.length))} more one-door quarters, the signals pair, the renderer-free effect ref and the mobx store.</strong> ${npmLink('lit-ui-router-signals')} binds the router to a Lit host at ${fmt(SIG.gz)} gz; ${npmLink('ui-router-signals')}, ${npmLink('ui-router-effect')} and ${npmLink('ui-router-mobx')}, the renderer-free halves that hold one hook per router, enter at ${fmt(USG.gz)}, ${fmt(UEF.gz)} and ${fmt(UMX.gz)} — each under the ${fmt(ELEM_GAP)}-byte element-door gap. npm serves them under <code>latest</code> at <code>${latest('lit-ui-router-signals')}</code>, <code>${latest('ui-router-signals')}</code>, <code>${latest('ui-router-effect')}</code> and <code>${latest('ui-router-mobx')}</code>, the versions their <code>package.json</code> files carry at this ref.</p>
<p><strong>Plugins price like footnotes.</strong> The ${npmLink('lit-ui-router-mobx', 'mobx Lit binding')} enters at ${fmt(MOBX.gz)} gz and its store at ${fmt(UMX.gz)}, the ${npmLink('ui-router-navigation-location-plugin', 'navigation-location plugin')} at ${fmt(NAV.gz)} — each cheaper than the ${fmt(ELEM_GAP)}-byte gap between <code>./register</code> and its two element doors — and the effect and ssr index doors (${fmt(EFF.gz)} and ${fmt(SSR.gz)}) each cost under half the flagship's own <code>.</code> door at ${fmt(FLAG.gz)}. The expensive thing in this family is never the adapter; it is the state machine they all defer to, and that machine (sheet 10's ${npmLink('@uirouter/core')}) is external here by design.</p>
<p><strong>Door ${LINT.n} is not a door a browser opens.</strong> ${npmLink('eslint-plugin-lit-ui-router')} (<a href="${HOME.repo}/issues/676">#676</a>) is one of the family's ${word(COMPILED_PKGS.length)} non-runtime published packages, so its quarter is drawn but its number means something different: ${fmt(LINT.m)} minified, ${fmt(LINT.gz)} gz is what a <em>lint host</em> loads, once, at author time. It is priced here because the probe prices every published entry without exception — the honest thing for a ledger — and it is worth knowing that the plugin costs ${LINT_SHARE}% of the flagship to a tool that already has Node's whole module graph resident. Nothing in it ever reaches a bundle: it peers <a href="${HOME.eslint}">ESLint</a> alone — oxlint loads it as a <a href="${HOME.jsPlugins}">JS plugin</a>, unpeered — never ${npmLink('@uirouter/core')} (sheet 2 leaves it off the plate for the same reason).</p>
<p><strong>Doors ${REG.n}–${REG_DOORS.at(-1).n} are empty emits.</strong> ${npmLink('ui-router-registry')} ships types and nothing else: an app fills in its <code>Register</code> interface by module augmentation, and <code>StateName</code>, <code>ParamsOf</code> and the typed <code>StateService</code> narrow to that app's states inside the type checker. Its index door and the ${word(REG_SUBS.length)} adapter doors, ${listOf(REG_SUBS.map((r) => `<code>${r.door}</code>`))}, which type the route state the ${listOf(REG_SUBS.map((r) => npmLink(`ui-router-${r.door.slice(2)}`)))} hooks hand back, each bundle to ${fmt(REG.m)} minified bytes and ${fmt(REG.gz)} gz — gzip's framing around nothing — so the floors draw them at the sheet's smallest lot, ${fmt(+REG.s.toFixed(1))} × ${fmt(+REG.s.toFixed(1))} × ${fmt(+REG.h.toFixed(1))}, and the index is the cheapest door on the plate. npm serves it under <code>latest</code> at <code>${latest('ui-router-registry')}</code>; it peers ${npmLink('@uirouter/core')} for the declarations it narrows, and no bundle carries a byte of it.</p>
<p><strong>Why both views exist.</strong> The split view is the seller's ledger — what each door costs at the threshold. The unified view is the buyer's receipt — what one app's bundler actually made of them (it paid ${fmt(RECEIPT)} of the flagship's ${fmt(FLAG.gz)}). <a href="${HOME.codecov}">Codecov</a> tracks the ledger per commit; sheet 10 audits the receipt.</p>`,
  key: [
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp"/>', 'exported entry — height = gz, deps external'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fa"/>', 'a lit-ui-router door'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', `quarter = one published package · ${DOOR_N} doors, ${PKG_N} packages`),
  ].join('\n'),
};
