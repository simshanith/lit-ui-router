import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseManifest, renderManifest } from './published-versions.core.ts';

describe('renderManifest', () => {
  it('renders bytewise-sorted keys with a trailing newline', () => {
    const text = renderManifest({
      'ui-router-navigation-location-plugin': '0.2.2',
      'lit-ui-router': '1.7.0',
      'lit-ui-router-mobx': '0.3.3',
    });
    assert.equal(
      text,
      `${JSON.stringify(
        {
          'lit-ui-router': '1.7.0',
          'lit-ui-router-mobx': '0.3.3',
          'ui-router-navigation-location-plugin': '0.2.2',
        },
        null,
        2,
      )}\n`,
    );
  });

  it('is canonical: key insertion order never changes the bytes', () => {
    const a = renderManifest({ b: '1.0.0', a: null });
    const b = renderManifest({ a: null, b: '1.0.0' });
    assert.equal(a, b);
  });

  it('round-trips through parseManifest', () => {
    const versions = { 'lit-ui-router': '1.7.0', 'never-published': null };
    assert.deepEqual(parseManifest(renderManifest(versions)), versions);
  });
});

describe('parseManifest', () => {
  it('rejects invalid JSON', () => {
    assert.throws(() => parseManifest('not json'), /not valid JSON/);
  });

  it('rejects non-object shapes', () => {
    assert.throws(
      () => parseManifest('["lit-ui-router"]'),
      /must be an object/,
    );
    assert.throws(() => parseManifest('null'), /must be an object/);
  });

  it('rejects non-string, non-null versions', () => {
    assert.throws(
      () => parseManifest('{"lit-ui-router": 1.7}'),
      /version string or null/,
    );
  });
});
