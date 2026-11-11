import type { Plugin } from 'vite';

import { exampleIndex, liveExamples } from './example-index.ts';
import { packageIndex } from './package-index.ts';
import { referenceIndex } from './reference-index.ts';

/** Each generated list, keyed by the line a page writes where it goes. */
export const INDEX_MARKERS = {
  '<!-- reference-index -->': referenceIndex,
  '<!-- package-index -->': packageIndex,
  '<!-- example-index -->': exampleIndex,
  '<!-- live-examples -->': liveExamples,
} as const;

export type IndexMarker = keyof typeof INDEX_MARKERS;

// SAFETY: INDEX_MARKERS is a const literal, so its own keys are exactly IndexMarker
const markers = Object.keys(INDEX_MARKERS) as IndexMarker[];

// The markers are plain text: no RegExp metacharacters to escape.
const MARKER = new RegExp(`^(?:${markers.join('|')})$`, 'm');

/** Replaces each marker line with its generated list. */
export function expandIndexes(markdown: string): string {
  return markers.reduce(
    (page, marker) =>
      page.includes(marker)
        ? page.replace(marker, () => INDEX_MARKERS[marker]())
        : page,
    markdown,
  );
}

/** Expands the markers before VitePress and the llms plugin read the page, so the HTML and the Markdown copies carry the lists. */
export function indexPagesPlugin(): Plugin {
  return {
    name: 'index-pages',
    enforce: 'pre',
    transform: {
      filter: { id: /\.md$/, code: MARKER },
      handler: (code) => ({ code: expandIndexes(code), map: null }),
    },
  };
}
