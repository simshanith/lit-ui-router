import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { parseHtml } from '@tools/lit-test-env/parse-html.ts';
import { createMarkdownRenderer } from 'vitepress';

import {
  HOME_SAMPLE_LINKS,
  HOME_SAMPLE_NAME,
  HOME_SAMPLE_REGIONS,
} from '../../catalog/home-sample.ts';
import {
  annotatedCode,
  highlightAnnotated,
  listingOf,
  markedText,
  regionParts,
} from '../annotated-code.ts';
import { linkProblem, ORIGIN } from '../published-links.ts';
import { MINIMUM } from '../theme/color-roles.ts';
import { contrast } from './color.ts';
import { ground, hex } from './theme-colors.ts';
import {
  CARD_IDS,
  CARD_STATE,
} from '../theme/components/features-tour-states.ts';

const site = join(import.meta.dirname, '../..');

const source = readFileSync(join(site, 'catalog/home-sample/app.ts'), 'utf8');

const listing = listingOf(source);

// tour.ts defines a custom element on import, so its card titles are read as text.
const tour = readFileSync(
  join(workspaceRoot, 'examples/features-tour/src/tour.ts'),
  'utf8',
);

const tourTitles = new Map(
  [...tour.matchAll(/^ {4}id: '([\w-]+)',\n {4}title: '([^']+)',$/gm)].map(
    ([, id, title]) => [id, title],
  ),
);

/** The text each region is meant to mark; a range that drifts off it fails here. */
const MARKED = {
  states: `name: '${CARD_STATE.name}'`,
  parameters: `url: '${CARD_STATE.url}'`,
  resolves: [
    'resolve: [',
    '  {',
    "    token: 'card',",
    "    deps: ['$transition$'],",
    '    resolveFn: (transition: Transition) =>',
    `      cardFor(transition.params().${CARD_STATE.param}),`,
    '  },',
    '],',
  ].join('\n'),
  views: '<ui-view></ui-view>',
  links: `\${uiSref('${CARD_STATE.name}', { ${CARD_STATE.param}: 'views' })}`,
} satisfies Record<string, string>;

describe("the home page's code listing", () => {
  it('is the sample module below its imports', () => {
    const head = source.slice(0, source.indexOf(listing)).trim();

    assert.deepEqual(
      head.split('\n').filter((line) => !/^(\/\/|import )/.test(line)),
      [],
    );
    assert.doesNotMatch(listing, /^import /m);
    assert.ok(source.endsWith(`${listing}\n`));
  });

  it('stays short enough for a first look', () => {
    assert.ok(listing.split('\n').length <= 24);
  });

  it("declares the tour's state under the tour's element name", () => {
    assert.match(listing, /^export const cardState: /m);
    assert.match(listing, /^@customElement\('app-root'\)$/m);
  });
});

describe("the home page's code regions", () => {
  it('each mark the text they explain', () => {
    assert.deepEqual(
      Object.fromEntries(
        HOME_SAMPLE_REGIONS.map((region) => [
          region.id,
          markedText(listing, region),
        ]),
      ),
      MARKED,
    );
  });

  it('are numbered in reading order, one starting on a line', () => {
    const starts = HOME_SAMPLE_REGIONS.map(({ start }) => start[0]);

    assert.deepEqual(
      starts,
      [...new Set(starts)].sort((a, b) => a - b),
    );
  });

  it('are four to six, each under a label of one to three words', () => {
    assert.ok(HOME_SAMPLE_REGIONS.length >= 4);
    assert.ok(HOME_SAMPLE_REGIONS.length <= 6);

    for (const { label } of HOME_SAMPLE_REGIONS)
      assert.ok(label.split(' ').length <= 3, label);
  });

  it('explain themselves in one sentence, with every code span closed', () => {
    for (const { id, explanation } of HOME_SAMPLE_REGIONS) {
      assert.match(explanation, /^[^.]+\.$/, id);
      assert.equal(explanation.split('`').length % 2, 1, id);
    }
  });

  it("take a tour card's title where they link to the card", () => {
    const linked = HOME_SAMPLE_REGIONS.flatMap(({ label, card }) =>
      card ? [{ label, card }] : [],
    );

    assert.deepEqual(
      linked.map(({ card }) => card).sort(),
      [...CARD_IDS].sort(),
    );

    for (const { label, card } of linked)
      assert.equal(label, tourTitles.get(card));
  });

  it('refuse a range the listing does not hold', () => {
    const region = { id: 'probe', start: [2, 3], end: [2, 14] } as const;

    assert.throws(
      () => regionParts(listing, [{ ...region, end: [2, 99] }]),
      /line 2 has no columns 3 to 99/,
    );
    assert.throws(
      () => regionParts(listing, [{ ...region, start: [23, 1], end: [24, 1] }]),
      /no line 24/,
    );
    assert.throws(
      () => regionParts(listing, [{ ...region, start: [1, 8], end: [2, 14] }]),
      /line 2 has code left of column 8/,
    );
    assert.throws(
      () => regionParts(listing, [region, region]),
      /starts before the region ahead of it ends/,
    );
  });
});

