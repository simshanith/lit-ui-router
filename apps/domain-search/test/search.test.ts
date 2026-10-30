import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { labelOf, searchDomains } from '../src/search.ts';

describe('searchDomains', () => {
  it('answers the same query the same way', () => {
    assert.deepEqual(
      searchDomains('lituirouter'),
      searchDomains('lituirouter'),
    );
  });

  it('lists every TLD for the label, the typed one first', () => {
    const { domains } = searchDomains('LitUIRouter.dev');

    assert.equal(domains[0].name, 'lituirouter.dev');
    assert.equal(
      new Set(domains.map((domain) => domain.name)).size,
      domains.length,
    );
    assert.ok(
      domains.every((domain) => domain.name.startsWith('lituirouter.')),
    );
  });

  it('finds nothing for a query with no label', () => {
    assert.deepEqual(searchDomains('  ').domains, []);
    assert.deepEqual(searchDomains('***').domains, []);
  });
});

describe('labelOf', () => {
  it('drops the scheme, the path, and anything outside letters, digits and hyphens', () => {
    assert.equal(labelOf(' https://My_Site.com/path '), 'mysite');
    assert.equal(labelOf('-lit-'), 'lit');
  });
});
