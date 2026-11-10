// A real `vite build` of a Lit app through lit-ui-router-ssr/vite, run twice in this vitest process, whose --conditions include `development`.
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { element, outline, parseMarkup } from '@tools/lit-test-env/ssr-tree.ts';
import type { Element } from '@tools/lit-test-env/ssr-tree.ts';
import { build } from 'vite';
import { createServerRouter } from 'ui-router-server';

import { serverRouterPlugin } from '../vite.js';
import { mounts } from './vite-build/routes.js';

const root = path.join(import.meta.dirname, 'vite-build');

const outDirs: string[] = [];

afterAll(() =>
  Promise.all(outDirs.map((dir) => rm(dir, { recursive: true, force: true }))),
);

const buildSite = async (entry: string): Promise<string> => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'lit-ui-router-ssr-vite-'));
  outDirs.push(outDir);

  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    build: { outDir, emptyOutDir: true },
    plugins: [
      serverRouterPlugin(createServerRouter({ mounts }), {
        prerender: entry,
      }),
    ],
  });

  return outDir;
};

const page = (outDir: string, file: string): Promise<string> =>
  readFile(path.join(outDir, file), 'utf8');

const routedView = async (outDir: string, file: string): Promise<Element> =>
  element(parseMarkup(await page(outDir, file)), 'ui-view');

/** The outline of `node`, whitespace-only text left out. */
const labels = (node: Element): string[] =>
  outline(node).filter((label) => label.trim() !== '');

describe('lit-ui-router-ssr/vite serverRouterPlugin', () => {
  it('prerenders each routed <ui-view> from a script with static imports', async () => {
    const outDir = await buildSite('./prerender.ts');

    const files = (await readdir(outDir, { recursive: true })).filter(
      (file) => !file.startsWith('assets'),
    );

    expect(files.sort()).toEqual([
      '404.html',
      '_redirects',
      'about',
      'about/index.html',
      'index.html',
    ]);

    const home = await routedView(outDir, 'index.html');
    expect(labels(home)).toEqual([
      expect.stringMatching(/^<!--lit-part /),
      '<h1>',
      '<!--served:lit-node 1-->',
      '<hello-card>',
      '<!--/lit-part-->',
    ]);
    expect(outline(element(home, 'h1'))).toEqual(['Home']);
    const card = element(home, 'hello-card');
    expect(card.attrs).toEqual([{ name: 'defer-hydration', value: '' }]);
    expect(outline(card)).toEqual([]);
    expect(
      outline(element(await routedView(outDir, 'about/index.html'), 'h1')),
    ).toEqual(['About']);
    expect(
      outline(element(await routedView(outDir, '404.html'), 'h1')),
    ).toEqual(['Not found']);
    expect(await page(outDir, '_redirects')).toBe(
      '/legacy /about 302\n/legacy/ /about 302\n',
    );
  });

  it('prerenders again in the same process, leaving none of the shim in its globals', async () => {
    const [first, second] = [
      await buildSite('./prerender.ts'),
      await buildSite('./prerender.ts'),
    ];

    const strip = (html: string) => html.replaceAll(/assets\/[^"]+/g, '');

    expect(strip(await page(second, 'index.html'))).toBe(
      strip(await page(first, 'index.html')),
    );
    expect('document' in globalThis).toBe(false);
    expect('customElements' in globalThis).toBe(false);
  });

  it('renders an empty <ui-view> when the page leaves out uiViewSlot()', async () => {
    const outDir = await buildSite('./prerender-slotless.ts');

    expect(outline(await routedView(outDir, 'index.html'))).toEqual([]);
  });
});
