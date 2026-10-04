// CHECK-SCENES — the plates in the round, checked: their glTF binaries read back
// in node, then the BUILT app driven in headless Chromium.
//
//   node www/atlas.lit-ui-router.dev/generator/check-scenes.mjs www/atlas.lit-ui-router.dev [--shots <dir>] [--no-artifact]
//
// Run after build.mjs, the app build and its artifact build. It exits 1 on the first
// failed check and prints one line per check that holds. `--shots` photographs the
// city and the plant in both themes, both lanes and all four corners, and on a phone.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { ROOT } from './basis.mjs';
import { readGlb } from './glb.mjs';
import { BUDGET, CITY_GLB, CROWN_FOOT, DRESS_JS, PLANT_GLB, cityModel } from './city-glb.mjs';
import { BRICKS_GLB, bricksGlb } from './brick-scene.mjs';
import { CITY } from './sheet7.mjs';

const [OUT, ...FLAGS] = process.argv.slice(2);
if (!OUT) throw new Error('usage: node check-scenes.mjs <outdir> [--shots <dir>] [--no-artifact]   (outdir is the one build.mjs was given)');
let shots = null, artifact = true;
for (let i = 0; i < FLAGS.length; i++) {
  if (FLAGS[i] === '--shots') shots = FLAGS[++i];
  else if (FLAGS[i] === '--no-artifact') artifact = false;
  else throw new Error(`check-scenes.mjs: unknown flag ${FLAGS[i]}`);
}

let held = 0;
const ok = (what) => { held += 1; console.log(`ok   ${what}`); };
function check(cond, what, detail = '') {
  if (!cond) throw new Error(`check-scenes: ${what}${detail ? ` — ${detail}` : ''}`);
  ok(what);
}

const PUBLIC = join(OUT, 'app', 'public');
const DIST = normalize(join(OUT, 'app', 'dist'));
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const srgb = (c) => Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
const cityDress = new Function(`${DRESS_JS}\nreturn cityDress;`)();

// ---- node: the binaries ------------------------------------------------------
for (const plant of [false, true]) {
  const tag = plant ? 'plant.glb' : 'city.glb';
  const file = readFileSync(join(PUBLIC, plant ? PLANT_GLB : CITY_GLB));
  const { json } = readGlb(file);
  check(file.equals(cityModel({ plant }).glb), `${tag} is the generator's own bytes`);
  check(file.length <= BUDGET[plant ? 'plant' : 'city'], `${tag} ${file.length.toLocaleString('en-US')} bytes, inside its budget`);
  const names = json.materials.map((m) => m.name);
  check(new Set(names).size === names.length, `${tag} ${names.length} materials, every name unique`);
  check(json.materials.every((m) => m.extensions?.KHR_materials_unlit), `${tag} every material unlit`);
  const prims = json.meshes.flatMap((m) => m.primitives);
  check(prims.every((p) => p.attributes.NORMAL === undefined), `${tag} ${prims.length} primitives, no NORMAL on an unlit model`);
  const nodeByName = new Map(json.nodes.map((n, i) => [n.name, i]));
  for (const b of CITY) {
    if (!nodeByName.has(`mass-${b.n}`) || !names.includes(`frame-${b.n}`)) throw new Error(`check-scenes: ${tag} member ${b.n} lacks its mass node or its frame`);
  }
  ok(`${tag} a mass-n node and a frame-n material per member, ${CITY.length} of each`);
  const variants = json.extensions?.KHR_materials_variants?.variants?.map((v) => v.name) ?? [];
  check(JSON.stringify(variants) === '["test-light"]', `${tag} one variant, test-light`);
  const laneOnly = (i) => /^(cap|wall|hatch)-|^void$/.test(names[i]);
  const unmapped = prims.filter((p) => laneOnly(p.material) && !p.extensions?.KHR_materials_variants);
  check(unmapped.length === 0, `${tag} every lane primitive mapped for test-light`, `${unmapped.length} unmapped`);
  const used = json.extensionsUsed ?? [];
  check(['KHR_materials_unlit', 'KHR_materials_variants', 'KHR_mesh_quantization'].every((e) => used.includes(e))
    && JSON.stringify(json.extensionsRequired) === '["KHR_mesh_quantization"]', `${tag} extensions used and required`);
  const rise = json.animations.find((a) => a.name === 'rise');
  const driven = new Set(rise?.channels.map((c) => json.nodes[c.target.node].name));
  const want = CITY.flatMap((b) => [`mass-${b.n}`, ...(b.sa ? [`annex-${b.n}`] : []), ...(plant && b.tier !== 'off' ? [`crown-${b.n}`] : [])]);
  const missing = want.filter((n) => !driven.has(n));
  check(rise && missing.length === 0, `${tag} the rise clip drives ${want.length} nodes, every mass, annex${plant ? ' and crown' : ''}`, missing.join(', '));
}
const bricks = readFileSync(join(PUBLIC, BRICKS_GLB));
check(bricks.equals(bricksGlb()), `bricks.glb stable, sha256 ${createHash('sha256').update(bricks).digest('hex').slice(0, 12)}`);

