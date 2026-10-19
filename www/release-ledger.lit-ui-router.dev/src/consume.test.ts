import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  QUEUE_MAX_DELAY_SECONDS,
  queueCeiling,
  queueDelaySeconds,
} from './consume.ts';

describe('queueDelaySeconds', () => {
  it('doubles the ceiling per attempt up to the cap, jittered over its upper half', () => {
    assert.deepEqual(
      [1, 2, 3, 7, 8, 20].map(queueCeiling),
      [30, 60, 120, 1920, 3600, 3600],
    );
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

  it('lets a rate limit wait win over the backoff, up to what Queues accept', () => {
    assert.equal(
      queueDelaySeconds(9, 2.2, () => 0),
      3,
    );
    assert.equal(queueDelaySeconds(1, 0), 0);
    assert.equal(queueDelaySeconds(1, 10 ** 6), QUEUE_MAX_DELAY_SECONDS);
  });
});
