import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DIST_TAG_READS,
  distTagRead,
  QUEUE_MAX_DELAY_SECONDS,
  queueCeiling,
  queueDelaySeconds,
} from './consume.ts';
import type { NpmVersion } from './observe.ts';

const NPM_VERSION: NpmVersion = {
  integrity: 'sha512-AAAA',
  publishedAt: '2026-10-24T15:56:58.000Z',
};

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

describe('distTagRead', () => {
  const PUBLISHED = { npm: NPM_VERSION, distTags: { latest: '0.1.0' } };

  const STALE = { npm: NPM_VERSION, distTags: { latest: '0.0.1-alpha.0' } };

  it('retries a publish run whose dist-tags read predates the publish', () => {
    assert.equal(distTagRead('run', '0.1.0', STALE, 1), 'stale');
    assert.equal(
      distTagRead('run', '0.1.0', STALE, DIST_TAG_READS - 1),
      'stale',
    );
  });

  it('confirms a read that points any tag at the version', () => {
    assert.equal(distTagRead('run', '0.1.0', PUBLISHED, 1), 'confirmed');
    assert.equal(
      distTagRead(
        'run',
        '0.2.0-rc.0',
        { npm: NPM_VERSION, distTags: { latest: '0.1.0', rc: '0.2.0-rc.0' } },
        1,
      ),
      'confirmed',
    );
  });

  it('records what it read once the reads run out', () => {
    assert.equal(
      distTagRead('run', '0.1.0', STALE, DIST_TAG_READS),
      'unconfirmed',
    );
  });

  it('takes sweeps, manual claims and unpublished versions as read', () => {
    assert.equal(distTagRead('sweep', '0.1.0', STALE, 1), 'confirmed');
    assert.equal(distTagRead('manual', '0.1.0', STALE, 1), 'confirmed');
    assert.equal(
      distTagRead('run', '0.1.0', { npm: null, distTags: {} }, 1),
      'confirmed',
    );
    assert.equal(
      distTagRead('run', '0.1.0', { npm: NPM_VERSION, distTags: null }, 1),
      'confirmed',
    );
  });
});
