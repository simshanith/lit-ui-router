// Photographs card.html into app/public/brand: card-light.webp and card-dark.webp at 1200 x 630 @2x, card.png (dark, @1x) for og:image.
// usage: node render-card.mjs <carddir> [--port 4975]   <carddir> holds the card.html build-card.mjs wrote.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from '../../basis.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT = join(HERE, '..', '..', '..', 'app', 'public', 'brand');
const W = 1200;
const H = 630;
/** WebP's lossy quality, Chromium's own encoder as thumbs.mjs uses it; the figure's pair stays under WEBP_MAX each. */
const QUALITY = 0.9;
const WEBP_MAX = 300 * 1024;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml' };

// playwright is reached through @tools/embed-heights, as thumbs.mjs reaches it
const require = createRequire(join(ROOT, 'tools/embed-heights/package.json'));

function serve(dir, port) {
  const server = createServer((req, res) => {
    void (async () => {
      const path = decodeURIComponent(new URL(req.url ?? '/', 'http://card').pathname);
      const file = normalize(join(dir, path.endsWith('/') ? `${path}card.html` : path));
      if (!file.startsWith(dir)) {
        res.writeHead(403).end('no');
        return;
      }
      try {
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
        res.end(await readFile(file));
      } catch {
        res.writeHead(404).end('not found');
      }
    })();
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function shoot(browser, origin, theme, scale) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: scale, colorScheme: theme });
  const page = await ctx.newPage();
  await page.goto(`${origin}/card.html?theme=${theme}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const faces = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
  const png = await page.screenshot({ type: 'png' });
  const webp = Buffer.from(
    await page.evaluate(
      async ([data, w, h, q]) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(bitmap, 0, 0);
        return canvas.toDataURL('image/webp', q).slice('data:image/webp;base64,'.length);
      },
      [png.toString('base64'), W * scale, H * scale, QUALITY],
    ),
    'base64',
  );
  await ctx.close();
  return { png, webp, faces: [...new Set(faces)].join(', ') };
}

async function main() {
  const [dir, ...flags] = process.argv.slice(2);
  const port = Number(flags[flags.indexOf('--port') + 1] || 4975);
  if (!dir || flags.some((f) => f.startsWith('--') && f !== '--port')) {
    console.error('usage: node render-card.mjs <carddir> [--port 4975]');
    process.exitCode = 1;
    return;
  }
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error('render-card: playwright is missing — run `mise exec -- pnpm install` at the repo root first');
    process.exitCode = 1;
    return;
  }
  mkdirSync(OUT, { recursive: true });
  const server = await serve(normalize(dir), port);
  const origin = `http://127.0.0.1:${String(port)}`;
  const browser = await chromium.launch();
  const written = [];
  for (const theme of ['light', 'dark']) {
    const shot = await shoot(browser, origin, theme, 2);
    const file = join(OUT, `card-${theme}.webp`);
    await writeFile(file, shot.webp);
    written.push(`${file} ${String(shot.webp.length)} bytes (${shot.faces})`);
    if (shot.webp.length > WEBP_MAX) process.exitCode = 1;
  }
  const share = await shoot(browser, origin, 'dark', 1);
  const png = join(OUT, 'card.png');
  await writeFile(png, share.png);
  written.push(`${png} ${String(share.png.length)} bytes (${share.faces})`);
  await browser.close();
  server.close();
  console.log(written.join('\n'));
  if (process.exitCode) console.error(`render-card: a WebP is over ${String(WEBP_MAX)} bytes — lower QUALITY`);
}

if (import.meta.main) main();
