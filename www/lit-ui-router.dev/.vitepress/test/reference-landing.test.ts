import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

import { PACKAGES } from '../../catalog/packages.ts';
import { API_REFERENCES, FEATURED_EXPORTS } from '../../catalog/references.ts';
import {
  packageLine,
  readPage,
  REFERENCE_INDEX,
  referenceLanding,
  referenceRoot,
  summaryOf,
  withSummaries,
} from '../reference-landing.ts';

const site = join(import.meta.dirname, '../..');

/** A typedoc member page: its breadcrumb, title and whatever follows. */
const page = (...body: string[]) =>
  ['[pkg](../index.md) / Example', '', '# Class: Example', '', ...body].join(
    '\n',
  );

describe('summaryOf', () => {
  it("takes the comment's first sentence, past the source line and across a wrapped line", () => {
    assert.equal(
      summaryOf(
        page(
          'Defined in: src/example.ts:1',
          '',
          'Keeps its host in sync',
          'with the router. A second sentence.',
          '',
          'A second paragraph.',
        ),
      ),
      'Keeps its host in sync with the router.',
    );
  });

  it('skips a signature, as a fence or as a block quote', () => {
    const comment = ['Defined in: src/example.ts:1', '', 'Creates a link.'];

    assert.equal(
      summaryOf(page('```ts', 'const example: () => void;', '```', ...comment)),
      'Creates a link.',
    );
    assert.equal(
      summaryOf(page('> **example**(): `void`', '', ...comment)),
      'Creates a link.',
    );
  });

  it('reads an overloaded function from its first call signature', () => {
    assert.equal(
      summaryOf(
        page(
          '## Call Signature',
          '',
          '```ts',
          'function example(): void;',
          '```',
          '',
          'Defined in: src/example.ts:1',
          '',
          'Registers a state.',
          '',
          '## Call Signature',
          '',
          'Registers several.',
        ),
      ),
      'Registers a state.',
    );
  });

  it('has none for a page whose comment has no text', () => {
    assert.equal(
      summaryOf(
        page('Defined in: src/example.ts:1', '', '## Slots', '', 'Text.'),
      ),
      undefined,
    );
    assert.equal(summaryOf('No title.'), undefined);
  });

  it('ends a sentence at a full stop that ends a word, not one in code, a version or an abbreviation', () => {
    assert.equal(
      summaryOf(
        page(
          'Matches a glob, e.g. `admin.**`, on TypeScript 5.5 and up. Then more.',
        ),
      ),
      'Matches a glob, e.g. `admin.**`, on TypeScript 5.5 and up.',
    );
    assert.equal(
      summaryOf(page('Returns `router.globals`.', 'Then more.')),
      'Returns `router.globals`.',
    );
  });

  it('keeps a link as its text, and a code label typedoc escaped as code', () => {
    assert.equal(
      summaryOf(
        page(
          'Extends [UIRouter](https://example.com/a.b) inside a [\\`withRouterSync\\`](withRouterSync.md) call.',
        ),
      ),
      'Extends UIRouter inside a `withRouterSync` call.',
    );
  });

  it('keeps inline HTML and emphasis whole, and escapes what Markdown or Vue would read', () => {
    assert.equal(
      summaryOf(
        page(
          'The <code>&lt;ui-view&gt;</code> element, *never. cut* here, renders \\<b\\> and a\\_b {{ c }}. More.',
        ),
      ),
      'The <code>&lt;ui-view&gt;</code> element, *never. cut* here, renders &lt;b&gt; and a\\_b &#123;&#123; c }}.',
    );
  });

  it('closes a paragraph that only introduces the block below it', () => {
    assert.equal(
      summaryOf(page('Read alongside the registry:', '', '```ts', '```')),
      'Read alongside the registry.',
    );
  });
});

describe('withSummaries', () => {
  const pages = new Map([
    ['/ref/classes/Example.md', page('Keeps its host in sync. More.')],
    // An element class as typedoc writes it today: tags, and no text ahead of them.
    [
      '/ref/classes/Bare.md',
      page(
        'Defined in: src/bare.ts:1',
        '',
        '## Slots',
        '',
        '- <em>default</em> — Slotted content.',
        '',
        '## Extends',
        '',
        '- `LitElement`',
      ),
    ],
    ['/ref/Category', page('Lists by category.')],
  ]);

  const read = (path: string) => pages.get(path);

  it('follows each entry with the summary of the page it links', () => {
    assert.equal(
      withSummaries(
        [
          '## Classes',
          '',
          '- [Example](classes/Example.md)',
          '- [Bare](classes/Bare.md)',
          '- [Missing](classes/Missing.md)',
          '- [`Category`](./Category)',
          '- Not [a link entry](classes/Example.md) alone',
        ].join('\n'),
        '/ref',
        read,
      ),
      [
        '## Classes',
        '',
        '- [Example](classes/Example.md) — Keeps its host in sync.',
        '- [Bare](classes/Bare.md)',
        '- [Missing](classes/Missing.md)',
        '- [`Category`](./Category) — Lists by category.',
        '- Not [a link entry](classes/Example.md) alone',
      ].join('\n'),
    );
  });
});

