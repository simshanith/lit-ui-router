import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getByRole } from '@testing-library/dom';
import { parseHtml } from '@tools/lit-test-env/parse-html.ts';
import MiniSearch from 'minisearch';
import { tokenizeSearchText } from 'vitepress/dist/client/shared.js';
import { loadLocalSearchIndex } from 'vitepress/dist/client/theme-default/support/local-search.js';

import { aliasesIn, withSearchAliases } from '../search-aliases.ts';

interface Section {
  id: string;
  title: string;
  titles: string[];
  text: string;
}

// Rendered pages as `_render` returns them, one anchored heading each.
const PAGES = {
  '/guides/prerender-with-eleventy': [
    'prerender-with-eleventy',
    'Prerender with Eleventy',
    '<p>Let the static site generator write each page.</p>',
  ],
  '/guides/named-views': [
    'named-views',
    'Named views',
    '<p>Give each <code>&lt;ui-view&gt;</code> a name.</p>',
  ],
  '/reference/lit-ui-router/components/UiView': [
    'class-uiview',
    'Class: UiView',
    '<p>Renders the routed component.</p>',
  ],
  '/guides/transitions': [
    'transitions',
    'Transitions',
    '<p>A transition moves from one state to another.</p>',
  ],
} as const;

// One section per page: the text after its heading, as the plugin's splitter indexes it.
async function sections(): Promise<Section[]> {
  return Promise.all(
    Object.entries(PAGES).map(async ([path, [anchor, title, body]]) => {
      const { body: page } = parseHtml(
        await withSearchAliases(
          `<h1 id="${anchor}" tabindex="-1">${title} <a class="header-anchor" href="#${anchor}">​</a></h1>\n${body}`,
        ),
      );

      getByRole(page, 'heading', { level: 1 }).remove();

      return {
        id: `${path}#${anchor}`,
        title,
        titles: [],
        text: page.textContent,
      };
    }),
  );
}

// The plugin's build options, loaded as the client loads them: theme config carries no miniSearch options.
async function clientIndex() {
  const index = new MiniSearch<Section>({
    fields: ['title', 'titles', 'text'],
    storeFields: ['title', 'titles'],
    tokenize: tokenizeSearchText,
  });

  index.addAll(await sections());

  return loadLocalSearchIndex(JSON.stringify(index));
}

async function ids(query: string) {
  // SAFETY: every section id is a string
  return (await clientIndex()).search(query).map((hit) => hit.id as string);
}

describe('search aliases', () => {
  it('finds the Eleventy guide for 11ty', async () => {
    assert.deepEqual(await ids('11ty'), [
      '/guides/prerender-with-eleventy#prerender-with-eleventy',
    ]);
  });

  it('finds the prerender guide for ssg', async () => {
    assert.deepEqual(await ids('ssg'), [
      '/guides/prerender-with-eleventy#prerender-with-eleventy',
    ]);
  });

  it('aliases ssr and server-side rendering in both directions', () => {
    assert.deepEqual(aliasesIn('lit-ui-router-ssr'), [
      'server',
      'side',
      'rendering',
    ]);
    assert.deepEqual(aliasesIn('server-side rendering'), ['ssr']);
  });

  it('finds the same sections for ui-view and UiView', async () => {
    const expected = new Set([
      '/guides/named-views#named-views',
      '/reference/lit-ui-router/components/UiView#class-uiview',
    ]);

    assert.deepEqual(new Set(await ids('ui-view')), expected);
    assert.deepEqual(new Set(await ids('UiView')), expected);
  });

  it('returns a page without aliases unchanged', async () => {
    const html = '<h2>Lit</h2><p>Router</p>';

    assert.deepEqual(aliasesIn('Lit UI Router'), []);
    assert.equal(await withSearchAliases(html), html);
  });

  it('appends aliases to the section body, not its heading', async () => {
    const { body } = parseHtml(
      await withSearchAliases(
        '<h2>Eleventy</h2>\n<p>Write pages.</p>\n<h2>Vite</h2>\n<p>Bundle.</p>\n',
      ),
    );

    getByRole(body, 'heading', { name: 'Eleventy' });
    getByRole(body, 'heading', { name: 'Vite' });
    assert.deepEqual(body.textContent.split(/\s+/).filter(Boolean), [
      'Eleventy',
      'Write',
      'pages.',
      '11ty',
      'Vite',
      'Bundle.',
    ]);
  });
});
