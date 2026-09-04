// Measures a built example the way the docs embed sees it: served at its
// production base (`/examples/<name>/`), laid out at the docs content column,
// and walked through every state its own links reach — the reservation has to
// cover the tallest one, because the iframe's height is fixed once painted.

import { readFile, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';
import type { AddressInfo } from 'node:net';
import { chromium, type Page } from 'playwright';

import { COLUMN_WIDTH_PX } from './reserve.core.ts';

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

/** Viewport height only decides what is on screen; content height is measured in flow. */
const VIEWPORT_HEIGHT_PX = 900;
/** Enough states for the tutorials' nested lists; a runaway crawl is a bug, not a wait. */
const MAX_STATES = 60;
const SETTLE_POLL_MS = 100;
const SETTLE_SAMPLES = 3;
const SETTLE_TIMEOUT_MS = 8000;

/** Serves `examples/<name>/dist` at `/examples/<name>/`, as the docs site does. */
export async function serveExamples(examplesDir: string): Promise<Server> {
  const server = createServer((req, res) => {
    void (async () => {
      const path = decodeURIComponent(
        new URL(req.url ?? '/', 'http://embed').pathname,
      );
      const match = /^\/examples\/([\w-]+)(\/.*)?$/.exec(path);
      const rest = match?.[2] && match[2] !== '/' ? match[2] : '/index.html';
      const file = match
        ? normalize(join(examplesDir, match[1], 'dist', rest))
        : undefined;
      if (!file || !file.startsWith(examplesDir)) {
        res.writeHead(404).end('not found');
        return;
      }
      try {
        if (!(await stat(file)).isFile()) throw new Error('not a file');
        res.writeHead(200, {
          'content-type':
            CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
        });
        res.end(await readFile(file));
      } catch {
        res.writeHead(404).end('not found');
      }
    })();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

export function serverOrigin(server: Server): string {
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

/**
 * Content height in flow — not `scrollHeight`, which floors at the viewport and
 * so reports the frame back to itself.
 */
function contentHeight(): number {
  const root = document.documentElement;
  const body = document.body;
  const marginBottom =
    Number.parseFloat(getComputedStyle(body).marginBottom) || 0;
  const flow =
    body.getBoundingClientRect().bottom + window.scrollY + marginBottom;
  const overflow =
    root.scrollHeight > root.clientHeight ? root.scrollHeight : 0;
  return Math.ceil(Math.max(flow, overflow));
}

/** Every in-page hash link, shadow roots included: uiSref writes hrefs onto host elements too. */
function hashLinks(): string[] {
  const found = new Set<string>();
  const walk = (root: Document | ShadowRoot) => {
    for (const el of root.querySelectorAll('*')) {
      const href = el.getAttribute('href');
      if (href?.startsWith('#') && href !== '#') found.add(href);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  return [...found];
}

async function settledHeight(page: Page): Promise<number> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  let last = -1;
  let stable = 0;
  while (Date.now() < deadline) {
    const height = await page.evaluate(contentHeight);
    if (height === last) {
      if (++stable >= SETTLE_SAMPLES) return height;
    } else {
      stable = 0;
      last = height;
    }
    await page.waitForTimeout(SETTLE_POLL_MS);
  }
  return last;
}

export interface StateHeight {
  state: string;
  height: number;
}

export interface Measurement {
  /** Tallest state, which is what the embed has to reserve for. */
  height: number;
  tallest: string;
  states: StateHeight[];
}

/**
 * Loads `/examples/<name>/`, then walks its hash states breadth-first and
 * measures each. Hash navigation (not reload) mirrors the embed: one boot, the
 * router swapping views under it.
 */
export async function measureExamples(
  origin: string,
  names: readonly string[],
): Promise<Map<string, Measurement>> {
  // Classic scrollbars would eat into the column and rewrap the content we
  // are measuring; a correctly reserved embed never shows one anyway.
  const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  try {
    const results = new Map<string, Measurement>();
    for (const name of names) {
      const page = await browser.newPage({
        viewport: { width: COLUMN_WIDTH_PX, height: VIEWPORT_HEIGHT_PX },
      });
      try {
        await page.goto(`${origin}/examples/${name}/`, { waitUntil: 'load' });
        const seen = new Set<string>();
        const queue: string[] = [''];
        const states: StateHeight[] = [];
        while (queue.length > 0 && states.length < MAX_STATES) {
          const state = queue.shift()!;
          if (seen.has(state)) continue;
          seen.add(state);
          if (state)
            await page.evaluate((hash) => (location.hash = hash), state);
          states.push({
            state: state || '(initial)',
            height: await settledHeight(page),
          });
          for (const href of await page.evaluate(hashLinks)) {
            if (!seen.has(href)) queue.push(href);
          }
        }
        states.sort(
          (a, b) => b.height - a.height || a.state.localeCompare(b.state),
        );
        const tallest = states[0];
        results.set(name, {
          height: tallest.height,
          tallest: tallest.state,
          states,
        });
      } finally {
        await page.close();
      }
    }
    return results;
  } finally {
    await browser.close();
  }
}
