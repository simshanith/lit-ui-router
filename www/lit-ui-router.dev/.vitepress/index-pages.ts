import type { Plugin } from 'vite';

import { elementIndex } from './element-index.ts';
import { exampleIndex, liveExamples } from './example-index.ts';
import { plainLlmMarkdown } from './index-markdown.ts';
import { packageIndex } from './package-index.ts';
import { referenceIndex } from './reference-index.ts';

/** Each generated list, keyed by the line a page writes where it goes. */
export const INDEX_MARKERS = {
  '<!-- reference-index -->': referenceIndex,
  '<!-- package-index -->': packageIndex,
  '<!-- example-index -->': exampleIndex,
  '<!-- live-examples -->': liveExamples,
  '<!-- element-index -->': elementIndex,
} as const;

export type IndexMarker = keyof typeof INDEX_MARKERS;

// SAFETY: INDEX_MARKERS is a const literal, so its own keys are exactly IndexMarker
const markers = Object.keys(INDEX_MARKERS) as IndexMarker[];

// The markers are plain text: no RegExp metacharacters to escape.
const MARKER = new RegExp(`^(?:${markers.join('|')})$`, 'm');

/** Interactive faceted index markers: HTML renders the Vue component, while LLMs and local search receive the Markdown list. */
const FACETED_COMPONENTS: Partial<
  Record<IndexMarker, 'examples' | 'packages'>
> = {
  '<!-- example-index -->': 'examples',
  '<!-- package-index -->': 'packages',
};

/** Replaces each marker line with its generated Markdown list (used by local search and tests). */
export function expandIndexes(markdown: string): string {
  return markers.reduce(
    (page, marker) =>
      page.includes(marker)
        ? page.replace(marker, () => INDEX_MARKERS[marker]())
        : page,
    markdown,
  );
}

/** Replaces each marker line for the VitePress build: faceted indexes render `<FacetedIndex />` in HTML and Markdown for LLMs. */
export function expandIndexPages(markdown: string): string {
  return markers.reduce((page, marker) => {
    if (!page.includes(marker)) return page;

    const index = FACETED_COMPONENTS[marker];

    return page.replace(marker, () => {
      const generated = INDEX_MARKERS[marker]();

      if (!index) return generated;

      return [
        '<llm-exclude>',
        '',
        `<FacetedIndex index="${index}" />`,
        '',
        '</llm-exclude>',
        '',
        '<llm-only>',
        '',
        plainLlmMarkdown(generated),
        '',
        '</llm-only>',
      ].join('\n');
    });
  }, markdown);
}

/** Expands the markers before VitePress and the llms plugin read the page, so the HTML and the Markdown copies carry the lists. */
export function indexPagesPlugin(): Plugin {
  return {
    name: 'index-pages',
    enforce: 'pre',
    transform: {
      filter: { id: /\.md$/, code: MARKER },
      handler: (code) => ({ code: expandIndexPages(code), map: null }),
    },
  };
}
