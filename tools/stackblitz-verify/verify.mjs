#!/usr/bin/env node
// Verifies the examples/* StackBlitz projects boot, render, and route for a
// given branch: opens stackblitz.com/github/<repo>/tree/<branch>/examples/<name>,
// waits out the WebContainer boot (in-browser npm install + vite dev), then
// reads the preview frame, exercises per-example router navigation, and saves
// screenshots to ./out.
//
// Usage: node verify.mjs <branch> [example ...]   (default: all examples)
//        --bundled  use Playwright's bundled Chromium instead of system Chrome
//
// Runs against public URLs only; needs network and a local Chrome install.
// Playwright's bundled Chromium hangs at StackBlitz's import screen (the
// wss://stackblitz.com/cable handshake 404s), so system Chrome is the default.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO = 'simshanith/lit-ui-router';
const EXAMPLES = ['helloworld', 'hellosolarsystem', 'hellogalaxy'];
const BOOT_TIMEOUT_MS = 6 * 60 * 1000;
const IMPORT_STALL_MS = 2.5 * 60 * 1000;
const ATTEMPTS = 2;

const args = process.argv.slice(2).filter((a) => a !== '--bundled');
const useBundled = process.argv.includes('--bundled');
const [branch, ...names] = args;
if (!branch) {
  console.error('Usage: node verify.mjs <branch> [example ...] [--bundled]');
  process.exit(1);
}
const targets = names.length ? names : EXAMPLES;
const outDir = join(dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// Deep text extraction: pierce shadow roots (lit renders into shadow DOM).
async function frameText(frame) {
  try {
    return await frame.evaluate(() => {
      function walk(node, out) {
        if (node.nodeType === Node.TEXT_NODE) {
          const t = node.textContent.trim();
          if (t) out.push(t);
          return;
        }
        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          for (const c of node.childNodes) walk(c, out);
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
        if (
          node.id === 'uirStateVisualizer' ||
          node.id === 'uirTransitionVisualizer'
        ) {
          out.push('[visualizer overlay present]');
          return;
        }
        if (node.shadowRoot) walk(node.shadowRoot, out);
        for (const c of node.childNodes) walk(c, out);
      }
      const out = [];
      if (document.body) walk(document.body, out);
      return out.join('\n');
    });
  } catch {
    return null; // cross-origin or detached
  }
}

async function terminalText(page) {
  try {
    const texts = await page.locator('.xterm-rows').allInnerTexts();
    return texts
      .join('\n---\n')
      .replace(/\u00a0/g, ' ')
      .trim();
  } catch {
    return '';
  }
}

// The app preview lives on *.local-credentialless / webcontainer origins.
async function findPreviewFrame(page) {
  const candidates = page
    .frames()
    .filter(
      (f) =>
        /webcontainer|credentialless/i.test(f.url()) &&
        !/stackblitz\.com/.test(f.url()),
    );
  let best = null;
  for (const f of candidates) {
    const t = await frameText(f);
    if (t && t.trim().length > 10) return { frame: f, text: t };
    if (!best) best = { frame: f, text: t };
  }
  return best;
}

async function deepModelViewerState(frame) {
  return frame.evaluate(() => {
    function deepFind(root, sel) {
      const hit = root.querySelector && root.querySelector(sel);
      if (hit) return hit;
      const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
      for (const el of all) {
        if (el.shadowRoot) {
          const r = deepFind(el.shadowRoot, sel);
          if (r) return r;
        }
      }
      return null;
    }
    const el = deepFind(document, 'model-viewer');
    if (!el) return { present: false };
    return {
      present: true,
      src: el.getAttribute('src'),
      loaded: !!el.loaded,
      modelIsVisible: !!el.modelIsVisible,
      hasCanvas: !!(el.shadowRoot && el.shadowRoot.querySelector('canvas')),
    };
  });
}

async function clickAndReport(preview, page, locator, label, screenshot) {
  await locator.click({ timeout: 15000 });
  await sleep(3000);
  console.log(`\n=== AFTER CLICK ${label}: frame URL ===\n` + preview.url());
  console.log(((await frameText(preview)) || '').slice(0, 2500));
  if (screenshot) await page.screenshot({ path: screenshot });
}

// Per-example router-navigation checks, run inside the preview frame.
const NAV_CHECKS = {
  helloworld: async (preview, page, shot) => {
    await clickAndReport(
      preview,
      page,
      preview.locator('a', { hasText: 'About' }).first(),
      'About',
      shot('detail'),
    );
  },
  hellosolarsystem: async (preview, page, shot) => {
    await clickAndReport(
      preview,
      page,
      preview.locator('a', { hasText: 'Mars' }).first(),
      'Mars',
      shot('detail'),
    );
    await clickAndReport(
      preview,
      page,
      preview.locator('a', { hasText: /back/i }).first(),
      'Back',
      null,
    );
  },
  hellogalaxy: async (preview, page, shot) => {
    await clickAndReport(
      preview,
      page,
      preview.locator('a', { hasText: 'Sirius' }).first(),
      'Sirius',
      shot('detail'),
    );
    await clickAndReport(
      preview,
      page,
      preview.locator('a', { hasText: /astronaut/i }).first(),
      'Astronaut',
      null,
    );
    await sleep(12000); // model-viewer chunk + remote .glb fetch
    const mv = await deepModelViewerState(preview);
    console.log('\n=== MODEL-VIEWER STATE ===\n' + JSON.stringify(mv));
    if (!mv.loaded) throw new Error('model-viewer did not load the model');
  },
};

async function verifyExample(browser, name) {
  const url = `https://stackblitz.com/github/${REPO}/tree/${branch}/examples/${name}`;
  const shot = (suffix) =>
    join(outDir, `sb-${name}${suffix ? '-' + suffix : ''}.png`);
  const context = await browser.newContext({
    viewport: { width: 1680, height: 1000 },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 300)));

  log('goto', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

  let preview = null;
  let previewText = null;
  let lastTerm = '';
  const start = Date.now();
  const deadline = start + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(8000);
    const term = await terminalText(page);
    if (term && term !== lastTerm) {
      const tail = term
        .split('\n')
        .filter((l) => l.trim())
        .slice(-4)
        .join(' | ');
      log('terminal tail:', tail.slice(0, 240));
      lastTerm = term;
    }
    const found = await findPreviewFrame(page);
    if (found) {
      preview = found.frame;
      if (found.text && found.text.trim().length > 10) {
        previewText = found.text;
        break;
      }
    }
    // StackBlitz sometimes wedges at the import screen (its cable websocket
    // 404s); with no editor terminal and no app frame by now, waiting out the
    // full boot timeout is pointless — bail so the caller can retry fresh.
    if (!preview && !lastTerm && Date.now() - start > IMPORT_STALL_MS) {
      log('no import progress — aborting attempt early');
      break;
    }
  }

  console.log('\n=== TERMINAL ===');
  console.log((lastTerm || '(no terminal text captured)').slice(-3000));

  let navOk = true;
  if (preview && previewText) {
    console.log('\n=== PREVIEW FRAME URL ===\n' + preview.url());
    console.log('\n=== PREVIEW TEXT (initial) ===');
    console.log(previewText.slice(0, 3000));
    const check = NAV_CHECKS[name];
    if (check) {
      try {
        await sleep(3000);
        await check(preview, page, shot);
      } catch (e) {
        navOk = false;
        console.log('\n[navigation check failed] ' + String(e).slice(0, 500));
      }
    }
  } else {
    console.log('\nNo readable preview frame appeared. Frames:');
    page.frames().forEach((f) => console.log('  ', f.url().slice(0, 160)));
  }

  await page.screenshot({ path: shot('') });
  log('screenshot saved', shot(''));
  console.log(`\n=== TOP-PAGE CONSOLE ERRORS (${consoleErrors.length}) ===`);
  consoleErrors.slice(0, 20).forEach((e) => console.log(e));
  await context.close();

  const ok = !!previewText && navOk;
  console.log(`\n${name}: ${ok ? 'PASS' : 'FAIL'}`);
  return ok;
}

const browser = await chromium.launch(
  useBundled ? { headless: true } : { headless: true, channel: 'chrome' },
);
let failures = 0;
for (const name of targets) {
  let ok = false;
  for (let attempt = 1; attempt <= ATTEMPTS && !ok; attempt++) {
    console.log(
      `\n########## ${name} @ ${branch} (attempt ${attempt}/${ATTEMPTS}) ##########`,
    );
    ok = await verifyExample(browser, name);
  }
  if (!ok) failures++;
}
await browser.close();
console.log(`\nRESULT: ${failures ? `${failures} FAILED` : 'ALL PASS'}`);
process.exit(failures ? 2 : 0);
