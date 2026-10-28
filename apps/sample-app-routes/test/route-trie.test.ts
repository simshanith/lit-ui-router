import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createServerRouter,
  diagnoseMounts,
  routeTrie,
} from 'ui-router-server';

import { mounts } from '../src/routes.ts';
import { probePaths, withRouteIndex } from './mount-paths.ts';

// The trie against the linear scan on the docs site's own mounts: every probe path, the same verdict.
const linear = createServerRouter({
  mounts: withRouteIndex(mounts, undefined),
});

const trie = createServerRouter({ mounts: withRouteIndex(mounts, routeTrie) });

describe('routeTrie on the sample-app mounts', () => {
  for (const [base, config] of Object.entries(mounts)) {
    if (config.strategy === 'simulate') continue;

    it(`${base} resolves every probe path to the linear verdict`, async () => {
      const paths = probePaths(base, config);

      for (const path of paths)
        assert.deepEqual(
          await trie.resolve(path),
          await linear.resolve(path),
          path,
        );
    });
  }

  it('leaves only /simulated-routing off the matcher strategy', () => {
    assert.deepEqual(
      Object.entries(mounts)
        .filter(([, config]) => config.strategy === 'simulate')
        .map(([base]) => base),
      ['/simulated-routing'],
    );
  });

  it('serves every bare base without a 404', () => {
    assert.deepEqual(diagnoseMounts(trie), []);
    assert.deepEqual(diagnoseMounts(linear), []);
  });
});
