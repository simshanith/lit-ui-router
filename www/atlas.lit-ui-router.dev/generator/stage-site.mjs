// Stage the atlas for static hosting. Run from www/atlas.lit-ui-router.dev/:
//   node generator/stage-site.mjs
//
// The routed app is the site: dist/ IS app/dist (the prerendered pages,
// assets, manifest.json, the sheets/ fragments, 404.html and the app's own
// _redirects). The standalone pages build.mjs writes under tmp/flat/ are a
// build product the frame audit and the thumbs read; none is staged.
//
// _redirects, merged at the root (Cloudflare Pages reads only that one):
//   the app's own lines (prerender.ts: /office, the lowercase sheet ids)
//   /<page>, /<page>.html, /set/<page>, /set/<page>.html → /plate/<num>  301
//     for every page under tmp/flat/ and every filename `retired` names: the
//     bare plate the prerender writes from the same route table (app/prerender.ts)
//   /set, /set/, the gallery and megacanvas urls → /                     301
//   /app, /app/*          → /, /:splat                                   301
// Cloudflare Pages reads at most 2,000 static rules; the count is printed.
//
// The staged pages also get a content hash on their one fixed stylesheet url
// (sheets/atlas.css?v=<sha>), so a chrome change can never be served from a
// stale cache.
//
// Two <head> injections, staged copies only: the GA tag on every page
// (env-gated on VITE_GOOGLE_ANALYTICS_TRACKING_ID) and the Adobe Fonts kit on
// every page (env-gated on VITE_ADOBE_FONTS_KIT). Both ids are public and both
// live in .config/mise/cloudflare.local.env, which is gitignored.
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { BASE } from '../app/src/routes.ts';
import { FLAT_DIR } from './thumb-spec.mjs';

// Where the app used to be mounted; old links keep resolving through _redirects.
const OLD_APP_MOUNT = '/app';
// The retired /set/ mount: every url under it redirects.
const OLD_SET_MOUNT = '/set';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const appDist = join(root, 'app', 'dist');
const flat = join(root, FLAT_DIR);
if (!existsSync(join(appDist, 'index.html')))
  throw new Error('no app/dist — run `npm install && npm run build` in www/atlas.lit-ui-router.dev/app first');
if (!existsSync(flat)) throw new Error(`no ${FLAT_DIR}/ — run generator/build.mjs first`);
if (BASE !== '/') throw new Error(`stage-site expects the app at the root, not ${BASE}`);

rmSync(dist, { recursive: true, force: true });
cpSync(appDist, dist, { recursive: true });

// --- _redirects, merged -----------------------------------------------------
const appRules = readFileSync(join(dist, '_redirects'), 'utf8').trim();
// filenames the set no longer writes: the survey office is appendix A2 / A2i
const retired = [
  ['sheet-14-the-survey-office.html', 'A2'],
  ['sheet-14i-the-survey-office-interactive.html', 'A2i'],
];
// the manifest's cased nums are the sheet route's params; a page's num is the
// second dash-field of build.mjs's `sheet-<num>-<title>.html`
const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));
const nums = new Set([...manifest.sheets, ...manifest.appendix].map((row) => row.num));
const pages = readdirSync(flat).filter((f) => /^sheet-.*\.html$/.test(f)).sort();
const numOf = (file) => {
  const num = file.split('-')[1];
  if (!nums.has(num)) throw new Error(`${file}: no sheet ${num} in the manifest`);
  return num;
};
const plateUrl = (num) => `${BASE}plate/${num}`;
const spellings = (file) => {
  const stem = file.replace(/\.html$/, '');
  return [`/${file}`, `/${stem}`, `${OLD_SET_MOUNT}/${file}`, `${OLD_SET_MOUNT}/${stem}`];
};
const toPlate = (file, num) => spellings(file).map((from) => `${from} ${plateUrl(num)} 301`);
const indexUrls = [
  OLD_SET_MOUNT,
  `${OLD_SET_MOUNT}/`,
  ...['gallery', 'megacanvas'].flatMap((page) => [
    `/${page}.html`,
    `${OLD_SET_MOUNT}/${page}`,
    `${OLD_SET_MOUNT}/${page}.html`,
  ]),
];
// a `from` the app's own rules already claim is theirs; Pages takes the first match
const appFroms = new Set(appRules.split('\n').map((line) => line.split(/\s+/)[0]));
const legacy = [
  // /index.html is NOT redirected: it is the app.
  ...pages.flatMap((f) => toPlate(f, numOf(f))),
  ...retired.flatMap(([old, num]) => toPlate(old, num)),
  ...indexUrls.map((from) => `${from} ${BASE} 301`),
  `${OLD_APP_MOUNT} ${BASE} 301`,
  `${OLD_APP_MOUNT}/* ${BASE}:splat 301`,
].filter((rule) => !appFroms.has(rule.split(' ')[0]));
const ruleCount = appRules.split('\n').length + legacy.length;
if (ruleCount > 2000) throw new Error(`_redirects: ${ruleCount} rules, Cloudflare Pages reads 2,000`);
writeFileSync(join(dist, '_redirects'), `${[appRules, ...legacy].filter(Boolean).join('\n')}\n`);

