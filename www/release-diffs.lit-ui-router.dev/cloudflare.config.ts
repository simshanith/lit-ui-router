import { bindings, defineConfig, exports } from 'cf/config';

import * as entrypoint from './worker/index.ts' with { type: 'cf-worker' };

export default defineConfig(({ isPreview }) => ({
  worker: {
    name: 'release-diffs',
    compatibilityDate: '2026-07-01',
    compatibilityFlags: ['nodejs_compat'],
    entrypoint,
    // Reached only through the docs worker's service binding, so neither production nor a Preview gets a URL.
    workersDev: false,
    previewUrls: false,
    observability: {
      enabled: true,
      // Names a destination set up on the account, which holds the endpoint and key.
      traces: { enabled: true, destinations: ['honeycomb-traces'] },
    },
    env: {
      // A Preview writes its own bucket, so production's entries only ever come from production code.
      DIFFS: bindings.r2({
        name: isPreview ? 'release-diffs-preview' : 'release-diffs',
      }),
    },
    exports: {
      ReleaseDiff: exports.durableObject({ storage: 'sqlite' }),
    },
  },
}));
