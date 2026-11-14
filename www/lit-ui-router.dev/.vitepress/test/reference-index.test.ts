import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { API_REFERENCES } from '../../catalog/references.ts';
import { PACKAGES } from '../../catalog/packages.ts';
import { expandIndexes, INDEX_MARKERS } from '../index-pages.ts';
import { referenceIndex } from '../reference-index.ts';

const site = join(import.meta.dirname, '../..');

/** The page each marker belongs on. */
const PAGES = {
  '<!-- reference-index -->': 'reference/index.md',
  '<!-- package-index -->': 'packages/index.md',
  '<!-- example-index -->': 'examples/index.md',
  '<!-- live-examples -->': 'examples/live.md',
} as const satisfies Record<keyof typeof INDEX_MARKERS, string>;

describe('the generated index pages', () => {
  for (const [marker, file] of Object.entries(PAGES)) {
    it(`expand ${marker} in ${file}`, () => {
      const page = readFileSync(join(site, file), 'utf8');

      assert.ok(page.includes(marker));
      assert.ok(!expandIndexes(page).includes(marker));
    });
  }
});

describe('the reference index', () => {
  it('links every API reference once', () => {
    const list = referenceIndex();

    for (const { name } of PACKAGES) {
      const reference = API_REFERENCES[name];

      if (reference)
        assert.equal(list.split(`](${reference})`).length, 2, name);
      assert.ok(list.includes(`(/packages/${name})`), name);
    }
  });
});
