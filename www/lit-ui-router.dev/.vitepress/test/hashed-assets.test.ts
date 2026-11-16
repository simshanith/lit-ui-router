import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { HASHED_ASSETS, unhashed } from '../hashed-assets.ts';

describe('the year-cached assets folder', () => {
  it('accepts every naming the build emits', () => {
    assert.deepEqual(
      unhashed([
        'theme.BiT02m1w.js',
        'guides_index.md.B2nR1Hhb.lean.js',
        'inter-italic-greek.BhKA_Ftz.woff2',
        'custom-elements-DPG-SZxY.json',
        'chunks/metadata.bdf8b3e5.js',
        'release-diff/_diff-languages.C1w8POqH.js',
      ]),
      [],
    );
  });

  it('names a file with a fixed name', () => {
    assert.deepEqual(unhashed(['release-diff.js', 'theme.BiT02m1w.js']), [
      'release-diff.js',
    ]);
  });

  it('is the folder the headers file caches for a year', () => {
    const headers = readFileSync(
      join(import.meta.dirname, '../../public/_headers'),
      'utf8',
    );

    const rules = headers
      .split(/\n(?=\S)/)
      .filter((rule) => rule.includes('immutable'));

    assert.deepEqual(
      rules.map((rule) => rule.split('\n')[0]),
      [`/${HASHED_ASSETS}/*`],
    );
  });
});
