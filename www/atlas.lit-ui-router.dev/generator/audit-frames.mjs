// AUDIT-FRAMES — a numeric frame audit over every static SVG plate, in the
// SVG's own user units (client rects divided back by the plate's scale, so a
// transformed group is measured where it actually lands). Three counts:
//   ESCAPE  — a drawn element whose bbox leaves the viewBox
//   HIT     — lettering over a filled mass, by real silhouette (separating axis)
//             for polygons and by bbox for filled rects; a shape that CONTAINS
//             the label is a panel it sits in, not a mass it fouls, and a one-
//             or two-digit badge sits on its own block by design
//   TEXT    — two labels overlapping each other
//
//   node www/atlas.lit-ui-router.dev/generator/audit-frames.mjs [tag] [--only 3B,7] [--out <dir>]
//
// Run after build.mjs, from the workspace root; reads the pages under tmp/flat/. Prints one line per plate and a
// TOTAL line; writes <out>/<tag>.json with every finding. Exits 1 when any
// escape, hit deeper than 1px or text-on-text overlap is found. The interactive
// lanes are skipped: cytoscape lays them out at runtime.
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './basis.mjs';
import { FLAT_DIR } from './thumb-spec.mjs';

const ATLAS = fileURLToPath(new URL('../', import.meta.url));
const FLAT = join(ATLAS, FLAT_DIR);
const SKIP = /sheet-(1i|2B|12i|14i)-/;
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i !== -1 ? argv[i + 1] : undefined; };
const TAG = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--only' && argv[i - 1] !== '--out') ?? 'audit';
const ONLY = flag('--only') ? new Set(flag('--only').split(',')) : null;
const OUT = flag('--out') ?? join(ATLAS, 'tmp', 'audit');
mkdirSync(OUT, { recursive: true });

const files = readdirSync(FLAT).filter((f) => /^sheet-.*\.html$/.test(f) && !SKIP.test(f)).sort()
  .filter((f) => !ONLY || ONLY.has(f.split('-')[1]));
