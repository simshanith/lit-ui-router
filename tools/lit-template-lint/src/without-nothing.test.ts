import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { withoutNothing } from './without-nothing.ts';

type Type = Parameters<typeof withoutNothing>[0];

const nothing: Type = { kind: 'ES_SYMBOL_UNIQUE', value: '__@nothing@12345' };

const str: Type = { kind: 'STRING' };

const num: Type = { kind: 'NUMBER' };

const otherSymbol: Type = {
  kind: 'ES_SYMBOL_UNIQUE',
  value: '__@noChange@7',
};

const union = (...types: Type[]): Type => ({ kind: 'UNION', types });

describe('withoutNothing', () => {
  it('leaves a non-union alone', () => {
    assert.equal(withoutNothing(str), str);
  });

  it('strips nothing from a union', () => {
    assert.deepEqual(withoutNothing(union(str, num, nothing)), union(str, num));
  });

  it('collapses a union left with one member', () => {
    assert.equal(withoutNothing(union(str, nothing)), str);
  });

  it('recurses through an alias, keeping the wrapper', () => {
    const alias: Type = {
      kind: 'ALIAS',
      name: 'AriaCurrent',
      target: union(str, nothing),
    };

    assert.deepEqual(withoutNothing(alias), {
      kind: 'ALIAS',
      name: 'AriaCurrent',
      target: str,
    });
  });

  it('drops a bare nothing, and a union of only nothing', () => {
    assert.equal(withoutNothing(nothing), undefined);
    assert.equal(withoutNothing(union(nothing)), undefined);
  });

  it('keeps a unique symbol that is not nothing', () => {
    assert.equal(withoutNothing(otherSymbol), otherSymbol);
    assert.deepEqual(
      withoutNothing(union(str, otherSymbol)),
      union(str, otherSymbol),
    );
  });
});
