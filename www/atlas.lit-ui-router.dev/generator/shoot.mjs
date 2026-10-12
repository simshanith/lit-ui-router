// SHOOT — a full-resolution photograph of every emitted plate, light and dark.
//
//   node www/atlas.lit-ui-router.dev/generator/shoot.mjs [tag] [--only 3B,7] [--out <dir>]
//
// Run after build.mjs, from the workspace root: reads the standalone pages under
// tmp/flat/ and writes <out>/<tag>/<id>-{light,dark}.png, by default under the
// atlas's gitignored tmp/shots/. The plate is photographed alone at its natural
// width, not the prose around it; an interactive lane has no `.figure-wrap`, so
// its whole page is the picture. Ids are the plates' own: 3B, 7A, A2, 12i. Read
// every picture you make.
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './basis.mjs';
import { FLAT_DIR } from './thumb-spec.mjs';

const ATLAS = fileURLToPath(new URL('../', import.meta.url));
const FLAT = join(ATLAS, FLAT_DIR);
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i !== -1 ? argv[i + 1] : undefined; };
const TAG = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--only' && argv[i - 1] !== '--out') ?? 'shots';
const ONLY = flag('--only') ? new Set(flag('--only').split(',')) : null;
const OUT = join(flag('--out') ?? join(ATLAS, 'tmp', 'shots'), TAG);
mkdirSync(OUT, { recursive: true });

const files = readdirSync(FLAT).filter((f) => /^sheet-.*\.html$/.test(f)).sort()
  .filter((f) => !ONLY || ONLY.has(f.split('-')[1]));
if (!files.length) throw new Error(`shoot.mjs: no plate matches --only ${flag('--only')}; ids are the plates' own (3B, 7A, A2, 12i)`);
const require = createRequire(join(ROOT, 'tools/embed-heights/package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1700, height: 1200 }, deviceScaleFactor: 1 });
for (const f of files) {
  const id = f.replace(/^sheet-/, '').replace(/-.*$/, '');
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(`file://${join(FLAT, f)}`, { waitUntil: 'load' });
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    const el = (await page.$('.plate .figure-wrap')) ?? (await page.$('.art')) ?? (await page.$('.plate'));
    await page.waitForTimeout(el ? 700 : 2500);
    const png = el ? await el.screenshot() : await page.screenshot({ fullPage: true });
    writeFileSync(join(OUT, `${id}-${theme}.png`), png);
  }
  console.log(`shot ${id} → ${OUT}`);
}
await browser.close();
