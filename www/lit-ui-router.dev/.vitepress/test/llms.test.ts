import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { appendExampleSources, llmsSidebar } from '../llms.ts';

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

describe('llmsSidebar', () => {
  it('keeps API index links and drops their members, the excluded page and the shells', () => {
    assert.deepEqual(
      llmsSidebar([
        {
          text: 'Introduction',
          items: [
            { text: 'Intro', link: '/introduction' },
            { text: 'How this site runs', link: '/about-this-site' },
          ],
        },
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
              link: '/api/reference/',
              collapsed: true,
              items: [{ text: 'Core', link: '/api/reference/core/' }],
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
            { text: 'lit-ui-router', link: '/api/reference/', collapsed: true },
          ],
        },
      ],
    );
  });
});
