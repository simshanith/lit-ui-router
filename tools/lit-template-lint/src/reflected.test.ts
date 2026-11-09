import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { reflectedType } from './reflected.ts';

describe('reflectedType', () => {
  it('maps IDL numbers, booleans and strings', () => {
    assert.equal(reflectedType('img', 'width'), 'number');
    assert.equal(reflectedType('li', 'value'), 'number');
    assert.equal(reflectedType('input', 'disabled'), 'boolean');
    assert.equal(reflectedType('input', 'step'), 'string');
  });

  it('inherits HTMLElement and its mixins', () => {
    assert.equal(reflectedType('div', 'tabindex'), 'number');
    assert.equal(reflectedType('div', 'title'), 'string');
    assert.equal(reflectedType('div', 'aria-label'), 'string');
  });

  it('follows a [Reflect] that names its content attribute', () => {
    assert.equal(reflectedType('label', 'for'), 'string');
    assert.equal(reflectedType('input', 'value'), 'string');
  });

  it('types the same attribute per interface', () => {
    assert.equal(reflectedType('iframe', 'width'), 'string');
  });

  it('leaves unreflected attributes untyped', () => {
    assert.equal(reflectedType('div', 'dir'), undefined);
    assert.equal(reflectedType('div', 'dropzone'), undefined);
  });
});