// ---- the built app ------------------------------------------------------------
const cityHtml = readFileSync(join(DIST, 'city', 'index.html'), 'utf8');
check(cityHtml.includes('<model-viewer id="cs-viewer"') && (cityHtml.match(/class="cs-pin"/g) ?? []).length === CITY.length
  && cityHtml.includes('id="cs-city"'), `prerendered /city carries the fragment, ${CITY.length} pins and the island`);

const require = createRequire(join(ROOT, 'tools/embed-heights/package.json'));
const { chromium } = require('playwright');

const TYPES = { '.css': 'text/css', '.glb': 'model/gltf-binary', '.html': 'text/html', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  void (async () => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://atlas').pathname);
    let file = normalize(join(DIST, path.endsWith('/') ? `${path}index.html` : path));
    if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  })();
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${String(server.address().port)}`;
if (shots) mkdirSync(shots, { recursive: true });

const browser = await chromium.launch();
const errors = [];
async function open(path, { theme = 'light', reduce = false, viewport = { width: 1400, height: 1000 }, phone = false } = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: phone ? 3 : 1, isMobile: phone, hasTouch: phone });
  page.on('pageerror', (e) => errors.push(`${path}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' || /CONTEXT_LOST|WebGL: INVALID/.test(m.text())) errors.push(`${path}: ${m.text()}`); });
  await page.emulateMedia({ colorScheme: theme, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await page.goto(`${origin}${path}`, { waitUntil: 'load' });
  return page;
}
const settled = (page) => page.evaluate(async () => {
  await new Promise((r) => { const t = () => (window.__cityScene ? r() : setTimeout(t, 50)); t(); });
  await window.__cityScene.ready;
});
const idle = (page) => page.waitForTimeout(400);

// the page's tokens, its island's plan and every material's factor, read in one turn
const materialsOf = (page) => page.evaluate(() => {
  const mv = document.querySelector('#cs-viewer');
  const cs = getComputedStyle(document.documentElement);
  const tok = { paper: '--paper', paper2: '--paper-2', ink: '--ink', soft: '--ink-soft', faint: '--ink-faint', line: '--line',
    accent: '--accent', red: '--red', redHatch: '--red-hatch', green: '--green', halo: '--halo' };
  return {
    tokens: Object.fromEntries(Object.entries(tok).map(([k, v]) => [k, cs.getPropertyValue(v).trim()])),
    M: JSON.parse(document.querySelector('#cs-city').textContent).M,
    factors: Object.fromEntries(mv.model.materials.filter((m) => m.name !== 'Default').map((m) => [m.name, m.pbrMetallicRoughness.baseColorFactor])),
  };
});
const tokenRgb = (v) => {
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(v);
  if (m) return [m[1], m[2], m[3]].map((c) => lin(Number(c) / 255));
  return [1, 3, 5].map((i) => lin(parseInt(v.slice(i, i + 2), 16) / 255));
};
const paletteOf = (tokens) => {
  const c = Object.fromEntries(Object.entries(tokens).filter(([, v]) => v).map(([k, v]) => [k, tokenRgb(v)]));
  return { ...c, black: [0, 0, 0], redHatch: c.redHatch ?? c.red, green: c.green ?? c.accent, halo: c.halo ?? c.accent };
};
function probeMaterials(tag, { tokens, M, factors }, lane) {
  const want = cityDress(paletteOf(tokens), M, lane);
  let n = 0;
  for (const [name, rgb, a] of want) {
    const got = factors[name];
    if (!got) continue;
    const off = Math.max(...rgb.map((v, i) => Math.abs(v - got[i])), Math.abs(a - got[3]));
    if (off > 1e-3) throw new Error(`check-scenes: ${tag} ${name} is [${got.map((v) => v.toFixed(4))}], the dress gives [${[...rgb, a].map((v) => v.toFixed(4))}]`);
    n += 1;
  }
  ok(`${tag}: ${n} materials equal the dress of the page's tokens, ±1e-3 linear`);
  return paletteOf(tokens);
}
// one pixel of the model's own canvas, at a point given in css px within the viewer
const pixel = (page, x, y) => page.evaluate(async ([px, py]) => {
  const mv = document.querySelector('#cs-viewer');
  const img = new Image();
  img.src = mv.toDataURL('image/png');
  await img.decode();
  const k = img.width / mv.getBoundingClientRect().width;
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  return [...g.getImageData(Math.round(px * k), Math.round(py * k), 1, 1).data];
}, [x, y]);
// a pin's point on the viewer, in css px within it
const pinAt = (page, n) => page.evaluate((k) => {
  const h = document.querySelector('#cs-viewer').queryHotspot(`hotspot-${k}`);
  return { x: h.canvasPosition.x, y: h.canvasPosition.y, y3: h.position.y };
}, n);
// the material under a point of the viewer, in css px within it
const materialAt = (page, x, y) => page.evaluate(([px, py]) => {
  const mv = document.querySelector('#cs-viewer');
  const r = mv.getBoundingClientRect();
  return mv.materialFromPoint(r.left + px, r.top + py)?.name ?? null;
}, [x, y]);
const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
// the pixel under a point is its material's factor through the sRGB output, graded by COLOR_0
// between `foot` and 1; `want` names the material the point must land on
async function probePixel(page, tag, x, y, want, dress, foot = 1) {
  const name = await materialAt(page, x, y);
  check(want.test(name ?? ''), `${tag} lands on ${name}`, `wanted ${want}`);
  const factor = dress.find((r) => r[0] === name)[1];
  const got = await pixel(page, x, y);
  const hi = factor.map(srgb), lo = factor.map((v) => srgb(v * foot));
  check(got.slice(0, 3).every((v, i) => v <= hi[i] + 2 && v >= lo[i] - 2), `${tag}: its pixel is ${name}'s factor in sRGB ±2${foot < 1 ? `, shaded down to ${foot}` : ''}`, `${got} vs ${lo}..${hi}`);
  return got;
}

try {
  // ---- network: the sheet fetches neither the element nor a model; the city fetches its model once ----
  {
    const page = await browser.newPage();
    const asked = [];
    page.on('request', (r) => asked.push(r.url()));
    await page.goto(`${origin}/sheet/7/`, { waitUntil: 'networkidle' });
    check(!asked.some((u) => /model-viewer|\.glb$/.test(u)), '/sheet/7 fetches neither model-viewer nor a GLB');
    asked.length = 0;
    await page.goto(`${origin}/city/`, { waitUntil: 'load' });
    await settled(page);
    await page.waitForLoadState('networkidle');
    const glbs = asked.filter((u) => /\.glb$/.test(u));
    check(glbs.length === 1 && glbs[0].endsWith('/models/city.glb'), '/city fetches city.glb once', glbs.join(', '));
    await page.close();
  }

  for (const id of ['city', 'plant']) {
    for (const theme of ['light', 'dark']) {
      const page = await open(`/${id}/`, { theme });
      await settled(page);
      await idle(page);
      const tag = `/${id} ${theme}`;
      const pal = probeMaterials(`${tag} tier lane`, await materialsOf(page), 'tier');
      // under member 1's pin: the city shows its cap, line tier, no roof wash; the plant, its crown
      await page.evaluate(() => window.__cityScene.photo());
      const p1 = await pinAt(page, 1);
      const crown = /^(plant-|lamp-|band-)/, foot = id === 'plant' ? CROWN_FOOT : 1;
      await probePixel(page, `${tag} under member 1's pin`, p1.x, p1.y + 22, id === 'plant' ? crown : /^cap-line$/, cityDress(pal, (await materialsOf(page)).M, 'tier'), foot);
      await page.locator('#cs-lane').check();
      await page.waitForFunction(() => document.querySelector('#cs-viewer').variantName === 'test-light');
      await page.waitForTimeout(600);
      const lit = await materialsOf(page);
      probeMaterials(`${tag} test-light lane`, lit, 'light');
      await probePixel(page, `${tag} test-light, under member 1's pin`, p1.x, p1.y + 22, id === 'plant' ? crown : /^L-b1-cap$/, cityDress(pal, lit.M, 'light'), foot);
      const p34 = await pinAt(page, 34);
      const shadow = await pixel(page, p34.x, p34.y + 14);
      const paper = pal.paper.map(srgb);
      check(lum(shadow) < lum(paper), `${tag} test-light: under member 34's pin, a shadow stands darker than the paper (${await materialAt(page, p34.x, p34.y + 14)})`, `${shadow} vs ${paper}`);
      if (shots) {
        await page.evaluate(() => { for (const el of document.querySelectorAll('#cs-viewer [slot^="hotspot-"]')) el.style.visibility = ''; });
        for (const lane of ['tier', 'light']) {
          if (lane === 'tier') await page.locator('#cs-lane').uncheck();
          else await page.locator('#cs-lane').check();
          for (const az of [45, 135, 225, 315]) {
            await page.click(`[data-az="${az}"]`);
            await page.waitForTimeout(1600);
            await page.locator('#cs-stage').screenshot({ path: join(shots, `${id}-${theme}-${lane}-${az}.png`) });
          }
        }
      }
      if (theme === 'light') {
        // a live theme turn retints every material to the other theme's tokens
        await page.locator('#cs-lane').uncheck();
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
        await page.waitForTimeout(500);
        const turned = await materialsOf(page);
        check(turned.tokens.paper !== lit.tokens.paper, `${tag}: the theme turn moves the tokens`);
        probeMaterials(`${tag} turned dark`, turned, 'tier');
      }
      await page.close();
    }
  }

  // ---- pins, keys, picking, corners, clip, fill, wheel ------------------------------
  {
    const page = await open('/city/');
    await settled(page);
    await idle(page);
    const counts = await page.evaluate(() => ({ pins: document.querySelectorAll('#cs-viewer .cs-pin').length, labels: document.querySelectorAll('#cs-viewer .cs-dist').length }));
    check(counts.pins === CITY.length && counts.labels === 4, `${counts.pins} pins and ${counts.labels} district labels as hotspots`);
    await page.click('[slot="hotspot-2"]');
    await page.waitForFunction(() => new URLSearchParams(location.search).get('focus') === '2');
    const after = await page.evaluate(() => ({
      pinned: window.__cityScene.pinned(), panel: window.__cityScene.panel(),
      frame: document.querySelector('#cs-viewer').model.getMaterialByName('frame-2').pbrMetallicRoughness.baseColorFactor,
      accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    }));
    const accent = tokenRgb(after.accent);
    check(after.pinned === 2 && after.panel.includes('ui-router-server'), 'a pin click pins its member, ?focus=2, and the panel reads it');
    check(accent.every((v, i) => Math.abs(v - after.frame[i]) < 1e-3), "the pinned member's frame wears the accent");
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => new URLSearchParams(location.search).get('focus') === '3');
    check(await page.evaluate(() => window.__cityScene.pinned()) === 3, '→ steps the pin to the next member and the url follows');
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => window.__cityScene.pinned() === 2);
    ok('← steps it back');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__cityScene.pinned() === null && !new URLSearchParams(location.search).has('focus'));
    ok('Escape clears the pin and the url');

    // picking: a hover over member 1's cap reads it, a tap on open ground clears a pin
    const box = await page.locator('#cs-viewer').boundingBox();
    const p1 = await pinAt(page, 1);
    await page.mouse.move(box.x + p1.x, box.y + p1.y + 22);
    await page.waitForFunction(() => window.__cityScene.hovered() === 1);
    ok('a hover over a cap reads its member');
    await page.mouse.click(box.x + p1.x, box.y + p1.y + 22);
    await page.waitForFunction(() => window.__cityScene.pinned() === 1);
    ok('a tap on a cap pins its member');
    check(await materialAt(page, 30, 30) === null, "the viewer's top-left corner is open paper");
    await page.mouse.click(box.x + 30, box.y + 30);
    await page.waitForFunction(() => window.__cityScene.pinned() === null);
    ok('a tap off the masses clears the pin');

    // corners
    for (const az of [135, 225, 315, 45]) {
      await page.click(`[data-az="${az}"]`);
      await page.waitForFunction((a) => {
        const o = document.querySelector('#cs-viewer').getCameraOrbit();
        const d = Math.abs(((o.theta * 180) / Math.PI - a + 540) % 360 - 180);
        return d < 0.05 && Math.abs((o.phi * 180) / Math.PI - 54.736) < 0.05;
      }, az, { timeout: 10000 });
      ok(`the ${az}° corner lands at theta ${az}°, phi 54.736°`);
    }

    // the clip: ground at 0, the caps at the end
    check(JSON.stringify(await page.evaluate(() => window.__cityScene.animations())) === '["rise"]', 'availableAnimations is ["rise"]');
    const row1 = CITY.find((b) => b.n === 1);
    await page.evaluate(() => window.__cityScene.pose(0));
    const low = (await pinAt(page, 1)).y3;
    await page.evaluate((e) => window.__cityScene.pose(e), cityModel({ plant: false }).layout.end);
    const high = (await pinAt(page, 1)).y3;
    check(Math.abs(low - (14 + row1.h * 0.001)) < 0.05 && Math.abs(high - (14 + row1.h)) < 0.05, `pose(0) stands the pins on the ground, pose(end) on the caps (member 1: ${low.toFixed(2)} → ${high.toFixed(2)})`);

    // the wheel gate: a plain scroll scrolls the page; once the stage is engaged, the wheel zooms
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => document.querySelector('#cs-stage').scrollIntoView({ block: 'center' }));
    const before = await page.evaluate(() => ({ y: window.scrollY, r: document.querySelector('#cs-viewer').getCameraOrbit().radius }));
    await page.mouse.move(box.x + box.width / 2, 300);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(500);
    const scrolled = await page.evaluate(() => ({ y: window.scrollY, r: document.querySelector('#cs-viewer').getCameraOrbit().radius }));
    check(scrolled.y > before.y && Math.abs(scrolled.r - before.r) < 1e-3, 'an unengaged wheel scrolls the page and leaves the camera');
    await page.evaluate(() => document.querySelector('#cs-viewer').scrollIntoView({ block: 'center' }));
    const vb = await page.locator('#cs-viewer').boundingBox();
    await page.mouse.move(vb.x + 20, Math.max(vb.y, 0) + 20);
    await page.mouse.down();
    await page.mouse.up();
    const y0 = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(800);
    const zoomed = await page.evaluate(() => ({ y: window.scrollY, r: document.querySelector('#cs-viewer').getCameraOrbit().radius }));
    check(zoomed.y === y0 && Math.abs(zoomed.r - scrolled.r) > 1, 'an engaged wheel zooms and the page holds', `scrollY ${y0} → ${zoomed.y}, radius ${scrolled.r} → ${zoomed.r}`);

    // dots: pulled back, the unpinned pins fold
    await page.evaluate(() => { const mv = document.querySelector('#cs-viewer'); mv.cameraOrbit = '45deg 54.736deg 160%'; mv.fieldOfView = '20deg'; mv.jumpCameraToGoal(); });
    await page.waitForFunction(() => document.querySelector('#cs-stage').classList.contains('far'));
    const dot = await page.evaluate(() => document.querySelector('[slot="hotspot-5"]').getBoundingClientRect().width);
    check(dot <= 10, `pulled back, the unpinned pins fold to ${dot}px dots`);

    // fill
    await page.click('#cs-stage .fill');
    await page.waitForTimeout(600);
    const fill = await page.evaluate(() => ({ h: document.querySelector('#cs-viewer').getBoundingClientRect().height, wh: window.innerHeight }));
    check(Math.abs(fill.h - (fill.wh - 92)) < 2, `filled, the viewer stands ${fill.h}px in a ${fill.wh}px window`);
    await page.close();
  }

  // ---- a url pin opens pinned and framed ----
  {
    const page = await open('/city/?focus=12');
    await settled(page);
    await page.waitForTimeout(1500);
    const s = await page.evaluate(() => ({ pinned: window.__cityScene.pinned(), target: window.__cityScene.target(), on: document.querySelector('[slot="hotspot-12"]').classList.contains('on') }));
    const centre = cityModel({ plant: false }).layout.members.find((m) => m.n === 12).centre;
    const target = s.target.split(' ').map(parseFloat);
    check(s.pinned === 12 && s.on && target.every((v, i) => Math.abs(v - centre[i]) < 0.5), '/city?focus=12 opens pinned and framed on member 12', s.target);
    await page.close();
  }

  // ---- reduced motion: the clip and the corners land at once ----
  {
    const page = await open('/city/', { reduce: true });
    await settled(page);
    await page.click('#cs-play');
    check(await page.evaluate(() => window.__cityScene.time()) === 0, 'under reduced motion GROUND lands at once');
    await page.click('[data-az="225"]');
    const theta = await page.evaluate(() => (document.querySelector('#cs-viewer').getCameraOrbit().theta * 180) / Math.PI);
    check(Math.abs(((theta - 225 + 540) % 360) - 180) < 0.05, 'under reduced motion a corner lands at once');
    await page.close();
  }

  // ---- lifecycle: the plates come and go without leaking ----
  {
    const page = await open('/city/');
    await settled(page);
    for (let i = 0; i < 10; i++) {
      await page.click('a[href="/sheet/7"]');
      await page.waitForFunction(() => location.pathname.startsWith('/sheet/7') && !window.__cityScene);
      await page.click('a[href="/plant"]');
      await page.waitForFunction(() => location.pathname.startsWith('/plant') && window.__cityScene && window.__cityScene.plant);
      await settled(page);
    }
    check(await page.evaluate(() => document.querySelectorAll('model-viewer').length) === 1, '/city → /sheet/7 → /plant ×10: one viewer, the hook leaves with each plate');
    await page.close();
  }

  // ---- the phone ----
  {
    const page = await open('/city/', { viewport: { width: 390, height: 844 }, phone: true });
    await settled(page);
    await page.waitForTimeout(1500);
    const s = await page.evaluate(() => ({ far: document.querySelector('#cs-stage').classList.contains('far'), scroll: document.documentElement.scrollWidth, w: window.innerWidth }));
    check(s.far && s.scroll <= s.w, `on a phone the pins fold to dots and the page keeps its width (${s.scroll} ≤ ${s.w})`);
    if (shots) await page.locator('#cs-stage').screenshot({ path: join(shots, 'city-phone.png') });
    await page.close();
  }

  // ---- the artifact raises the city offline ----
  if (artifact) {
    const file = join(OUT, 'app', 'dist-artifact', 'index.html');
    if (!existsSync(file)) throw new Error('check-scenes: no artifact build — run `npm --prefix www/atlas.lit-ui-router.dev/app run build:artifact`, or pass --no-artifact');
    const size = statSync(file).size;
    check(size <= 16 * 1024 * 1024, `the artifact is ${(size / 1048576).toFixed(2)} MB, inside 16 MB`);
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(`artifact: ${e.message}`));
    await page.route(/^https?:/, (route) => route.abort());
    await page.goto(`file://${resolve(file)}#/city`);
    await settled(page);
    check(await page.evaluate(() => window.__cityScene.animations().length === 1), '#/city in the artifact raises the city with the network blocked');
    await page.close();
  }

  check(errors.length === 0, 'no page errors and no WebGL errors', errors.join(' | '));
} finally {
  await browser.close();
  server.close();
}
console.log(`check-scenes: ${held} checks hold`);
