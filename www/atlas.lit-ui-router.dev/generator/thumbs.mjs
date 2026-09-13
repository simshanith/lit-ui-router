// THUMBS — a picture of the plate for every card on the cover.
//
// The cards carried four keys, a caption and a verdict and no drawing at all,
// which made the index a wall of type. This step gives each one a 300 × 400
// picture of its own plate — the card's whole box, not a strip across its head
// — rendered at build time and checked in beside `app/public/sheets/*.html` as
// a tracked generated file. The app lays it as the card's BACKDROP: the head
// window and the translucent text panel sit over it, and everything the
// drawing does not cover stays transparent, so the lattice behind the grid
// keeps running through the picture. Hence the capture is transparent too —
// no paper, no ground, no sheet: the plate's own ink and its own `var(--paper-2)`
// block faces (the fills that hide an isometric's hidden lines) and nothing else.
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
import { ROOT } from './basis.mjs';
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
const require = createRequire(join(ROOT, 'tools/embed-heights/package.json'));
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
/** WebP's lossy quality. Line art with an alpha channel is the dearest thing
 *  this codec draws, and turning the knob barely moves it — 0.70 saves 5% on
 *  the heaviest plate — so the picture keeps the honest setting. */
const QUALITY = 0.78;

/**
 * PER-SHEET TUNING — the one hand table in this file.
 *
 * `fit` chooses how the drawing meets the 300 × 400 card box:
 *   'cover'   (the default) lays the plate at the CARD'S WIDTH, top-anchored,
 *             so the drawing reads at the size the city hero reads at; a plate
 *             taller than the card runs off the bottom, a shorter one simply
 *             leaves transparent space below.
 *   'contain' scales the WHOLE plate to sit inside the box — width or height,
 *             whichever binds — centred across and top-anchored down, with
 *             transparent margins. Nearly every plate is landscape, so contain
 *             is width-bound and reads smaller than cover; it earns its place
 *             on the portrait plates and wherever the tail of a drawing must
 *             not be cut.
 *
 * `target` is the element photographed (default: the plate's SVG). `crop` is a
 * `{ top, bottom }` pair of fractions down the target — the band of the plate
 * that IS the drawing, so contain can fit it without the schedule underneath.
 * `focus` is where the card box sits down that band, 0 top (the default) to 1
 * bottom; `x` is the same across it, 0 left to 1 right, 0.5 (the default)
 * centring. `zoom` enlarges the target that many times before the box is cut,
 * so the card holds 1/zoom of the drawing at full detail: a plate is re-laid
 * that many card-widths wide, while a lane is already drawn at stage width and
 * so has its box narrowed instead.
 */
