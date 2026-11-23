import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  appendExampleSources,
  formatLintExamples,
  LLMS_RELEASES,
  llmsSidebar,
} from '../llms.ts';

const ID = '/docs/tutorial/helloworld.md';

describe('appendExampleSources', () => {
  it('follows a <LiveExample> with an <llm-only> line naming its source and StackBlitz project', () => {
    const markdown =
      '## Live Demo\n\n<LiveExample name="helloworld" />\n\n## Next\n';

    assert.equal(
      appendExampleSources(markdown, ID),
      [
        '## Live Demo',
        '',
        '<LiveExample name="helloworld" />',
        '',
        '<llm-only>',
        '',
        'The Hello World example: [source on GitHub](https://github.com/simshanith/lit-ui-router/tree/main/examples/helloworld), [open in StackBlitz](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/helloworld?file=src%2Fmain.ts).',
        '',
        '</llm-only>',
        '',
        '## Next',
        '',
      ].join('\n'),
    );
  });

  it("opens StackBlitz on the tag's file attribute", () => {
    const out = appendExampleSources(
      '<LiveExample name="hellogalaxy" file="src/states.ts" />\n',
      ID,
    );

    assert.ok(out.includes('hellogalaxy?file=src%2Fstates.ts'));
  });

  it('leaves a page without <LiveExample> untouched', () => {
    const markdown = '# Guide\n\nUse `<LiveExample name="x" />` in a page.\n';

    assert.equal(appendExampleSources(markdown, ID), markdown);
  });

  it('fails on a name examples/embeds.ts does not list', () => {
    assert.throws(
      () => appendExampleSources('<LiveExample name="nope" />\n', ID),
      /tutorial\/helloworld\.md: <LiveExample name="nope"> names no entry/,
    );
  });
});

describe('formatLintExamples', () => {
  it('replaces a <LintExample> for LLMs with labelled Incorrect, Lint error, and Correct fences', () => {
    const markdown = [
      '<LintExample rule="lit-ui-router/sref-assign-href" label="Button" fixable>',
      '<template #incorrect>',
      '',
      '```ts',
      "html`<button ${uiSref('home')}>Home</button>`;",
      '```',
      '',
      '</template>',
      '<template #diagnostic>',
      '',
      '```text',
      'uiSref writes an href to <button>.',
      '```',
      '',
      '</template>',
      '<template #correct>',
      '',
      '```ts',
      "html`<button ${uiSref('home', {}, { assignHref: 'auto' })}>Home</button>`;",
      '```',
      '',
      '</template>',
      '</LintExample>',
    ].join('\n');

    const out = formatLintExamples(markdown);

    assert.ok(out.startsWith('<llm-exclude>\n\n<LintExample '));
    assert.ok(
      out.includes('</LintExample>\n\n</llm-exclude>\n\n<llm-only>\n\n'),
    );
    assert.ok(
      out.includes(
        "**Incorrect** (`lit-ui-router/sref-assign-href`):\n\n```ts\nhtml`<button ${uiSref('home')}>Home</button>`;\n```",
      ),
    );
    assert.ok(
      out.includes(
        'Lint error:\n\n```text\nuiSref writes an href to <button>.\n```',
      ),
    );
    assert.ok(
      out.includes(
        "**Correct**:\n\n```ts\nhtml`<button ${uiSref('home', {}, { assignHref: 'auto' })}>Home</button>`;\n```",
      ),
    );
  });

  it('leaves a page without <LintExample> untouched', () => {
    const markdown = '# Linting\n\nPlain prose.\n';

    assert.equal(formatLintExamples(markdown), markdown);
  });
});

describe('llmsSidebar', () => {
  it('keeps API index links and drops their members, the excluded page and the shells', () => {
    assert.deepEqual(
      llmsSidebar([
        {
          text: 'Introduction',
          items: [
            { text: 'Intro', link: '/introduction' },
            { text: 'How this site runs', link: '/site/' },
          ],
        },
        { text: 'Releases', link: '/releases/', target: '_self', items: [] },
        {
          text: 'Sample App',
          items: [
            { text: 'Overview', link: '/sample-app' },
            { text: 'Vanilla', link: '/app', target: '_self' },
          ],
        },
        {
          text: 'API',
          items: [
            {
              text: 'lit-ui-router',
              link: '/reference/lit-ui-router/',
              collapsed: true,
              items: [{ text: 'Core', link: '/reference/lit-ui-router/core/' }],
            },
          ],
        },
      ]),
      [
        {
          text: 'Introduction',
          items: [{ text: 'Intro', link: '/introduction' }],
        },
        {
          text: 'Sample App',
          items: [{ text: 'Overview', link: '/sample-app' }],
        },
        {
          text: 'API',
          items: [
            {
              text: 'lit-ui-router',
              link: '/reference/lit-ui-router/',
              collapsed: true,
            },
          ],
        },
      ],
    );
  });

  it('keeps a hand-written page inside an API index', () => {
    assert.deepEqual(
      llmsSidebar([
        {
          text: 'lit-ui-router',
          link: '/reference/lit-ui-router/',
          items: [
            { text: 'Elements', link: '/reference/lit-ui-router/elements' },
            { text: 'Core', link: '/reference/lit-ui-router/core/' },
          ],
        },
      ]),
      [
        {
          text: 'lit-ui-router',
          link: '/reference/lit-ui-router/',
          items: [
            { text: 'Elements', link: '/reference/lit-ui-router/elements' },
          ],
        },
      ],
    );
  });
});

describe('LLMS_RELEASES', () => {
  it('lists the releases index the sidebar filter drops, and names the package pages', () => {
    assert.ok(
      LLMS_RELEASES.startsWith(
        '- [Releases](https://lit-ui-router.dev/releases/): ',
      ),
    );
    assert.ok(
      LLMS_RELEASES.includes(
        '`https://lit-ui-router.dev/releases/<npm-name>/`',
      ),
    );
  });
});
