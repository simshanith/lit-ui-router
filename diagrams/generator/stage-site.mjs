// Stage the atlas for static hosting. Run from diagrams/:
//   node generator/stage-site.mjs
//
// The routed app owns the site root: dist/ IS app/dist (the prerendered
// pages, assets, manifest.json, the sheets/ fragments, 404.html and the
// app's own _redirects). The flat drawing set — every diagrams/*.html — is
// staged beside it under dist/set/, with the gallery doubled as
// set/index.html and the two CDN scripts vendored into set/vendor/ so the
// deployed site carries no external origin. Committed pages keep their cdnjs
// URLs (the Artifact host's CSP allows only that origin); the rewrite below
// touches the STAGED copies alone. Vendored bytes are pin-verified by sha256
// — a hash mismatch aborts the stage.
//
// _redirects, merged at the root (Cloudflare Pages reads only that one):
//   the app's own lines (prerender.ts: /office, the lowercase sheet ids)
//   /<old flat filename>  → /set/<same file>  301   (every page but index.html)
//   /app, /app/*          → /, /:splat         301   (the app's old mount)
//
// Three <head> injections, all staged-copies-only: the GA tag on every page
// (env-gated on VITE_GOOGLE_ANALYTICS_TRACKING_ID), the Google Fonts stand-ins
// on every page that does not already carry them (the flat set — the routed app
// ships them in its own index.html), and the Adobe Fonts kit on every page
// (env-gated on VITE_ADOBE_FONTS_KIT). Both ids are public and both live in
// .config/mise/cloudflare.local.env, which is gitignored.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { BASE, SET } from '../app/src/routes.ts';

const VENDOR = [
  {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.31.0/cytoscape.min.js',
    file: 'cytoscape.min.js',
    sha256: 'e7d4c6c286bee0ba346c68ed1c8b8b82b4740b75be5d0c4d6602ee38df55d9c1',
  },
  {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.169.0/three.module.min.js',
    file: 'three.module.min.js',
    sha256: 'f7cee3c7533449a1505cc12cb5128b89e3d4fd3d7ea62b05f9f5464a217472ee',
  },
];

// Where the app used to be mounted; old links keep resolving through _redirects.
const OLD_APP_MOUNT = '/app';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const appDist = join(root, 'app', 'dist');
if (!existsSync(join(appDist, 'index.html')))
  throw new Error('no app/dist — run `npm install && npm run build` in diagrams/app first');
if (BASE !== '/') throw new Error(`stage-site expects the app at the root, not ${BASE}`);

rmSync(dist, { recursive: true, force: true });
cpSync(appDist, dist, { recursive: true });

// --- the flat set, under /set/ --------------------------------------------
const set = join(dist, SET.replace(/^\/|\/$/g, ''));
mkdirSync(join(set, 'vendor'), { recursive: true });

for (const { url, file, sha256 } of VENDOR) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const got = createHash('sha256').update(bytes).digest('hex');
  if (got !== sha256) throw new Error(`${file}: sha256 ${got}, pinned ${sha256}`);
  writeFileSync(join(set, 'vendor', file), bytes);
}

// The pages sit in /set/ and the scripts in /set/vendor/, so the relative
// path is the same one the old root layout used.
const vendored = (html) =>
  VENDOR.reduce((s, { url, file }) => s.replaceAll(url, `./vendor/${file}`), html);

const pages = readdirSync(root).filter((f) => f.endsWith('.html')).sort();
for (const f of pages) writeFileSync(join(set, f), vendored(readFileSync(join(root, f), 'utf8')));
writeFileSync(join(set, 'index.html'), readFileSync(join(set, 'gallery.html'), 'utf8'));

