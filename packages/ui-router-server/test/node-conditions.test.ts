import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { nodeConditions } from '../src/node-conditions.ts';
import { nodeConditions as nodeNodeConditions } from '../src/node-conditions.node.ts';

describe('#node-conditions', () => {
  it('reads none off node', () => {
    assert.deepEqual(nodeConditions(), []);
  });

  it('reads every flag form from execArgv and NODE_OPTIONS', () => {
    assert.deepEqual(
      nodeNodeConditions(
        ['--conditions', 'a', '--conditions=b', '-C', 'c', '--inspect'],
        '-C=d --max-old-space-size=4096',
      ),
      ['a', 'b', 'c', 'd'],
    );
  });

  it('reads none when node runs without the flag', () => {
    assert.deepEqual(nodeNodeConditions([], ''), []);
  });
});