const TUNING = {
  // The four interactive lanes draw into a cytoscape canvas, not an SVG plate:
  // the canvas is landscape and cannot be re-laid, so the zoom is what narrows
  // the portrait card box until it sits INSIDE the lane rather than overhanging
  // it — below about 2× the box runs off the bottom of the stage.
  '1i': { target: '#lw-cy', zoom: 2.3, focus: 0.45 },
  '2b': { target: '#cb-cy', zoom: 2.3, x: 0.12, focus: 0.35 },
  '12i': { target: '#rg-cy', zoom: 2.2, x: 1, focus: 0.05 },
  '14i': { target: '#pg-cy', zoom: 2, x: 0.72, focus: 0.12 },
  // plates whose whole figure reads as grey at card width, enlarged into a detail
  '3a': { zoom: 1.3, x: 0.1 },
  4: { zoom: 1.2, x: 0.45 },
  5: { zoom: 1.5, x: 0.55, focus: 0.05 },
  6: { zoom: 1.5, x: 0 },
  13: { zoom: 1.8, x: 0.02, focus: 0.02 },
  // Every other plate takes the default: the whole drawing at the card's width,
  // top-anchored. They are landscape to a plate, and a landscape drawing laid at
  // the card's width is already as large as it can be — which is why no row here
  // asks for `fit: 'contain'`: contain would only make it smaller.
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

// The plate is re-laid at a width this step picks and everything around it is
// cut, so the capture is a piece of the DRAWING and never of the page it sits
// on. Every paper in the stack is nulled as well: the picture is the card's
// backdrop, and what the ink does not cover has to stay see-through.
const fitCss = (widthPx) => `
  html, body { background: transparent !important; }
  body { padding: 0 !important; }
  .sheet { background: transparent !important; box-shadow: none !important; border: 0 !important; }
  .sheet::before, .sheet::after, .plate::after { display: none !important; }
  .sheet, .sheet-body, .plate, .figure-wrap, figure { margin: 0 !important; padding: 0 !important;
    border: 0 !important; background: transparent !important; }
  .figure-wrap { overflow: visible !important; }
  .figure-wrap svg { min-width: 0 !important; max-width: none !important;
    width: ${String(widthPx)}px !important; height: auto !important; margin: 0 !important; }
`;

/** Nothing between the target and the page may paint: the capture is alpha. */
async function stripPaper(page, selector) {
  await page.evaluate((sel) => {
    for (let node = document.querySelector(sel); node; node = node.parentElement) {
      node.style.setProperty('background', 'transparent', 'important');
      node.style.setProperty('box-shadow', 'none', 'important');
    }
    document.documentElement.style.setProperty('background', 'transparent', 'important');
    document.body.style.setProperty('background', 'transparent', 'important');
  }, selector);
}

/**
 * Chromium resizes and encodes the WebP itself — the build needs no image
 * library. The capture is only the part of the 300 × 400 box the drawing
 * actually reaches; it is laid on a 600 × 800 canvas that is never filled, so
 * the rest of the card stays transparent and the lattice runs through it.
 */
async function toWebp(page, { png, dx, dy, dw, dh }) {
  return Buffer.from(
    await page.evaluate(
      async ([data, w, h, x, y, cw, ch, QUALITY]) => {
        const bitmap = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${data}`)).blob(),
        );
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, x, y, cw, ch);
        return canvas
          .toDataURL('image/webp', Number(QUALITY))
          .slice('data:image/webp;base64,'.length);
      },
      [
        png.toString('base64'),
        THUMB_W * SCALE,
        THUMB_H * SCALE,
        dx * SCALE,
        dy * SCALE,
        dw * SCALE,
        dh * SCALE,
        QUALITY,
      ],
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
  const contain = tune.fit === 'contain';
  const cropTop = tune.crop?.top ?? 0;
  const cropBottom = tune.crop?.bottom ?? 1;
  const locator = page.locator(target).first();
  await locator.waitFor({ state: 'visible', timeout: 20000 });
  // A cytoscape lane paints on its own schedule; an SVG plate is already there.
  if (tune.target) await page.waitForTimeout(1200);
  else await page.addStyleTag({ content: fitCss(THUMB_W * zoom) });
  await stripPaper(page, target);
  let box = await locator.boundingBox();
  if (!box) throw new Error(`${id}: ${target} has no box`);
  if (!tune.target && contain) {
    // the plate's own ratio, of the cropped band, decides the fitted width
    const ratio = box.width / (box.height * (cropBottom - cropTop));
    await page.addStyleTag({ content: fitCss(Math.min(THUMB_W, THUMB_H * ratio) * zoom) });
    box = await locator.boundingBox();
    if (!box) throw new Error(`${id}: ${target} has no box`);
  }
  // The card box, in the page's own pixels: a plate is re-laid to the card's
  // width above, so the box is the card; a lane keeps its native canvas and
  // has the box narrowed around it instead.
  const winW = tune.target ? box.width / zoom : THUMB_W;
  const winH = (winW * THUMB_H) / THUMB_W;
  // the band of the target that is the drawing — the whole of it by default
  const region = {
    x: box.x,
    y: box.y + box.height * cropTop,
    width: box.width,
    height: box.height * (cropBottom - cropTop),
  };
  const originX = region.x + (region.width - winW) * (tune.x ?? 0.5);
  const originY = region.y + (region.height - winH) * (tune.focus ?? 0);
  // Only where the drawing actually is gets photographed; the rest of the card
  // box is never captured at all, and so stays alpha on the canvas.
  const cx = Math.max(originX, region.x);
  const cy = Math.max(originY, region.y);
  const cw = Math.min(originX + winW, region.x + region.width) - cx;
  const ch = Math.min(originY + winH, region.y + region.height) - cy;
  if (cw <= 0 || ch <= 0) throw new Error(`${id}: the card box misses the drawing entirely`);
  // clip is in CSS px; the device scale factor is what makes the capture 2×
  const png = await page.screenshot({
    fullPage: true,
    omitBackground: true,
    clip: { x: cx, y: cy, width: cw, height: ch },
  });
  const scale = THUMB_W / winW;
  return {
    png,
    dx: (cx - originX) * scale,
    dy: (cy - originY) * scale,
    dw: cw * scale,
    dh: ch * scale,
  };
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
      const shot = await shoot(page, { ...card, theme, origin });
      const webp = await toWebp(page, shot);
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
