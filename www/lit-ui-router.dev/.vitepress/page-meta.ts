import * as v from 'valibot';

import { GUIDE_TOPICS } from '../catalog/navigation.ts';
import { STUB_DIR } from './release-stubs.ts';

/** What a page is for; the first four are the Diátaxis quadrants. */
export const PAGE_TYPES = {
  tutorial: 'Teaches in order',
  concept: 'Explains a model',
  guide: 'Does one task',
  package: 'A package or package family',
  reference: 'API and other lookup material',
  example: 'A runnable thing',
  post: 'Dated writing',
  site: 'How the site itself works',
  index: 'Lists or overviews a section',
} as const;

export type PageType = keyof typeof PAGE_TYPES;

/** Page sources a generator writes; they carry no page type. */
export const GENERATED_PAGES = ['reference/*/**', `${STUB_DIR}/**`];

const pageTypes = Object.keys(PAGE_TYPES).filter(
  (type): type is Exclude<PageType, 'guide'> => type !== 'guide',
);

/** A page's frontmatter: `type` on every page, `topic` on guides only. */
export const PageMeta = v.variant(
  'type',
  [
    v.looseObject({
      type: v.literal('guide'),
      topic: v.picklist(
        GUIDE_TOPICS.map(({ id }) => id),
        `topic: a guide needs one of ${GUIDE_TOPICS.map(({ id }) => id).join(', ')}`,
      ),
    }),
    v.looseObject({
      type: v.picklist(pageTypes),
      topic: v.optional(v.never('topic: only a guide has one')),
    }),
  ],
  `type: expected one of ${Object.keys(PAGE_TYPES).join(', ')}`,
);

export type PageMeta = v.InferOutput<typeof PageMeta>;