describe("the home page's highlighted listing", async () => {
  const md = await createMarkdownRenderer(site, {
    codeTransformers: [
      annotatedCode({ [HOME_SAMPLE_NAME]: HOME_SAMPLE_REGIONS }),
    ],
  });

  const { body } = parseHtml(
    await highlightAnnotated(md, listing, 'ts', HOME_SAMPLE_NAME),
  );

  const marks = (id: string) => [
    ...body.querySelectorAll(`mark[data-region="${id}"]`),
  ];

  it('is one <pre> whose text is the listing, character for character', () => {
    assert.deepEqual(
      [...body.children].map(({ localName }) => localName),
      ['pre'],
    );
    assert.equal(body.querySelector('code')?.textContent, listing);
  });

  it('wraps each region in marks, one a line, that hold its text', () => {
    // A part starts at its region's column, so the indent ahead of it stays outside the mark.
    assert.deepEqual(
      Object.fromEntries(
        HOME_SAMPLE_REGIONS.map(({ id }) => [
          id,
          marks(id)
            .map(({ textContent }) => textContent)
            .join('\n'),
        ]),
      ),
      MARKED,
    );
  });

  it('names each part by its place, so a region of several lines draws as one box', () => {
    const places = (id: string) =>
      marks(id).map((mark) => mark.getAttribute('data-part'));

    assert.deepEqual(places('states'), ['only']);
    assert.deepEqual(places('resolves'), [
      'start',
      ...Array.from({ length: 6 }, () => 'middle'),
      'end',
    ]);
  });

  // A chosen region lays a wash under its code; every syntax colour must still read on it, and on the code's own ground.
  it('holds every syntax colour to text contrast, on the code ground and on the wash', () => {
    const styles = [...body.querySelectorAll('span[style]')].map(
      (token) => token.getAttribute('style') ?? '',
    );

    for (const theme of ['light', 'dark'] as const) {
      const colours = new Set(
        styles.flatMap(
          (style) =>
            new RegExp(`--shiki-${theme}:(#[\\da-f]{6})`, 'i').exec(
              style,
            )?.[1] ?? [],
        ),
      );

      assert.ok(colours.size > 3, theme);

      for (const name of ['surface-alt', 'code-wash'] as const) {
        const under = hex(ground(theme, name));

        for (const colour of colours)
          assert.ok(
            contrast(colour, under) >= MINIMUM.text,
            `${colour} on ${name} (${theme}): ${contrast(colour, under).toFixed(2)}:1`,
          );
      }
    }
  });

  it("keeps the highlighter's colours inside a mark", () => {
    for (const mark of body.querySelectorAll('mark')) {
      assert.ok(mark.children.length > 0);

      for (const token of mark.children)
        assert.match(token.getAttribute('style') ?? '', /--shiki-light:/);
    }
  });
});

describe("the home page's sample links", () => {
  it('point at a page the site serves and a file the repository holds', async () => {
    assert.equal(
      await linkProblem(`${ORIGIN}${HOME_SAMPLE_LINKS.tutorial}`),
      undefined,
    );

    const [, path] = HOME_SAMPLE_LINKS.tourSource.split('/blob/main/');

    assert.ok(path && existsSync(join(workspaceRoot, path)), path);
  });
});