// --- _redirects, merged -----------------------------------------------------
const appRules = readFileSync(join(dist, '_redirects'), 'utf8').trim();
const legacy = [
  // /index.html is NOT redirected: it is the app now.
  ...pages.map((f) => `/${f} ${SET}${f} 301`),
  `${OLD_APP_MOUNT} ${BASE} 301`,
  `${OLD_APP_MOUNT}/* ${BASE}:splat 301`,
];
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
const tagged = { routed: 0, flat: 0 };
if (GA_ID) {
  for (const p of walkHtml(dist)) {
    const routed = !p.startsWith(`${set}/`);
    // the flat pages are head-less (the Artifact host wraps them), so the tag leads the file
    const html = readFileSync(p, 'utf8');
    const tag = gaTag(GA_ID);
    writeFileSync(p, html.includes('</head>') ? html.replace('</head>', `${tag}</head>`) : tag + html);
    tagged[routed ? 'routed' : 'flat'] += 1;
  }
} else {
  console.warn('VITE_GOOGLE_ANALYTICS_TRACKING_ID missing — staging without analytics');
}

// --- the type, on every staged page ----------------------------------------
// atlas.css (generator/chrome.mjs) names the ADOBE family first in every role
// stack and the Google Fonts stand-in second, so the <head> is the whole
// difference between the two hosts:
//
//   the Google <link> — Josefin Sans 600, Barlow Semi Condensed 400/600,
//     Source Serif 4 400 + italic. The routed app carries it in its own
//     index.html (it is the only half a claude.ai artifact can have), so it is
//     injected HERE only into the flat pages, which are head-less until the
//     host wraps them.
//   the Adobe kit <link> — injected into EVERY staged page, routed and flat,
//     when VITE_ADOBE_FONTS_KIT is set. Unset (or in the artifact build) the
//     stand-ins simply draw and nothing breaks; the type specimen's own LOADED
//     FACES readout is the check.
//
// The kit id is PUBLIC (it is in the page source); it lives beside the GA id in
// .config/mise/cloudflare.local.env, which is gitignored.
const GOOGLE_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@600&family=Barlow+Semi+Condensed:wght@400;600&family=Source+Serif+4:ital,wght@0,400;1,400&display=swap">
`;
const KIT = process.env.VITE_ADOBE_FONTS_KIT;
const kitLink = (kit) => `<link rel="preconnect" href="https://use.typekit.net" crossorigin>
<link rel="stylesheet" href="https://use.typekit.net/${kit}.css">
`;
const typed = { routed: 0, flat: 0 };
for (const p of walkHtml(dist)) {
  const routed = !p.startsWith(`${set}/`);
  let html = readFileSync(p, 'utf8');
  let touched = false;
  // the app's index.html already carries the Google half; the flat pages do not
  if (!html.includes('fonts.googleapis.com')) {
    html = html.includes('</head>')
      ? html.replace('</head>', `${GOOGLE_FONTS}</head>`)
      : GOOGLE_FONTS + html;
    touched = true;
  }
  if (KIT && !html.includes('use.typekit.net')) {
    const link = kitLink(KIT);
    html = html.includes('</head>') ? html.replace('</head>', `${link}</head>`) : link + html;
    touched = true;
  }
  if (touched) {
    writeFileSync(p, html);
    typed[routed ? 'routed' : 'flat'] += 1;
  }
}
console.log(
  KIT
    ? `Adobe Fonts kit: ${KIT} → every staged page · type <head>s written on ${typed.routed} routed + ${typed.flat} flat pages`
    : `Adobe Fonts kit: none — the Google stand-ins draw · type <head>s written on ${typed.routed} routed + ${typed.flat} flat pages`,
);

const routedPages = walkHtml(dist).filter((p) => !p.startsWith(`${set}/`)).length;
console.log(`staged the routed app at ${BASE} → dist/ (${routedPages - 1} prerendered pages + 404.html + manifest + fragments)`);
console.log(`staged the flat set at ${SET} → dist${SET} (${pages.length} pages + index.html + ${VENDOR.length} vendored scripts)`);
console.log(`_redirects: ${appRules.split('\n').length} app rules + ${legacy.length} legacy rules (old filenames → ${SET}, ${OLD_APP_MOUNT}/* → ${BASE})${GA_ID ? ` · GA tag on ${tagged.routed} routed + ${tagged.flat} flat pages` : ''}`);