// --- Google Analytics, staged copies only -----------------------------------
// The SAME measurement id as the flagship (one property, one stream: GA4
// cookies live on .lit-ui-router.dev, so a separate id would split users
// across the subdomains; slice the atlas out with the Hostname dimension).
// The committed pages (the Artifact source) never carry a tag. ONE tag,
// identical on every staged page: gtag owns the initial page_view and — with
// the stream's enhanced measurement on — every history-driven one. The router
// only fills the gap gtag cannot see, the Navigation API's own pushes
// (app/src/experimental/analytics.ts).
const GA_ID = process.env.VITE_GOOGLE_ANALYTICS_TRACKING_ID;
const gaTag = (id) => `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}');</script>
`;
const walkHtml = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    // sheets/ holds the chrome-less fragments the app fetches, not pages
    if (e.isDirectory()) { if (p !== join(dist, 'sheets')) walkHtml(p, out); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
};
let tagged = 0;
if (GA_ID) {
  for (const p of walkHtml(dist)) {
    const html = readFileSync(p, 'utf8');
    writeFileSync(p, html.replace('</head>', `${gaTag(GA_ID)}</head>`));
    tagged += 1;
  }
} else {
  console.warn('VITE_GOOGLE_ANALYTICS_TRACKING_ID missing — staging without analytics');
}

// --- the type, on every staged page ----------------------------------------
// atlas.css (generator/chrome.mjs) names the ADOBE family first in every role
// stack and the Google Fonts stand-in second, so the <head> is the whole
// difference between the two hosts, and a staged page has exactly ONE font host:
//
//   WITH the kit (VITE_ADOBE_FONTS_KIT set) — the kit <link> goes into EVERY
//     staged page, and the Google preconnects + stylesheet the app's own
//     index.html carries are STRIPPED from the staged copy. All five roles
//     resolve their first name, prose included (source-serif-pro), so the site
//     never touches fonts.googleapis.com or fonts.gstatic.com.
//   WITHOUT the kit — no kit link; the Google <link> the app's index.html
//     carries stays, so the stand-ins draw everywhere.
//
// The claude.ai artifact build is untouched by either branch: it never passes
// through here, and its host allows fonts.googleapis.com and nothing else.
//
// The kit id is PUBLIC (it is in the page source); it lives beside the GA id in
// .config/mise/cloudflare.local.env, which is gitignored.
const KIT = process.env.VITE_ADOBE_FONTS_KIT;
const kitLink = (kit) => `<link rel="preconnect" href="https://use.typekit.net" crossorigin>
<link rel="stylesheet" href="https://use.typekit.net/${kit}.css">
`;
// The three exact lines index.html carries, matched one by one rather than by
// rewriting the <head> — the vite build indents and self-closes them, so the
// attribute run is the stable part, not the surrounding whitespace.
const GOOGLE_LINK_LINES =
  /[ \t]*<link[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>[ \t]*\n?/g;
let typed = 0;
if (KIT) {
  for (const p of walkHtml(dist)) {
    let html = readFileSync(p, 'utf8');
    let touched = false;
    // ONE host: the kit answers every role, so the Google half goes away
    if (GOOGLE_LINK_LINES.test(html)) {
      GOOGLE_LINK_LINES.lastIndex = 0;
      html = html.replace(GOOGLE_LINK_LINES, '');
      touched = true;
    }
    GOOGLE_LINK_LINES.lastIndex = 0;
    if (!html.includes('use.typekit.net')) {
      html = html.replace('</head>', `${kitLink(KIT)}</head>`);
      touched = true;
    }
    if (touched) {
      writeFileSync(p, html);
      typed += 1;
    }
  }
}
console.log(
  KIT
    ? `Adobe Fonts kit: ${KIT} → every staged page, Google links stripped (single host) · type <head>s written on ${typed} pages`
    : 'Adobe Fonts kit: none — the Google stand-ins draw',
);

// --- the stylesheet's cache buster ------------------------------------------
// Every routed page links ONE fixed url, /sheets/atlas.css (app/index.html; the
// prerendered pages are all stamped out of the built index). A fixed url with a
// changed body is the one asset a browser can serve stale forever, so the
// staged <link> carries a short content hash: the chrome changes, the url
// changes, the cache misses.
const cssFile = join(dist, 'sheets', 'atlas.css');
const cssHash = createHash('sha256').update(readFileSync(cssFile)).digest('hex').slice(0, 8);
const CSS_LINK = /(<link\b[^>]*\bhref=")([^"]*sheets\/atlas\.css)(")/g;
let busted = 0;
for (const p of walkHtml(dist)) {
  const html = readFileSync(p, 'utf8');
  const next = html.replace(CSS_LINK, `$1$2?v=${cssHash}$3`);
  if (next !== html) {
    writeFileSync(p, next);
    busted += 1;
  }
}
console.log(`sheets/atlas.css?v=${cssHash} on ${String(busted)} pages`);

const routedPages = walkHtml(dist).length;
console.log(`staged the routed app at ${BASE} → dist/ (${routedPages - 1} prerendered pages + 404.html + manifest + fragments)`);
console.log(`_redirects: ${ruleCount} rules of 2,000 — ${appRules.split('\n').length} app rules + ${legacy.length} legacy rules (${pages.length + retired.length} standalone filenames → ${plateUrl('<num>')}, ${OLD_SET_MOUNT}/* and the gallery → ${BASE}, ${OLD_APP_MOUNT}/* → ${BASE})${GA_ID ? ` · GA tag on ${tagged} pages` : ''}`);
