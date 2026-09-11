// THUMBS — a picture of the plate for every card on the cover.
//
// The cards carried four keys, a caption and a verdict and no drawing at all,
// which made the index a wall of type. This step gives each one a 259 × 150
// picture of its own plate, rendered at build time and checked in beside
// `app/public/sheets/*.html` as a tracked generated file.
//
// It is a RASTER step, not an inline-SVG one, and deliberately so: the set's
// first plates come to 1,085,034 bytes of SVG (373,671 gzipped), and the cover
// already ships a 104 KB manifest. Baking them into the index would multiply
// the cover's payload; two dozen lazily-fetched WebPs cost the cover nothing
// until a card scrolls in.
//
// Written, relative to build.mjs's OUT argument:
//   app/public/thumbs/<id>.webp        the light-theme picture
//   app/public/thumbs/<id>-dark.webp   the same crop in cyanotype
//
// Run it AFTER build.mjs (it photographs the flat set build.mjs writes), then
// run build.mjs again so the manifest can assert every card has its picture:
//
//   node www/atlas.lit-ui-router.dev/generator/build.mjs www/atlas.lit-ui-router.dev
//   node www/atlas.lit-ui-router.dev/generator/thumbs.mjs www/atlas.lit-ui-router.dev
//   node www/atlas.lit-ui-router.dev/generator/build.mjs www/atlas.lit-ui-router.dev
//
// Only a NEW plate needs the three-pass dance; a re-run over an unchanged set
// is idempotent, and build.mjs alone stays green.
//
// Optional flags, after the outdir:
//   --only <ids>       comma list of card ids — render only those
//   --out <dir>        write the webps there instead of app/public/thumbs/
//   --tuning <file>    a JSON object merged over TUNING, per-id, for scratch runs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { THUMB_DIR, THUMB_H, THUMB_W, thumbFile } from './thumb-spec.mjs';

const [OUT, ...FLAGS] = process.argv.slice(2);
if (!OUT)
  throw new Error(
    'usage: node thumbs.mjs <outdir> [--only <ids>] [--out <dir>] [--tuning <file.json>]   (outdir is the same dir build.mjs was given)',
  );

let onlyIds = null;
let outDir = null;
let tuningOverride = null;
for (let i = 0; i < FLAGS.length; i++) {
  const flag = FLAGS[i];
  if (flag === '--only') onlyIds = FLAGS[++i].split(',');
  else if (flag === '--out') outDir = FLAGS[++i];
  else if (flag === '--tuning') tuningOverride = JSON.parse(readFileSync(FLAGS[++i], 'utf8'));
  else throw new Error(`thumbs.mjs: unknown flag ${flag}`);
}

// The atlas is not a pnpm workspace member, so playwright is reached through a
// member that declares it — @tools/embed-heights, the repo's other renderer.
const require = createRequire(new URL('../../../tools/embed-heights/package.json', import.meta.url));
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  throw new Error(
    'thumbs.mjs needs playwright — run `mise exec -- pnpm install` at the repo root first',
  );
}

// The lanes' cytoscape is served off cdnjs on a standalone page. The build does
// not reach the network: the request is answered from the app's own copy.
const CYTOSCAPE = new URL('../app/node_modules/cytoscape/dist/cytoscape.min.js', import.meta.url);

/** 2× the card box, so the picture holds up on a retina display. */
const SCALE = 2;
/** Wide enough that a plate's own `min-width: 1000px` never has to bite. */
const VIEWPORT = { width: 1400, height: 1000 };

/**
 * PER-SHEET TUNING — the one hand table in this file.
 *
 * `target` is the element photographed (default: the plate's SVG). `focus` is
 * where the 259 × 150 window sits down the target's height, 0 top to 1 bottom;
 * `x` is the same, across the target's width, 0 left to 1 right; the default
 * for both centres the window, exactly as `preserveAspectRatio="xMidYMid
 * slice"` would. `zoom` enlarges the target that many times before the window
 * is cut, so the card holds 1/zoom of the drawing at full detail: a plate is
 * re-laid that many card-widths wide, while a lane is already drawn at stage
 * width and so has its window narrowed instead. A plate whose default crop
 * lands on a schedule rather than a drawing gets a row here — that is the whole
 * per-sheet knob.
 */
const TUNING = {
  // the four interactive lanes draw into a cytoscape canvas, not an SVG plate
  '1i': { target: '#lw-cy', zoom: 1.08 },
  '2b': { target: '#cb-cy', zoom: 1.47, x: 0, focus: 0.18 },
  '12i': { target: '#rg-cy', zoom: 2.45, x: 1, focus: 0.02 },
  '14i': { target: '#pg-cy', zoom: 1.8, x: 0.78 },
  // plates whose drawing sits above a tall schedule
  7: { focus: 0.24 },
  '7a': { focus: 0.26 },
  '7b': { focus: 0.2 },
  3: { focus: 0.3 },
  '3b': { focus: 0.3 },
  8: { focus: 0.3 },
  10: { focus: 0.3 },
  11: { focus: 0.22 },
  12: { focus: 0.12 },
  14: { focus: 0.22 },
  a1: { focus: 0.1 },
  // plates whose whole figure reads as grey at card size, enlarged into a detail
  5: { zoom: 1.24, x: 0.62, focus: 0.25 },
  6: { zoom: 1.45, x: 0, focus: 0.13 },
  13: { zoom: 2.6, x: 0.01, focus: 0.057 },
};

