import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EXAMPLE_NAMES, EXAMPLES } from 'examples/embeds';

import { PACKAGES } from '../../catalog/packages.ts';
import { exampleIndexData, headingSlug } from '../example-index.ts';
import { expandIndexPages, expandIndexes } from '../index-pages.ts';
import { packageIndexData } from '../package-index.ts';
import {
  activeFacetsOf,
  addFacetRow,
  clearConflictingFilters,
  facetCounts,
  initialVisibleFacets,
  matchesFilter,
  orderedPickerFacets,
  parseQueryFilter,
  relaxations,
  removeFacetRow,
  serializeQueryFilter,
  splitInlineCode,
  toggleFacetValue,
} from '../theme/components/faceted-index.ts';

const examples = exampleIndexData();

const packages = packageIndexData();

const toFilter = (pairs: ReadonlyArray<readonly [string, string]>) =>
  new Map(pairs);

describe('faceted-index pure logic', () => {
  const activeEx = activeFacetsOf(examples.facets, examples.entries);
  const activePkg = activeFacetsOf(packages.facets, packages.entries);

  it('drops unpopulated values and single-value facets automatically', () => {
    const render = activeEx.find((f) => f.key === 'render');

    assert.ok(render);
    assert.deepEqual(render.values, ['client', 'prerender']);

    assert.equal(
      activePkg.find((f) => f.key === 'subject'),
      undefined,
    );
    assert.deepEqual(
      activePkg.map((f) => f.key),
      ['layer', 'role', 'runtime'],
    );
  });

  it('orders picker facets with pickerOrder first', () => {
    assert.deepEqual(
      orderedPickerFacets(activeEx, examples.pickerOrder).map((f) => f.key),
      ['bindings', 'render', 'location', 'kind', 'lang', 'registry', 'lint'],
    );
    assert.deepEqual(
      orderedPickerFacets(activePkg, packages.pickerOrder).map((f) => f.key),
      ['layer', 'runtime', 'role'],
    );
  });

  it('computes disjunctive sibling counts without zeroing sibling values', () => {
    const bindings = activeEx.find((f) => f.key === 'bindings')!;

    const counts = facetCounts(
      examples.entries,
      bindings,
      toFilter([['bindings', 'signals']]),
    );

    assert.equal(counts.all, EXAMPLE_NAMES.length);
    assert.deepEqual(counts.values, [
      { value: 'none', count: 12 },
      { value: 'mobx', count: 1 },
      { value: 'signals', count: 2 },
      { value: 'effect', count: 1 },
    ]);
  });

  it('reflects cross-facet constraints and computes empty-result relaxations', () => {
    const filter = toFilter([
      ['render', 'prerender'],
      ['bindings', 'signals'],
    ]);

    const matched = examples.entries.filter((e) => matchesFilter(e, filter));

    assert.equal(matched.length, 0);
    assert.deepEqual(relaxations(examples.entries, filter, activeEx), [
      { key: 'bindings', value: 'signals', count: 2 },
      { key: 'render', value: 'prerender', count: 2 },
    ]);
  });

  it('filters multi-valued runtime facets on packages', () => {
    const serverPkgs = packages.entries
      .filter((entry) =>
        matchesFilter(entry, toFilter([['runtime', 'server']])),
      )
      .map((entry) => entry.id);

    assert.deepEqual(serverPkgs, ['ui-router-server', 'ui-router-otel']);
  });

  it('appends rows in insertion order and clears filter on removal', () => {
    const added = addFacetRow(['bindings'], 'render');

    assert.deepEqual(added, ['bindings', 'render']);
    assert.deepEqual(addFacetRow(added, 'render'), ['bindings', 'render']);

    const removed = removeFacetRow(
      added,
      toFilter([
        ['bindings', 'signals'],
        ['render', 'prerender'],
      ]),
      'render',
    );

    assert.deepEqual(removed.visible, ['bindings']);
    assert.deepEqual(removed.filter, toFilter([['bindings', 'signals']]));
  });

  it('toggles values and round-trips URL query parameters', () => {
    const f1 = toggleFacetValue(new Map(), 'bindings', 'signals');
    const f2 = toggleFacetValue(f1, 'registry', 'on');

    assert.deepEqual(
      f2,
      toFilter([
        ['bindings', 'signals'],
        ['registry', 'on'],
      ]),
    );
    assert.deepEqual(
      toggleFacetValue(f2, 'bindings', 'signals'),
      toFilter([['registry', 'on']]),
    );

    const query = serializeQueryFilter(f2, activeEx);

    assert.equal(query, '?bindings=signals&registry=on');
    assert.deepEqual(
      parseQueryFilter(`${query}&unknown=1&lang=rust`, activeEx),
      toFilter([
        ['bindings', 'signals'],
        ['registry', 'on'],
      ]),
    );
    assert.equal(serializeQueryFilter(new Map(), activeEx), '');
  });

  it('opens active query keys on load, or the default facet when unfiltered', () => {
    assert.deepEqual(initialVisibleFacets('bindings', new Map(), activeEx), [
      'bindings',
    ]);
    assert.deepEqual(
      initialVisibleFacets(
        'bindings',
        toFilter([
          ['render', 'prerender'],
          ['lang', 'ts'],
        ]),
        activeEx,
      ),
      ['lang', 'render'],
    );
  });

  it('clears only conflicting constraints when following a deep anchor', () => {
    const mobx = examples.entries.find(
      (e) => e.id === 'hellosolarsystem-mobx',
    )!;

    assert.deepEqual(
      clearConflictingFilters(
        mobx,
        toFilter([
          ['bindings', 'signals'],
          ['registry', 'on'],
        ]),
      ),
      toFilter([['registry', 'on']]),
    );
  });

  it('splits inline backtick code spans without HTML injection', () => {
    assert.deepEqual(splitInlineCode('Use `uiSref` with `<sp-link>`.'), [
      { text: 'Use ', code: false },
      { text: 'uiSref', code: true },
      { text: ' with ', code: false },
      { text: '<sp-link>', code: true },
      { text: '.', code: false },
    ]);
  });
});

