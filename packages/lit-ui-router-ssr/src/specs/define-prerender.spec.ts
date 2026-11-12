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

/** Runs a definePrerender entry over `shellHtml`, for `/` unless overridden, and returns the written files. */
const run = async (
  shellHtml: string,
  overrides: Partial<PrerenderScriptOptions> = {},
): Promise<Map<string, string>> => {
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

  return files;
};

/** The index.html a {@link run} writes. */
const build = async (
  shellHtml: string,
  overrides: Partial<PrerenderScriptOptions> = {},
): Promise<string | undefined> =>
  (await run(shellHtml, overrides)).get('dist/index.html');

const MARKERLESS = SHELL.replace('<!--app-->', '');

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

  it('throws at the first shell page, naming the marker, when the shell has none', async () => {
    await expect(build(MARKERLESS)).rejects.toThrow(
      "definePrerender: the built index.html has no <!--app--> marker; put <!--app--> where each page's body goes, or return a `document` hook",
    );
  });

  it('needs no marker for a run that writes no shell page', async () => {
    const files = await run(MARKERLESS, {
      mounts: {
        '/': {
          routes: [
            { name: 'home', url: '/' },
            { name: 'legacy', url: '/legacy', redirectTo: 'home' },
          ],
        },
      },
      paths: ['/legacy'],
    });

    expect([...files.keys()]).toEqual(['dist/_redirects']);
    expect(files.get('dist/_redirects')).toBe(
      '/legacy / 302\n/legacy/ / 302\n',
    );
  });

  it('gives way to a document hook, which needs no marker', async () => {
    const page = await build('<html><body><main></main></body></html>', {
      document: (body) => `<main>${body}</main>`,
    });

    expect(page).toBe('<main><p>page $& $1</p></main>');
  });
});