const require = createRequire(join(ROOT, 'tools/embed-heights/package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

const all = {};
for (const f of files) {
  await page.goto(`file://${join(FLAT, f)}`, { waitUntil: 'load' });
  await page.waitForTimeout(150);
  all[f] = await page.evaluate(() => {
    const sat = (a, b) => {
      const axes = [];
      const edges = (set) => { for (let i = 0; i < set.length; i++) { const p = set[i], q = set[(i + 1) % set.length]; axes.push([-(q[1] - p[1]), q[0] - p[0]]); } };
      edges(a); edges(b);
      let minGap = Infinity;
      for (const [ax, ay] of axes) {
        const len = Math.hypot(ax, ay) || 1;
        const proj = (s) => s.map(([x, y]) => (x * ax + y * ay) / len);
        const A = proj(a), B = proj(b);
        const gap = Math.max(Math.min(...A) - Math.max(...B), Math.min(...B) - Math.max(...A));
        if (gap > 0) return { overlaps: false };
        minGap = Math.min(minGap, -gap);
      }
      return { overlaps: true, depth: minGap };
    };
    const out = [];
    [...document.querySelectorAll('.figure-wrap svg')].forEach((svg, idx) => {
      const vb = svg.viewBox.baseVal;
      const sbox = svg.getBoundingClientRect();
      const scale = sbox.width / (vb.width || 1);
      const toUser = (r) => ({
        x: vb.x + (r.left - sbox.left) / scale, y: vb.y + (r.top - sbox.top) / scale,
        x2: vb.x + (r.right - sbox.left) / scale, y2: vb.y + (r.bottom - sbox.top) / scale,
      });
      const escapes = [];
      for (const el of svg.querySelectorAll('polygon, rect, path, circle, ellipse, line, text, image, polyline')) {
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        const u = toUser(r);
        const over = {
          left: +(vb.x - u.x).toFixed(2), top: +(vb.y - u.y).toFixed(2),
          right: +(u.x2 - (vb.x + vb.width)).toFixed(2), bottom: +(u.y2 - (vb.y + vb.height)).toFixed(2),
        };
        const worst = Math.max(over.left, over.top, over.right, over.bottom);
        if (worst > 0.5)
          escapes.push({ tag: el.tagName, cls: el.getAttribute('class') ?? '', text: el.tagName === 'text' ? el.textContent.slice(0, 70) : '', over, worst: +worst.toFixed(2) });
      }
      const masses = [];
      for (const el of svg.querySelectorAll('polygon')) {
        if ((el.getAttribute('class') ?? '').includes('fnone')) continue;
        const m = el.getScreenCTM();
        const pts = (el.getAttribute('points') ?? '').trim().split(/\s+/).filter(Boolean).map((p) => {
          const [x, y] = p.split(',').map(Number);
          const cx = m.a * x + m.c * y + m.e, cy = m.b * x + m.d * y + m.f;
          return [vb.x + (cx - sbox.left) / scale, vb.y + (cy - sbox.top) / scale];
        });
        if (pts.length >= 3) masses.push({ cls: el.getAttribute('class') ?? '', pts, tag: 'polygon' });
      }
      for (const el of svg.querySelectorAll('rect')) {
        const cls = el.getAttribute('class') ?? '';
        if (cls.includes('fnone') || el.getAttribute('fill') === 'none') continue;
        const u = toUser(el.getBoundingClientRect());
        masses.push({ cls, tag: 'rect', pts: [[u.x, u.y], [u.x2, u.y], [u.x2, u.y2], [u.x, u.y2]] });
      }
      const hits = [];
      const labels = [];
      for (const t of svg.querySelectorAll('text')) {
        const label = t.textContent.trim();
        if (!label) continue;
        const u = toUser(t.getBoundingClientRect());
        labels.push({ label, u, cls: t.getAttribute('class') ?? '' });
        if (/^\d{1,2}$/.test(label)) continue;
        const rectPts = [[u.x, u.y], [u.x2, u.y], [u.x2, u.y2], [u.x, u.y2]];
        for (const p of masses) {
          const xs = p.pts.map((q) => q[0]), ys = p.pts.map((q) => q[1]);
          if (Math.min(...xs) <= u.x && Math.max(...xs) >= u.x2 && Math.min(...ys) <= u.y && Math.max(...ys) >= u.y2) continue;
          const r = sat(rectPts, p.pts);
          if (r.overlaps) hits.push({ text: label, cls: t.getAttribute('class') ?? '', rect: { x: +u.x.toFixed(1), y: +u.y.toFixed(1), x2: +u.x2.toFixed(1), y2: +u.y2.toFixed(1) }, poly: `${p.tag}.${p.cls}`, pts: p.pts.map((q) => q.map((v) => +v.toFixed(1))), depth: +r.depth.toFixed(2) });
        }
      }
      const texts = [];
      for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i].u, b = labels[j].u;
        const w = Math.min(a.x2, b.x2) - Math.max(a.x, b.x);
        const h = Math.min(a.y2, b.y2) - Math.max(a.y, b.y);
        if (w > 1 && h > 1) texts.push({ a: labels[i].label, b: labels[j].label, w: +w.toFixed(1), h: +h.toFixed(1), at: `${a.x.toFixed(0)},${a.y.toFixed(0)}` });
      }
      out.push({ idx, viewBox: [vb.x, vb.y, vb.width, vb.height], escapes, hits, texts });
    });
    return out;
  });
}
await browser.close();
writeFileSync(join(OUT, `${TAG}.json`), JSON.stringify(all, null, 1));
let E = 0, H = 0, X = 0;
for (const [f, svgs] of Object.entries(all)) {
  const esc = svgs.flatMap((s) => s.escapes.map((e) => ({ ...e, idx: s.idx })));
  const deep = svgs.flatMap((s) => s.hits.filter((h) => h.depth > 1).map((h) => ({ ...h, idx: s.idx })));
  const slack = svgs.flatMap((s) => s.hits.filter((h) => h.depth <= 1));
  const texts = svgs.flatMap((s) => s.texts);
  E += esc.length; H += deep.length; X += texts.length;
  console.log(`\n=== ${f}   escapes ${esc.length} | hits>1px ${deep.length} | hits<=1px ${slack.length} | text-on-text ${texts.length}`);
  for (const e of esc) console.log(`   ESC svg${e.idx} <${e.tag} class="${e.cls}"> ${JSON.stringify(e.text)} over ${JSON.stringify(e.over)}`);
  for (const h of deep) console.log(`   HIT svg${h.idx} ${JSON.stringify(h.text)} [${h.cls}] depth ${h.depth} rect ${h.rect.x},${h.rect.y}-${h.rect.x2},${h.rect.y2} mass[${h.poly}] ${h.pts.map((p) => p.join(',')).join(' ')}`);
  for (const h of slack) console.log(`   slack ${JSON.stringify(h.text)} depth ${h.depth} mass[${h.poly}]`);
  for (const t of texts) console.log(`   TXT ${JSON.stringify(t.a)} × ${JSON.stringify(t.b)}  ${t.w}×${t.h} at ${t.at}`);
}
console.log(`\nTOTAL escapes ${E} · hits>1px ${H} · text-on-text ${X} · ${join(OUT, `${TAG}.json`)}`);
process.exit(E + H + X ? 1 : 0);
