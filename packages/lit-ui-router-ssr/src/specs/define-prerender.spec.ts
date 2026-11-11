import { parseHtml } from '@tools/lit-test-env/parse-html.ts';
import { UIRouterLit } from 'lit-ui-router';
import { installServerLocation } from 'ui-router-server/location';
import { describe, expect, it } from 'vitest';

import type { FileWriter } from '../prerender.js';
import { definePrerender } from '../vite.js';
import type { PrerenderScriptOptions } from '../vite.js';
import { withoutSignature } from './markup.js';

const SHELL =
  '<!doctype html><html><head><title>shell</title></head><body><div id="app"><!--app--></div><script type="module" src="/assets/main.js"></script></body></html>';

/** Runs a definePrerender entry over `shellHtml` for `/`, and returns the written index.html. */
const build = async (
  shellHtml: string,
  overrides: Partial<PrerenderScriptOptions> = {},
): Promise<string | undefined> => {
  const files = new Map<string, string>();
  const write: FileWriter = (file, text) => void files.set(file, text);
  const router = new UIRouterLit();
  installServerLocation(router);
  router.stateRegistry.register({ name: 'home', url: '/' });

  const entry = definePrerender(() => ({
    mounts: { '/': { routes: [{ name: 'home', url: '/' }] } },
    router,
    paths: ['/'],
    notFound: false,
    renderShell: () => '<p>page $& $1</p>',
    ...overrides,
  }));

  await entry({ outDir: 'dist', base: '/', shellHtml, write });

  return files.get('dist/index.html');
};

describe("definePrerender's default document", () => {
  it('puts the body in place of the shell’s <!--app--> marker, verbatim', async () => {
    const written = parseHtml(withoutSignature((await build(SHELL))!));

    expect(written.title).toBe('shell');
    // the mount point has no role, so it's found by id
    expect(written.querySelector('#app')?.innerHTML).toBe(
      '<p>page $&amp; $1</p>',
    );
    expect(
      written.querySelector('script[src="/assets/main.js"]'),
    ).not.toBeNull();
  });

  it('fills the first marker only', async () => {
    const page = await build(
      SHELL.replace('</body>', '<template><!--app--></template></body>'),
    );

    expect(page).toContain('<template><!--app--></template>');
  });

  it('throws at build time, naming the marker, when the shell has none', async () => {
    await expect(build(SHELL.replace('<!--app-->', ''))).rejects.toThrow(
      'the built index.html has no <!--app--> marker',
    );
  });

  it('gives way to a document hook, which needs no marker', async () => {
    const page = await build('<html><body><main></main></body></html>', {
      document: (body) => `<main>${body}</main>`,
    });

    expect(page).toBe('<main><p>page $& $1</p></main>');
  });
});
