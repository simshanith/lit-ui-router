import type { Plugin } from 'vite';

import { API_REFERENCES } from '../catalog/navigation.ts';
import { PACKAGES, ROLES } from '../catalog/packages.ts';

/** The line a page writes where the per-package reference list goes. */
export const REFERENCE_INDEX_MARKER = '<!-- reference-index -->';

/** One section per role, each package linking its API reference, or its package page when it has none. */
export function referenceIndex(): string {
  return ROLES.flatMap(({ id, label }) => [
    `## ${label}`,
    '',
    ...PACKAGES.filter(({ role }) => role === id).map(({ name }) => {
      const reference = API_REFERENCES[name];
      const page = `[package page](/packages/${name})`;

      return reference
        ? `- [${name}](${reference}) — ${page}`
        : `- ${name} — no runtime API; see its ${page}`;
    }),
    '',
  ]).join('\n');
}

/** Replaces the marker line with the generated list. */
export function expandReferenceIndex(markdown: string): string {
  return markdown.replace(REFERENCE_INDEX_MARKER, () => referenceIndex());
}

/** Expands the marker before VitePress and the llms plugin read the page, so the HTML and the Markdown copies carry the list. */
export function referenceIndexPlugin(): Plugin {
  return {
    name: 'reference-index',
    enforce: 'pre',
    transform: {
      filter: { id: /\.md$/, code: REFERENCE_INDEX_MARKER },
      handler: (code) => ({ code: expandReferenceIndex(code), map: null }),
    },
  };
}
