import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  QUEUE_MAX_DELAY_SECONDS,
  queueCeiling,
  queueDelaySeconds,
} from './consume.ts';

describe('queueDelaySeconds', () => {
  it('doubles the ceiling per attempt up to the cap', () => {
    assert.deepEqual(
      [1, 2, 3, 7, 8, 20].map(queueCeiling),
      [30, 60, 120, 1920, 3600, 3600],
    );
  });

  it('jitters over the upper half of the ceiling, in whole seconds', () => {
    assert.equal(
      queueDelaySeconds(3, undefined, () => 0),
      60,
    );
    assert.equal(
      queueDelaySeconds(3, undefined, () => 0.5),
      90,
    );
    assert.equal(
      queueDelaySeconds(1, undefined, () => 0.01),
      16,
    );
  });

  it('lets a rate limit wait win over the backoff', () => {
    assert.equal(
      queueDelaySeconds(9, 2.2, () => 0),
      3,
    );
    assert.equal(queueDelaySeconds(1, 0), 0);
  });

  it('caps the delay at what Queues accept', () => {
    assert.equal(queueDelaySeconds(1, 10 ** 6), QUEUE_MAX_DELAY_SECONDS);
  });
});
