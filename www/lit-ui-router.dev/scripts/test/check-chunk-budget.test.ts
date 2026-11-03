import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CHUNK_BUDGET_KB,
  overBudget,
  SEARCH_INDEX_BUDGET_KB,
} from '../check-chunk-budget.ts';

describe('overBudget', () => {
  it('holds the search index to its own budget', () => {
    const bytes = (CHUNK_BUDGET_KB + 1) * 1000;

    assert.deepEqual(
      overBudget([
        {
          fileName: 'assets/chunks/@localSearchIndexroot.abc.js',
          name: '@localSearchIndexroot',
          bytes,
        },
      ]),
      [],
    );
  });

  it('names the chunk, its size and its budget', () => {
    assert.deepEqual(
      overBudget([
        { fileName: 'assets/app.abc.js', name: 'app', bytes: 500_100 },
        {
          fileName: 'assets/chunks/@localSearchIndexroot.abc.js',
          name: '@localSearchIndexroot',
          bytes: SEARCH_INDEX_BUDGET_KB * 1000 + 100,
        },
      ]),
      [
        `assets/app.abc.js is 500.1 kB, over its ${CHUNK_BUDGET_KB} kB budget`,
        `assets/chunks/@localSearchIndexroot.abc.js is ${SEARCH_INDEX_BUDGET_KB}.1 kB, over its ${SEARCH_INDEX_BUDGET_KB} kB budget`,
      ],
    );
  });
});
