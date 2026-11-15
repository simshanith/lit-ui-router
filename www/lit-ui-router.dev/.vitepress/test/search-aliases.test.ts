import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import MiniSearch from 'minisearch';
import { loadLocalSearchIndex } from 'vitepress/dist/client/theme-default/support/local-search.js';

import { tokenizeWithAliases } from '../search-aliases.ts';

interface Section {
  id: string;
  title: string;
  titles: string[];
  text: string;
}

// Section text as the plugin indexes it: tags stripped, entities kept.
const SECTIONS: Section[] = [
  {
    id: '/guides/prerender-with-eleventy#prerender-with-eleventy',
    title: 'Prerender with Eleventy',
    titles: [],
    text: 'Eleventy writes each page through a template.',
  },
  {
    id: '/guides/named-views#named-views',
    title: 'Named views',
    titles: [],
    text: 'Give each &lt;ui-view&gt; a name.',
  },
  {
    id: '/reference/lit-ui-router/components/UiView#class-uiview',
    title: 'Class: UiView',
    titles: [],
    text: 'Renders the routed component.',
  },
  {
    id: '/guides/transitions#transitions',
    title: 'Transitions',
    titles: [],
    text: 'A transition moves from one state to another.',
  },
];

// Built with the plugin's options, then loaded the way the client loads it.
function clientIndex() {
  const index = new MiniSearch<Section>({
    fields: ['title', 'titles', 'text'],
    storeFields: ['title', 'titles'],
    tokenize: tokenizeWithAliases,
  });

  index.addAll(SECTIONS);

  return loadLocalSearchIndex(JSON.stringify(index));
}

function ids(query: string) {
  const hits = clientIndex().search(query);

  // SAFETY: every section id is a string
  return hits.map((hit) => hit.id as string);
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

  it('keeps the tokens of text without aliases', () => {
    assert.deepEqual(tokenizeWithAliases('Lit UI Router'), [
      'Lit',
      'UI',
      'Router',
    ]);
  });
});
