import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { API_REFERENCES } from '../../catalog/navigation.ts';
import { PACKAGES } from '../../catalog/packages.ts';
import {
  expandReferenceIndex,
  REFERENCE_INDEX_MARKER,
  referenceIndex,
} from '../reference-index.ts';

const page = readFileSync(
  join(import.meta.dirname, '../../reference/index.md'),
  'utf8',
);

describe('the reference index', () => {
  it('is generated into reference/index.md', () => {
    assert.ok(page.includes(REFERENCE_INDEX_MARKER));
    assert.ok(!expandReferenceIndex(page).includes(REFERENCE_INDEX_MARKER));
  });

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
