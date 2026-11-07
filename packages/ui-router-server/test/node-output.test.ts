import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { drainOutput } from '../src/node-output.ts';
import { drainOutput as nodeDrainOutput } from '../src/node-output.node.ts';

describe('#node-output', () => {
  it('resolves at once off node', async () => {
    assert.equal(await drainOutput(), undefined);
  });

  it('resolves once stdout and stderr take a write', async () => {
    assert.equal(await nodeDrainOutput(), undefined);
  });
});
