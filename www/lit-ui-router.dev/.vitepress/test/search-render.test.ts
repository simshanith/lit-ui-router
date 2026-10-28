import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { describe, it } from 'node:test';

import { createMarkdownRenderer } from 'vitepress';

import { renderForSearch } from '../search-render.ts';

const md = await createMarkdownRenderer(dirname(import.meta.dirname));

async function render(
  src: string,
  relativePath = 'api/reference/controllers/Example.md',
) {
  const html = await renderForSearch(
    src,
    { relativePath, path: relativePath, cleanUrls: true },
    md,
  );

  const headings = [
    ...html.matchAll(
      /<h(\d) id="([^"]*)"[^>]*>(.*?) <a class="header-anchor" href="#([^"]*)"/g,
    ),
  ].map(([, level, , title, anchor]) => `h${level} ${title} #${anchor}`);

  return { headings, text: html.replace(/<[^>]*>/g, '') };
}

const classPage = `# Class: Example

Defined in: src/example.ts:1

Keeps its host in sync.

## Examples

\`\`\`ts
new Example(this);
\`\`\`

## Type Parameters

| Type Parameter | Description |
| ------ | ------ |
| \`T\` | The selected value. |

## Implements

- \`ReactiveController\`

## Accessors

### current

#### Get Signature

\`\`\`ts
get current(): State;
\`\`\`

Defined in: src/example.ts:9

The current state.

##### Returns

\`State\`

## Methods

### includes()

\`\`\`ts
includes(name): boolean;
\`\`\`

Defined in: src/example.ts:12

Delegates to the state service.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| \`name\` | \`string\` |

#### Returns

\`boolean\`

#### Overrides

[\`Base\`](Base.md).[\`includes\`](Base.md#includes)

***

### setRefs()

\`\`\`ts
setRefs(refs): void;
\`\`\`

Replaces the refs.

#### Returns

\`void\`

#### Inherited from

[\`Base\`](Base.md).[\`setRefs\`](Base.md#setrefs)
`;

describe('renderForSearch on a typedoc page', () => {
  it('keeps one section per member, with breadcrumbs lifted past empty groups', async () => {
    const { headings } = await render(classPage);
    assert.deepEqual(headings, [
      'h1 Class: Example #class-example',
      'h2 Examples #examples',
      'h2 current #get-signature',
      'h2 includes() #includes',
    ]);
  });

  it('keeps the prose and drops what the tables and links restate', async () => {
    const { text } = await render(classPage);

    for (const kept of [
      'Keeps its host in sync.',
      'new Example(this);',
      'The current state.',
      'Delegates to the state service.',
      'The selected value.',
      'ReactiveController',
    ]) {
      assert.ok(text.includes(kept), kept);
    }

    for (const dropped of [
      'Defined in',
      'get current()',
      'includes(name)',
      'Base',
      'Replaces the refs.',
    ]) {
      assert.ok(!text.includes(dropped), dropped);
    }
  });

  it('files a merged label under its parent, not the sibling before it', async () => {
    const { text } = await render(classPage);
    assert.ok(
      text.indexOf('The selected value.') < text.indexOf('new Example(this);'),
    );
  });

  it('keeps a declaration no table restates', async () => {
    const { text } = await render(
      '# Type Alias: Mode\n\n```ts\ntype Mode = "push" | "replace";\n```\n\nHow a transition writes history.\n',
    );

    assert.ok(text.includes('type Mode = '));
  });

  it('drops source columns and inherited rows', async () => {
    const { text } = await render(`# Interface: Options

## Properties

| Property | Type | Description | Inherited from | Defined in |
| ------ | ------ | ------ | ------ | ------ |
| \`own\` | \`string\` | Declared here. | - | src/options.ts:3 |
| \`base\` | \`string\` | Declared on the base. | \`Base.base\` | src/base.ts:7 |
`);

    assert.ok(text.includes('Declared here.'));
    assert.ok(!text.includes('Declared on the base.'));
    assert.ok(!text.includes('src/options.ts'));
  });

  it('keeps an empty page title and drops pointer-only sections', async () => {
    const { headings } = await render(
      '# pkg\n\n## Functions\n\n- [run](run.md)\n\n## References\n\n### Alias\n\nRe-exports [Thing](Thing.md)\n',
    );

    assert.deepEqual(headings, ['h1 pkg #pkg', 'h2 Functions #functions']);
  });

  it('honours search: false', async () => {
    assert.equal(
      (await render('---\nsearch: false\n---\n# Class: Hidden\n')).text,
      '',
    );
  });
});

describe('renderForSearch on an authored page', () => {
  it('indexes the page as rendered', async () => {
    const src =
      '# Guide\n\nDefined in: prose, not a source link.\n\n## Parameters\n\nAuthored.\n';

    const { headings, text } = await render(src, 'guides/example.md');
    assert.deepEqual(headings, [
      'h1 Guide #guide',
      'h2 Parameters #parameters',
    ]);
    assert.ok(text.includes('Defined in: prose'));
  });
});
