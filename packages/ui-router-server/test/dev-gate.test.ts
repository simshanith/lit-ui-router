import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TestContext } from 'node:test';

import { devGate } from '../src/dev-gate.ts';
import { devGate as nodeDevGate } from '../src/dev-gate.node.ts';

const withNodeEnv = (t: TestContext, value: string | undefined): void => {
  const previous = process.env.NODE_ENV;

  t.after(() => {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  });

  if (value === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = value;
};

describe('#dev-gate', () => {
  it('stays open off node, whatever NODE_ENV says', (t) => {
    withNodeEnv(t, 'production');

    assert.equal(devGate(), true);
  });

  it('closes under node when NODE_ENV is production', (t) => {
    withNodeEnv(t, undefined);
    assert.equal(nodeDevGate(), true);

    withNodeEnv(t, 'production');
    assert.equal(nodeDevGate(), false);
  });
});
