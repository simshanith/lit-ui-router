import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseManifest, renderManifest } from './published-versions.core.ts';

describe('renderManifest', () => {
  it('renders bytewise-sorted keys with a trailing newline', () => {
    const text = renderManifest({
      'ui-router-navigation-location-plugin': { latest: '0.2.2' },
      'lit-ui-router': { latest: '1.7.0' },
      'lit-ui-router-mobx': { latest: '0.3.3' },
    });
    assert.equal(
      text,
      `${JSON.stringify(
        {
          'lit-ui-router': { latest: '1.7.0' },
          'lit-ui-router-mobx': { latest: '0.3.3' },
          'ui-router-navigation-location-plugin': { latest: '0.2.2' },
        },
        null,
        2,
      )}\n`,
    );
  });

  it('is canonical: key insertion order never changes the bytes', () => {
    const a = renderManifest({ b: { latest: '1.0.0' }, a: {} });
    const b = renderManifest({ a: {}, b: { latest: '1.0.0' } });
    assert.equal(a, b);
  });

  it('sorts dist-tag keys too — registry order is nondeterministic', () => {
    const a = renderManifest({ a: { rc: '1.1.0-rc.0', latest: '1.0.0' } });
    const b = renderManifest({ a: { latest: '1.0.0', rc: '1.1.0-rc.0' } });
    assert.equal(a, b);
    assert.match(a, /"latest"[\s\S]*"rc"/);
  });

  it('round-trips through parseManifest', () => {
    const versions = {
      'lit-ui-router': { latest: '1.7.0' },
      'never-published': {},
    };
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

  it('rejects a package that does not map to a dist-tag object', () => {
    assert.throws(
      () => parseManifest('{"lit-ui-router": "1.7.0"}'),
      /must map to a dist-tag object/,
    );
    assert.throws(
      () => parseManifest('{"lit-ui-router": null}'),
      /must map to a dist-tag object/,
    );
  });

  it('rejects non-string dist-tag versions', () => {
    assert.throws(
      () => parseManifest('{"lit-ui-router": {"latest": 1.7}}'),
      /dist-tag "latest" must map to a version string/,
    );
  });
});
