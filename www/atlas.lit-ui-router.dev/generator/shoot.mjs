// SHOOT — a full-resolution photograph of every emitted plate, light and dark.
//
//   node www/atlas.lit-ui-router.dev/generator/shoot.mjs [tag] [--only 3B,7] [--out <dir>]
//
// Run after ship.mjs app, from the workspace root: serves app/dist, reads the bare
// plates at /plate/<num>/ (generator/plates.mjs) and writes <out>/<tag>/<id>-{light,dark}.png,
// by default under the atlas's gitignored tmp/shots/. The plate is photographed alone at its natural
// width, not the prose around it; an interactive lane has no `.figure-wrap`, so
// its whole page is the picture. Ids are the plates' own: 3B, 7A, A2, 12i. Read
// every picture you make.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './basis.mjs';
import { APP_DIST, onlyPlates, originOf, plateUrl, platesOf, serveSet } from './plates.mjs';

const ATLAS = fileURLToPath(new URL('../', import.meta.url));
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i !== -1 ? argv[i + 1] : undefined; };
const TAG = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--only' && argv[i - 1] !== '--out') ?? 'shots';
const OUT = join(flag('--out') ?? join(ATLAS, 'tmp', 'shots'), TAG);
mkdirSync(OUT, { recursive: true });

const plates = onlyPlates(platesOf(ATLAS), flag('--only'));
if (!plates.length) throw new Error(`shoot.mjs: no plate matches --only ${flag('--only')}; ids are the plates' own (3B, 7A, A2, 12i)`);
const require = createRequire(join(ROOT, 'tools/embed-heights/package.json'));
const { chromium } = require('playwright');
const server = await serveSet(join(ATLAS, APP_DIST));
const origin = originOf(server);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1700, height: 1200 }, deviceScaleFactor: 1 });
for (const id of plates) {
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(plateUrl(origin, id), { waitUntil: 'load' });
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    const el = (await page.$('.plate .figure-wrap')) ?? (await page.$('.plate'));
    await page.waitForTimeout(el ? 700 : 2500);
    const png = el ? await el.screenshot() : await page.screenshot({ fullPage: true });
    writeFileSync(join(OUT, `${id}-${theme}.png`), png);
  }
  console.log(`shot ${id} → ${OUT}`);
}
await browser.close();
server.close();
