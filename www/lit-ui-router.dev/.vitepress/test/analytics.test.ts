import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { analyticsHead } from '../analytics.ts';

describe('analyticsHead', () => {
  it('emits nothing when the measurement id is unset', () => {
    for (const id of [undefined, '']) {
      assert.deepEqual(analyticsHead(id), []);
    }
  });

  it('emits the loader and the config call for a real id', () => {
    const head = analyticsHead('G-TEST123');
    assert.equal(head.length, 2);

    const [tag, attrs] = head[0];
    assert.equal(tag, 'script');
    assert.equal(
      attrs.src,
      'https://www.googletagmanager.com/gtag/js?id=G-TEST123',
    );

    assert.match(head[1][2] ?? '', /gtag\('config', 'G-TEST123'\)/);
  });
});
