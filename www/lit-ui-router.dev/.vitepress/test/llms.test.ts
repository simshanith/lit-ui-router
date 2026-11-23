import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  appendExampleSources,
  formatLintExamples,
  LLMS_RELEASES,
  llmsSidebar,
  transformMarkdownForLlms,
} from '../llms.ts';
import { GENERATED_PAGES } from '../page-meta.ts';

const SITE_DIR = join(import.meta.dirname, '../..');

const FENCE_OPEN = /^[ \t]*(`{3,}|~{3,})/;

const VUE_OPEN_TAG = /^[ \t]*<(?:[A-Z][\w-]*|[a-z][a-z0-9]*-[\w-]*|template)\b/;

const LONE_CLOSING_ANGLE = /^[ \t]*>[ \t]*$/;

const stripInlineCode = (line: string) => line.replaceAll(/(`+).*?\1/g, '');

const stripQuotedAttributes = (line: string) =>
  line.replaceAll(/"[^"]*"|'[^']*'/g, '');

/** Returns the lines outside fenced code blocks as `[lineNumber, text]` pairs (permissive indent covers fences in list items). */
function linesOutsideFences(markdown: string): Array<[number, string]> {
  const result: Array<[number, string]> = [];

  let fence: { char: string; length: number } | null = null;

  for (const [index, line] of markdown.split('\n').entries()) {
    if (fence) {
      const trimmed = line.trim();

      const closes =
        trimmed.length >= fence.length &&
        trimmed === fence.char.repeat(trimmed.length);

      if (closes) fence = null;

      continue;
    }

    const opened = FENCE_OPEN.exec(line);

    if (opened) {
      fence = { char: opened[1][0], length: opened[1].length };

      continue;
    }

    result.push([index + 1, line]);
  }

  return result;
}

/** Finds `<template #...>` slot tags visible to `vitepress-plugin-llms` after pre-transforms and fence-aware `<llm-exclude>` stripping. */
function leakedSlotTags(markdown: string, id: string): string[] {
  const transformed = transformMarkdownForLlms(markdown, id);

  const leaks: string[] = [];

  let inExclude = false;

  for (const [lineNumber, line] of linesOutsideFences(transformed)) {
    let visible = stripInlineCode(line).replaceAll(
      /<llm-exclude>.*?<\/llm-exclude>/g,
      '',
    );

    if (inExclude) {
      const closeIndex = visible.indexOf('</llm-exclude>');

      if (closeIndex === -1) continue;

      inExclude = false;
      visible = visible.slice(closeIndex + '</llm-exclude>'.length);
    }

    const openIndex = visible.indexOf('<llm-exclude>');

    if (openIndex !== -1) {
      visible = visible.slice(0, openIndex);
      inExclude = true;
    }

    if (/<template\b/.test(visible)) {
      leaks.push(`transformed line ${lineNumber}: ${line.trim()}`);
    }
  }

  return leaks;
}

/** Finds multi-line Vue opening tags whose closing `>` sits on its own line (parsed as a CommonMark blockquote by oxfmt). */
function loneClosingAngleLines(markdown: string): number[] {
  const badLines: number[] = [];

  let inOpenTag = false;

  for (const [lineNumber, line] of linesOutsideFences(markdown)) {
    if (!inOpenTag) {
      if (VUE_OPEN_TAG.test(line) && !stripQuotedAttributes(line).includes('>'))
        inOpenTag = true;

      continue;
    }

    if (LONE_CLOSING_ANGLE.test(line)) {
      badLines.push(lineNumber);
      inOpenTag = false;

      continue;
    }

    if (stripQuotedAttributes(line).includes('>')) inOpenTag = false;
  }

  return badLines;
}

function authoredDocsPages(): string[] {
  return globSync('**/*.md', {
    cwd: SITE_DIR,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '.vitepress/**',
      ...GENERATED_PAGES,
    ],
  }).sort();
}

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

describe('authored docs pages: Vue slots and oxfmt tag hygiene', () => {
  it('flags an unwrapped <template #slot> tag while ignoring fenced code, multi-backtick inline code, and <llm-exclude>', () => {
    const leaky =
      '<CustomBox>\n<template #a>\n\nhi\n\n</template>\n</CustomBox>';

    assert.deepEqual(leakedSlotTags(leaky, ID), [
      'transformed line 2: <template #a>',
    ]);

    const fencedExcludeThenLeak = [
      '```md',
      '<llm-exclude>',
      '```',
      '',
      '<CustomBox><template #a>leak</template></CustomBox>',
      '',
      '<llm-exclude>',
      '<CustomBox><template #b>ok</template></CustomBox>',
      '</llm-exclude>',
    ].join('\n');

    assert.deepEqual(leakedSlotTags(fencedExcludeThenLeak, ID), [
      'transformed line 5: <CustomBox><template #a>leak</template></CustomBox>',
    ]);

    const safe = [
      'Inline `<template #a>` and ``<template #b>`` are fine.',
      '',
      '```html',
      '<template #a></template>',
      '```',
      '',
      '<llm-exclude>',
      '<CustomBox><template #a>ok</template></CustomBox>',
      '</llm-exclude>',
    ].join('\n');

    assert.deepEqual(leakedSlotTags(safe, ID), []);
  });

  it('flags a closing `>` on its own line in a multi-line Vue tag, including indented, custom-element, and quoted `>` cases', () => {
    const beforeOxfmt = '<LintExample\n  rule="a"\n  fixable\n>\n';

    const afterOxfmt = '<LintExample\nrule="a"\nfixable\n\n>\n';

    const indentedCustomEl = '  <ui-view\n    title="a > b"\n  >\n';

    const attachedClose = '<LintExample\n  rule="a"\n  fixable>\n';

    const singleLine = '<LintExample rule="a" fixable>\n';

    const fenced = '```html\n<LintExample\n  rule="a"\n>\n```\n';

    assert.deepEqual(loneClosingAngleLines(beforeOxfmt), [4]);
    assert.deepEqual(loneClosingAngleLines(afterOxfmt), [5]);
    assert.deepEqual(loneClosingAngleLines(indentedCustomEl), [3]);
    assert.deepEqual(loneClosingAngleLines(attachedClose), []);
    assert.deepEqual(loneClosingAngleLines(singleLine), []);
    assert.deepEqual(loneClosingAngleLines(fenced), []);
  });

  it('scans authored reference pages and excludes generated reference and release-stub trees', () => {
    const pages = authoredDocsPages();

    assert.ok(pages.includes('reference/index.md'));
    assert.ok(pages.includes('reference/lit-ui-router-elements.md'));
    assert.ok(!pages.some((page) => page.startsWith('package-releases/')));
    assert.ok(!pages.some((page) => /^reference\/[^/]+\//.test(page)));
  });

  it('leaves no raw <template> slot tags visible to vitepress-plugin-llms on any authored page', () => {
    const problems: string[] = [];

    for (const rel of authoredDocsPages()) {
      const abs = join(SITE_DIR, rel);

      const leaks = leakedSlotTags(readFileSync(abs, 'utf8'), abs);

      for (const leak of leaks) problems.push(`${rel}: ${leak}`);
    }

    assert.deepEqual(problems, []);
  });

  it('has no multi-line Vue opening tag with a lone `>` line on any authored page', () => {
    const problems: string[] = [];

    for (const rel of authoredDocsPages()) {
      const abs = join(SITE_DIR, rel);

      const lines = loneClosingAngleLines(readFileSync(abs, 'utf8'));

      for (const line of lines) problems.push(`${rel}:${line}`);
    }

    assert.deepEqual(problems, []);
  });
});
