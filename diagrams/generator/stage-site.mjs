// Stage the atlas for static hosting: copy the rendered set into dist/ with
// the gallery doubled as index.html, and vendor the two CDN scripts so the
// deployed site carries no external origin. Run from diagrams/:
//   node generator/stage-site.mjs
// Committed pages keep their cdnjs URLs (the Artifact host's CSP allows only
// that origin); the rewrite below touches the STAGED copies alone. Vendored
// bytes are pin-verified by sha256 — a hash mismatch aborts the stage.
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

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

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'vendor'), { recursive: true });

for (const { url, file, sha256 } of VENDOR) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const got = createHash('sha256').update(bytes).digest('hex');
  if (got !== sha256) throw new Error(`${file}: sha256 ${got}, pinned ${sha256}`);
  writeFileSync(join(dist, 'vendor', file), bytes);
}

const vendored = (html) =>
  VENDOR.reduce((s, { url, file }) => s.replaceAll(url, `./vendor/${file}`), html);

const pages = readdirSync(root).filter((f) => f.endsWith('.html')).sort();
for (const f of pages) writeFileSync(join(dist, f), vendored(readFileSync(join(root, f), 'utf8')));
copyFileSync(join(dist, 'gallery.html'), join(dist, 'index.html'));

// The routed set rides along at /app/ — vite's `base` is already /app/, and
// its own dist carries the prerendered pages, _redirects and the fragments.
// The static sheets stay exactly where they are.
const appDist = join(root, 'app', 'dist');
const staged = existsSync(appDist);
if (staged) {
  cpSync(appDist, join(dist, 'app'), { recursive: true });
  // Cloudflare Pages only reads _redirects at the SITE root, and the app's
  // rules are already absolute (/app/office -> /app/sheet/14), so lift it.
  const nested = join(dist, 'app', '_redirects');
  if (existsSync(nested)) {
    writeFileSync(join(dist, '_redirects'), readFileSync(nested, 'utf8'));
    rmSync(nested);
  }
}

// Google Analytics, staged copies only — the same env var the flagship docs
// build reads, so the committed pages (the Artifact source) never carry a tag.
// The atlas app's SPA route changes send their own page_view (app/src/experimental/analytics.ts).
const GA_ID = process.env.VITE_GOOGLE_ANALYTICS_TRACKING_ID;
const gaTag = (id) => `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}');</script>
`;
const walkHtml = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'sheets') walkHtml(p, out); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
};
let tagged = 0;
if (GA_ID) {
  for (const p of walkHtml(dist)) {
    // the static sheets are head-less (the Artifact host wraps them), so the tag leads the file
    const html = readFileSync(p, 'utf8');
    writeFileSync(p, html.includes('</head>') ? html.replace('</head>', `${gaTag(GA_ID)}</head>`) : gaTag(GA_ID) + html);
    tagged += 1;
  }
} else {
  console.warn('VITE_GOOGLE_ANALYTICS_TRACKING_ID missing — staging without analytics');
}

console.log(`staged ${pages.length} pages + index.html + ${VENDOR.length} vendored scripts → dist/${GA_ID ? ` · GA tag on ${tagged} pages` : ''}`);
console.log(staged
  ? 'staged the routed app → dist/app/ (run `npm run build` in app/ first to refresh it)'
  : 'no app/dist — run `npm install && npm run build` in diagrams/app to include /app/');