describe('referenceLanding', () => {
  const index = [
    '# lit-ui-router',
    '',
    '## core',
    '',
    '- [UIRouterLit](core/UIRouterLit.md)',
    '',
    '## components',
    '',
    '- [UiView](components/UiView.md)',
  ].join('\n');

  const read = (path: string) =>
    path.endsWith('core/UIRouterLit.md')
      ? page('The main router class.')
      : undefined;

  it("opens a package's index with its package page and the featured exports it lists", () => {
    assert.equal(
      referenceLanding(index, '/site/reference/lit-ui-router/index.md', read),
      [
        '# lit-ui-router',
        '',
        packageLine('lit-ui-router'),
        '',
        '## Start here',
        '',
        '- [UIRouterLit](core/UIRouterLit.md) — The main router class.',
        '- [`<ui-view>` (UiView)](components/UiView.md)',
        '',
        '## core',
        '',
        '- [UIRouterLit](core/UIRouterLit.md) — The main router class.',
        '',
        '## components',
        '',
        '- [UiView](components/UiView.md)',
      ].join('\n'),
    );
  });

  it('gives an index below the root its summaries alone', () => {
    const id = '/site/reference/lit-ui-router/core/index.md';
    const list = '# Core\n\n- [`UIRouterLit`](./UIRouterLit)';

    assert.equal(referenceRoot(id), undefined);
    assert.equal(
      referenceLanding(list, id, () => page('The main router class.')),
      `${list} — The main router class.`,
    );
  });
});

describe('REFERENCE_INDEX', () => {
  it("matches a reference's root, module and category indexes", () => {
    for (const id of [
      '/site/reference/lit-ui-router/index.md',
      '/site/reference/ui-router-server/connect/index.md',
      '/site/reference/lit-ui-router/core/index.md',
    ])
      assert.match(id, REFERENCE_INDEX);
  });

  it('leaves the API page, member pages and other sections alone', () => {
    for (const id of [
      '/site/reference/index.md',
      '/site/reference/lit-ui-router/core/UIRouterLit.md',
      '/site/packages/index.md',
      '/site/guides/server.md',
    ])
      assert.doesNotMatch(id, REFERENCE_INDEX);
  });
});

describe('the generated reference indexes', () => {
  // The fixtures above hold the extraction to a page shape; these hold it to the shape typedoc-plugin-markdown writes today.
  describe('lit-ui-router, as generated', () => {
    const id = join(site, 'reference/lit-ui-router/index.md');

    const entries = withSummaries(readFileSync(id, 'utf8'), dirname(id))
      .split('\n')
      .filter((line) => line.startsWith('- ['));

    it('follows the UIRouterLit entry with prose from its page', () => {
      const entry = entries.find((line) =>
        line.startsWith('- [UIRouterLit](core/UIRouterLit.md)'),
      );

      assert.ok(entry, `no UIRouterLit entry in ${id}`);
      assert.match(entry, /\) — \S.*[.!?]$/);
      // Neither the source line nor the signature read as the comment.
      assert.doesNotMatch(entry, /\.ts:\d+|Defined in|```/);
    });

    it('gives nine entries in ten a summary', () => {
      const summarised = entries.filter((line) => line.includes(') — '));

      // typedoc fails the build on an undocumented export, so only a comment with no text ahead of its tags lists bare; a changed page shape would bare them all.
      assert.ok(entries.length > 0);
      assert.ok(
        summarised.length >= entries.length * 0.9,
        `${summarised.length} of ${entries.length} entries have a summary`,
      );
    });
  });

  for (const { name } of PACKAGES) {
    const reference = API_REFERENCES[name];

    if (!reference) continue;

    const id = join(site, reference, 'index.md');

    it(`${name} opens with its package page`, () => {
      const landing = referenceLanding(readFileSync(id, 'utf8'), id);

      assert.equal(referenceRoot(id), name);
      assert.equal(landing.split(packageLine(name)).length, 2);
      assert.ok(packageLine(name).includes(`(/packages/${name})`));
    });
  }

  for (const [name, featured] of Object.entries(FEATURED_EXPORTS)) {
    const id = join(site, 'reference', name, 'index.md');
    const index = readFileSync(id, 'utf8');
    const landing = referenceLanding(index, id);

    it(`${name} exports every featured name, in the order the catalog lists them`, () => {
      const section = landing.slice(
        landing.indexOf('## Start here'),
        landing.indexOf('\n## ', landing.indexOf('## Start here') + 1),
      );

      assert.deepEqual(
        Array.from(
          section.matchAll(/^- \[.*?(\w+)\)?\]\(/gm),
          ([, listed]) => listed,
        ),
        featured.map((entry) => entry.name),
      );
    });

    for (const entry of featured) {
      if (!('element' in entry)) continue;

      it(`${entry.name} documents the <${entry.element}> element`, () => {
        const target = new RegExp(
          `^- \\[${entry.name}\\]\\((.+)\\)$`,
          'm',
        ).exec(index);

        assert.ok(target, `${entry.name} has no entry in ${id}`);
        assert.ok(
          readPage(join(dirname(id), target[1]))?.includes(
            `&lt;${entry.element}&gt;`,
          ),
        );
      });
    }
  }
});
