import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { messageOf } from './errors.ts';

describe('messageOf', () => {
  it("reads an Error's message", () => {
    assert.equal(messageOf(new TypeError('boom')), 'boom');
  });

  it('stringifies a non-Error throw', () => {
    assert.equal(messageOf('boom'), 'boom');
    assert.equal(messageOf(42), '42');
    assert.equal(messageOf(undefined), 'undefined');
  });
});
