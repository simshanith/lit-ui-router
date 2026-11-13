import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import type { Rollup } from 'vite';
import type { DefaultTheme } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';

import { inPathOrder, type LlmsHooks } from '../llms.ts';

const root = await mkdtemp(path.join(tmpdir(), 'llms-order-'));

after(() => rm(root, { recursive: true, force: true }));

// Pages that share a title, as several TypeDoc references' `classes` index pages do.
const PAGES = [
  'a/classes/index.md',
  'b/classes/index.md',
  'c/classes/index.md',
];

/** The fields of Vite's resolved config that the llms plugin reads. */
interface FakeConfig {
  base: string;
  build: { ssr?: boolean };
  vitepress: {
    srcDir: string;
    outDir: string;
    userConfig: { themeConfig: DefaultTheme.Config };
  };
}

/** Runs the llms plugin's build hooks over pages titled `title`, transformed in the given order, and returns llms-full.txt. */
async function llmsFull(
  order: string[],
  outDir: string,
  {
    title = 'Classes',
    sidebar = [],
  }: { title?: string; sidebar?: DefaultTheme.SidebarItem[] } = {},
) {
  const [tags, build] = inPathOrder(
    llmstxt({
      domain: 'https://lit-ui-router.dev',
      generateLLMsTxt: false,
      sidebar,
    }),
  );

  const srcDir = path.join(root, 'src');

  // SAFETY: the plugin reads only the fields of the resolved config that FakeConfig names
  const configResolved = build.configResolved as (config: FakeConfig) => void;

  // SAFETY: inPathOrder defines these hooks as plain functions
  const transform = tags.transform as LlmsHooks['transform'];

  // SAFETY: as above
  const buildStart = build.buildStart as LlmsHooks['buildStart'];

  // SAFETY: as above
  const generateBundle = build.generateBundle as LlmsHooks['generateBundle'];

  configResolved({
    base: '/',
    build: {},
    vitepress: { srcDir, outDir, userConfig: { themeConfig: {} } },
  });

  buildStart();

  for (const page of order) {
    await transform(`# ${title}\n`, path.join(srcDir, page));
  }

  // SAFETY: the plugin reads no output option, and an empty bundle has no images to map
  await generateBundle({} as Rollup.NormalizedOutputOptions, {}, true);

  return readFile(path.join(outDir, 'llms-full.txt'), 'utf8');
}

const urls = (full: string) =>
  Array.from(full.matchAll(/^url: (.*)$/gm), ([, url]) => url);

describe('inPathOrder', () => {
  it('writes same-titled pages in source-path order, whatever order Vite transforms them in', async () => {
    const forward = await llmsFull(PAGES, path.join(root, 'forward'));

    const reverse = await llmsFull(
      [...PAGES].reverse(),
      path.join(root, 'reverse'),
    );

    assert.deepEqual(urls(forward), [
      'https://lit-ui-router.dev/a/classes.md',
      'https://lit-ui-router.dev/b/classes.md',
      'https://lit-ui-router.dev/c/classes.md',
    ]);
    assert.equal(reverse, forward);
  });

  it("puts a multi-entry reference's package index, not its root module, in the sidebar slot both match", async () => {
    // `pkg/index.md` is written as `pkg.md` and `pkg/index/index.md` as `pkg/index.md`; both match `/pkg/`.
    const options = { title: 'pkg', sidebar: [{ link: '/pkg/' }] };

    const full = await llmsFull(
      ['pkg/index/index.md', 'pkg/index.md'],
      path.join(root, 'twins'),
      options,
    );

    assert.deepEqual(urls(full), [
      'https://lit-ui-router.dev/pkg.md',
      'https://lit-ui-router.dev/pkg/index.md',
    ]);
  });
});
