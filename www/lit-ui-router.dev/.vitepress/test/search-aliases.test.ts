import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

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

// One section per page, text tag-stripped as the plugin's splitter leaves it.
function sections(): Section[] {
  return Object.entries(PAGES).map(([path, [anchor, title, body]]) => {
    const html = withSearchAliases(
      `<h1 id="${anchor}" tabindex="-1">${title} <a class="header-anchor" href="#${anchor}">​</a></h1>\n${body}`,
    );

    const text = html.slice(html.indexOf('</h1>') + 5).replace(/<[^>]*>/g, '');

    return { id: `${path}#${anchor}`, title, titles: [], text };
  });
}

// The plugin's build options, loaded as the client loads them: theme config carries no miniSearch options.
function clientIndex() {
  const index = new MiniSearch<Section>({
    fields: ['title', 'titles', 'text'],
    storeFields: ['title', 'titles'],
    tokenize: tokenizeSearchText,
  });

  index.addAll(sections());

  return loadLocalSearchIndex(JSON.stringify(index));
}

function ids(query: string) {
  // SAFETY: every section id is a string
  return clientIndex()
    .search(query)
    .map((hit) => hit.id as string);
}

describe('search aliases', () => {
  it('finds the Eleventy guide for 11ty', () => {
    assert.deepEqual(ids('11ty'), [
      '/guides/prerender-with-eleventy#prerender-with-eleventy',
    ]);
  });

  it('finds the prerender guide for ssg', () => {
    assert.deepEqual(ids('ssg'), [
      '/guides/prerender-with-eleventy#prerender-with-eleventy',
    ]);
  });

  it('finds the same sections for ui-view and UiView', () => {
    const expected = new Set([
      '/guides/named-views#named-views',
      '/reference/lit-ui-router/components/UiView#class-uiview',
    ]);

    assert.deepEqual(new Set(ids('ui-view')), expected);
    assert.deepEqual(new Set(ids('UiView')), expected);
  });

  it('adds nothing to text without aliases', () => {
    assert.deepEqual(aliasesIn('Lit UI Router'), []);
    assert.equal(
      withSearchAliases('<h2>Lit</h2><p>Router</p>'),
      '<h2>Lit</h2><p>Router</p>',
    );
  });

  it('leaves headings untouched', () => {
    assert.equal(
      withSearchAliases('<h2>Eleventy</h2><p>Write pages.</p>'),
      '<h2>Eleventy</h2><p>Write pages.</p>\n11ty\n',
    );
  });
});
