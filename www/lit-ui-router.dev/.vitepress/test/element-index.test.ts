import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import * as v from 'valibot';

import { SURFACES } from '../../catalog/surfaces.ts';
import {
  API_REFERENCES,
  ELEMENT_REFERENCES,
  FEATURED_EXPORTS,
} from '../../catalog/references.ts';
import {
  elementIndex,
  elementList,
  elementsOf,
  Manifest,
  readManifest,
} from '../element-index.ts';
import { pageUrl, surfaceOf } from '../surfaces.ts';

const site = join(import.meta.dirname, '../..');

const manifest = v.parse(Manifest, {
  modules: [
    {
      path: 'src/x-card.ts',
      declarations: [
        {
          name: 'XCard',
          customElement: true,
          summary: 'A card.\nStill the first paragraph.\n\nA second paragraph.',
          members: [
            { kind: 'field', name: 'title' },
            { kind: 'field', name: 'cache', privacy: 'private' },
            { kind: 'method', name: 'open' },
            { kind: 'method', name: 'adopt', privacy: 'protected' },
          ],
          attributes: [{ name: 'title' }],
          events: [{ name: 'x-open' }],
          slots: [{ name: '' }, { name: 'footer' }],
          cssParts: [{ name: 'body' }],
          cssProperties: [{ name: '--x-card-gap' }],
        },
        { name: 'helper' },
      ],
    },
    {
      path: 'src/x-plain.ts',
      declarations: [{ name: 'XPlain', customElement: true }],
    },
    {
      path: 'src/register.ts',
      exports: [
        {
          kind: 'custom-element-definition',
          name: 'x-card',
          declaration: { name: 'XCard', module: 'src/x-card.ts' },
        },
        {
          kind: 'custom-element-definition',
          name: 'x-plain',
          declaration: { name: 'XPlain' },
        },
        { kind: 'js', name: 'helper', declaration: { name: 'helper' } },
      ],
    },
  ],
});

describe('elementsOf', () => {
  it('lists each defined element with its public members by kind', () => {
    assert.deepEqual(elementsOf(manifest), [
      {
        tag: 'x-card',
        className: 'XCard',
        summary: 'A card. Still the first paragraph.',
        members: [
          { label: 'Properties', names: ['title'] },
          { label: 'Attributes', names: ['title'] },
          { label: 'Methods', names: ['open'] },
          { label: 'Slots', names: ['', 'footer'] },
          { label: 'Events', names: ['x-open'] },
          { label: 'CSS custom properties', names: ['--x-card-gap'] },
          { label: 'CSS shadow parts', names: ['body'] },
        ],
      },
      { tag: 'x-plain', className: 'XPlain', summary: undefined, members: [] },
    ]);
  });

  it('fails on a definition whose class the manifest does not declare', () => {
    assert.throws(
      () =>
        elementsOf({
          modules: [
            {
              path: 'src/register.ts',
              declarations: [],
              exports: [
                {
                  kind: 'custom-element-definition',
                  name: 'x-gone',
                  declaration: { name: 'XGone' },
                },
              ],
            },
          ],
        }),
      /<x-gone>: the manifest has no declaration of XGone/,
    );
  });
});

describe('elementList', () => {
  it('writes one item per element, linking a class that has a reference page', () => {
    assert.equal(
      elementList(elementsOf(manifest), (name) =>
        name === 'XCard' ? '/reference/x/components/XCard' : undefined,
      ),
      [
        '- **`<x-card>`** ([`XCard`](/reference/x/components/XCard)) — A card. Still the first paragraph.',
        '  - Properties: `title`',
        '  - Attributes: `title`',
        '  - Methods: `open`',
        '  - Slots: default, `footer`',
        '  - Events: `x-open`',
        '  - CSS custom properties: `--x-card-gap`',
        '  - CSS shadow parts: `body`',
        '- **`<x-plain>`** (`XPlain`)',
      ].join('\n'),
    );
  });
});

describe('the lit-ui-router element list', () => {
  const elements = elementsOf(readManifest('lit-ui-router'));

  it('names the elements the reference index features', () => {
    const byName = (a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name);

    assert.deepEqual(
      elements
        .map(({ tag, className }) => ({ name: className, element: tag }))
        .sort(byName),
      FEATURED_EXPORTS['lit-ui-router']
        .filter((featured) => 'element' in featured)
        .sort(byName),
    );
  });

  it("links each element's class to its reference page", () => {
    const list = elementIndex();

    for (const { className } of elements) {
      assert.match(
        list,
        new RegExp(
          `\\[\`${className}\`\\]\\(/reference/lit-ui-router/[\\w/]+/${className}\\)`,
        ),
      );
    }
  });
});

describe('catalog/references.ts ELEMENT_REFERENCES', () => {
  for (const [name, { source, link }] of Object.entries(ELEMENT_REFERENCES)) {
    it(`serves the ${name} page inside its reference, from a tracked source`, () => {
      // SAFETY: ELEMENT_REFERENCES is keyed by package name
      const reference = API_REFERENCES[name as keyof typeof API_REFERENCES];

      assert.ok(existsSync(join(site, source)), source);
      assert.equal(link, `${reference}elements`);
      // docs:api empties the reference's directory, and search reads the source's own path.
      assert.equal(surfaceOf(pageUrl(source)).renderer, 'vitepress');
    });

    it(`gives the ${name} page a surface row of its own`, () => {
      const { id, renderer, llms } = surfaceOf(link);

      assert.deepEqual(
        { id, renderer, llms },
        { id: 'element-references', renderer: 'vitepress', llms: 'pages' },
      );
    });
  }

  it('has a page for every path of the surface row', () => {
    assert.deepEqual(
      SURFACES.find(({ id }) => id === 'element-references')?.paths,
      Object.values(ELEMENT_REFERENCES).map(({ link }) => link),
    );
  });
});