describe('catalog datasets and index-pages expansion', () => {
  it('lists every example with its heading slug and every package with its entry points', () => {
    assert.equal(examples.entries.length, EXAMPLE_NAMES.length);

    for (const name of EXAMPLE_NAMES) {
      const entry = examples.entries.find((e) => e.id === name);

      assert.ok(entry, name);
      assert.equal(entry.slug, headingSlug(EXAMPLES[name].title), name);
    }

    assert.equal(packages.entries.length, PACKAGES.length);

    for (const { name } of PACKAGES) {
      const entry = packages.entries.find((e) => e.id === name);

      assert.ok(entry, name);
      assert.ok((entry.entryPoints?.length ?? 0) >= 1, name);
    }
  });

  it('emits <FacetedIndex> for HTML and keeps Markdown in <llm-only> and expandIndexes', () => {
    const exPage = expandIndexPages('<!-- example-index -->');
    const pkgPage = expandIndexPages('<!-- package-index -->');

    assert.ok(exPage.includes('<FacetedIndex index="examples" />'));
    assert.ok(exPage.includes('<llm-exclude>'));
    assert.ok(exPage.includes('<llm-only>'));
    assert.equal(exPage.match(/<llm-only>/g)?.length, 1);
    assert.equal(exPage.match(/<\/llm-only>/g)?.length, 1);
    assert.ok(exPage.includes('### Hello World'));

    assert.ok(pkgPage.includes('<FacetedIndex index="packages" />'));
    assert.equal(pkgPage.match(/<llm-only>/g)?.length, 1);
    assert.equal(pkgPage.match(/<\/llm-only>/g)?.length, 1);
    assert.ok(pkgPage.includes('### lit-ui-router'));

    const searchMarkdown = expandIndexes('<!-- example-index -->');

    assert.ok(!searchMarkdown.includes('<FacetedIndex'));
    assert.ok(searchMarkdown.includes('### Hello World'));
  });
});
