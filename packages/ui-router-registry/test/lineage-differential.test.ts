// Holds the committed type probe to what core returns today.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';

import { generate, PROBE } from './lineage-differential.ts';

it('the lineage probe matches what core returns', async () => {
  assert.equal(
    readFileSync(PROBE, 'utf8'),
    await generate(),
    'run `pnpm generate:lineage-differential`',
  );
});