// `--tuning` merges a scratch override over TUNING, per id, shallowly.
const EFFECTIVE_TUNING = tuningOverride
  ? Object.fromEntries(
      [...new Set([...Object.keys(TUNING), ...Object.keys(tuningOverride)])].map((id) => [
        id,
        { ...TUNING[id], ...tuningOverride[id] },
      ]),
    )
  : TUNING;

const DEFAULT_TARGET = '.plate .figure-wrap svg';

const TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

/** The flat set, served from disk: the standalone pages are what is photographed. */
async function serveSet(dir) {
  const server = createServer((req, res) => {
    void (async () => {
      const path = decodeURIComponent(new URL(req.url ?? '/', 'http://atlas').pathname);
      const file = normalize(join(dir, path === '/' ? '/gallery.html' : path));
      if (!file.startsWith(dir)) {
        res.writeHead(403).end('no');
        return;
      }
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end('not found');
      }
    })();
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

// The plate is re-laid at the card's own width and everything around it is cut,
// so the window is a slice of the DRAWING and never of the page it sits on.
// `zoom` lays it out that many card-widths wide instead of one, so the window
// keeps its 259 × 150 and holds 1/zoom of the drawing at full detail.
const fitCss = (zoom) => `
  html, body { background: var(--paper) !important; }
  body { padding: 0 !important; }
  .sheet, .sheet-body, .plate, .figure-wrap { margin: 0 !important; padding: 0 !important; border: 0 !important; }
  .plate::after { display: none !important; }
  .figure-wrap svg { min-width: 0 !important; max-width: none !important;
    width: ${String(THUMB_W * zoom)}px !important; height: auto !important; margin: 0 !important; }
`;

/**
 * Chromium resizes and encodes the WebP itself — the build needs no image
 * library. Every window lands on the same 518 × 300 grid whatever size it was
 * clipped at, so a lane's native canvas and a plate's re-laid SVG agree.
 */
async function toWebp(page, png) {
  return Buffer.from(
    await page.evaluate(
      async ([data, w, h]) => {
        const bitmap = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${data}`)).blob(),
        );
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, w, h);
        return canvas.toDataURL('image/webp', 0.82).slice('data:image/webp;base64,'.length);
      },
      [png.toString('base64'), THUMB_W * SCALE, THUMB_H * SCALE],
    ),
    'base64',
  );
}

/** One card's picture, in one theme. */
async function shoot(page, { id, standalone, theme, origin }) {
  const tune = EFFECTIVE_TUNING[id] ?? {};
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(`${origin}/${standalone}`, { waitUntil: 'load' });
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  const target = tune.target ?? DEFAULT_TARGET;
  const zoom = Math.max(1, tune.zoom ?? 1);
  const locator = page.locator(target).first();
  await locator.waitFor({ state: 'visible', timeout: 20000 });
  // A cytoscape lane paints on its own schedule; an SVG plate is already there.
  if (tune.target) await page.waitForTimeout(1200);
  else await page.addStyleTag({ content: fitCss(zoom) });
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${id}: ${target} has no box`);
  // The window is the full width of the target, sliced to the card's ratio; a
  // plate's enlargement is the relayout above, a lane's is this narrowing.
  const width = tune.target ? box.width / zoom : Math.min(box.width, THUMB_W);
  const height = (width * THUMB_H) / THUMB_W;
  const focus = tune.focus ?? 0.5;
  const x = tune.x ?? 0.5;
  // clip is in CSS px; the device scale factor is what makes the capture 2×
  return page.screenshot({
    clip: {
      x: box.x + Math.max(0, box.width - width) * x,
      y: box.y + Math.max(0, box.height - height) * focus,
      width,
      height: Math.min(height, box.height),
    },
  });
}

const manifest = JSON.parse(readFileSync(join(OUT, 'app', 'public', 'manifest.json'), 'utf8'));
// The city card draws `cover.hero`, an SVG already in the manifest, so it is
// not photographed here; every other card is.
const allCards = [...manifest.sheets, ...manifest.appendix].map((row) => ({
  id: row.id,
  standalone: row.standalone,
}));

let cards = allCards;
if (onlyIds) {
  const known = new Set(allCards.map((card) => String(card.id)));
  for (const id of onlyIds) {
    if (!known.has(id))
      throw new Error(`thumbs.mjs: --only unknown id "${id}" — valid ids: ${[...known].join(', ')}`);
  }
  const wanted = new Set(onlyIds);
  cards = allCards.filter((card) => wanted.has(String(card.id)));
}

const dir = outDir ?? join(OUT, 'app', 'public', THUMB_DIR);
mkdirSync(dir, { recursive: true });

const server = await serveSet(normalize(join(OUT)));
const { port } = server.address();
const origin = `http://127.0.0.1:${String(port)}`;
const browser = await chromium.launch();
let bytes = 0;
try {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  await page.route('**/cdnjs.cloudflare.com/ajax/libs/cytoscape/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: readFileSync(CYTOSCAPE, 'utf8') }),
  );
  for (const card of cards) {
    for (const theme of ['light', 'dark']) {
      const png = await shoot(page, { ...card, theme, origin });
      const webp = await toWebp(page, png);
      const file = join(dir, thumbFile(card.id, theme));
      writeFileSync(file, webp);
      bytes += webp.length;
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(
  `thumbs: ${String(cards.length)} plates × 2 themes · ` +
    `${bytes.toLocaleString('en-US')} bytes → ${dir}`,
);
