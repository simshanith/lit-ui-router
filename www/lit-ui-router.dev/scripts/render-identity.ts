#!/usr/bin/env node
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

import { RENDERED_IMAGES } from '../.vitepress/identity.ts';

// Renders the SVG sources in scripts/identity/ to the PNGs public/ serves.

const ROOT = join(import.meta.dirname, '..');

const main = async (): Promise<void> => {
  const browser = await chromium.launch();

  try {
    for (const [source, { path, width, height }] of Object.entries(
      RENDERED_IMAGES,
    )) {
      const page = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 1,
      });

      await page.goto(
        pathToFileURL(join(ROOT, 'scripts/identity', source)).href,
      );

      const unloaded = await page.evaluate(async () => {
        await document.fonts.ready;

        return [...document.fonts].flatMap((font) =>
          font.status === 'loaded' ? [] : [font.family],
        );
      });

      if (unloaded.length > 0) {
        console.error(`${source}: fonts not loaded: ${unloaded.join(', ')}`);
        process.exitCode = 1;

        return;
      }

      await page.screenshot({ path: join(ROOT, 'public', path) });
      await page.close();
      console.log(`${source} -> public${path}`);
    }
  } finally {
    await browser.close();
  }
};

if (import.meta.main) await main();
