import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { wranglerBuildConditions } from '../wrangler-dev.ts';

const DEVELOPMENT = 'development,workerd,worker,browser';

describe('wranglerBuildConditions', () => {
  it('serves the development build by default', () => {
    for (const WWW_WORKER_BUILD of [undefined, '', ' development ']) {
      assert.equal(wranglerBuildConditions({ WWW_WORKER_BUILD }), DEVELOPMENT);
    }
  });

  it("leaves wrangler's own conditions for production, as deploy does", () => {
    assert.equal(
      wranglerBuildConditions({ WWW_WORKER_BUILD: 'production' }),
      undefined,
    );
  });

  it('lets an explicit WRANGLER_BUILD_CONDITIONS win', () => {
    for (const WWW_WORKER_BUILD of [undefined, 'production']) {
      assert.equal(
        wranglerBuildConditions({
          WWW_WORKER_BUILD,
          WRANGLER_BUILD_CONDITIONS: 'workerd,worker',
        }),
        'workerd,worker',
      );
    }
  });

  it('throws for an unknown build, even beside explicit conditions', () => {
    for (const WRANGLER_BUILD_CONDITIONS of [undefined, 'workerd']) {
      assert.throws(
        () =>
          wranglerBuildConditions({
            WWW_WORKER_BUILD: 'prod',
            WRANGLER_BUILD_CONDITIONS,
          }),
        /WWW_WORKER_BUILD must be development or production, not prod/,
      );
    }
  });
});
