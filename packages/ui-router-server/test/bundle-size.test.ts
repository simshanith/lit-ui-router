import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import type { BundleOptions, Bundler } from '@tools/bundle-probe';
import { bundleEntry as probe, bundlers } from '@tools/bundle-probe';

// Peers are the consumer's own installs; externalizing them prices only this
// package's code in the reported entries. The matcher is bundled with NO
// externals: its dependency-free claim must hold with nothing supplied from
// outside. Size is governed by the codecov bundle_analysis check, so entry
// sizes are reported as diagnostics, not gated. (History: the matcher once
// targeted the 10,240 B CloudFront Functions ceiling; that adapter line is
// abandoned and the number survives only as context in the diagnostics.)
const PEERS = ['@uirouter/core', 'hono'];
const REPORTED = [
  'index.ts',
  'redirects.ts',
  'simulate.ts',
  'connect.ts',
  'fetch.ts',
  'hono.ts',
  'vite.ts',
];

const bundleEntry = (
  entry: string,
  bundler: Bundler,
  options: BundleOptions,
): ReturnType<typeof probe> =>
  probe(
    fileURLToPath(new URL(`../src/${entry}`, import.meta.url)),
    bundler,
    options,
  );

const gzipBytes = (code: string): number => gzipSync(code).byteLength;

for (const bundler of bundlers) {
  describe(`bundle size (${bundler})`, () => {
    it('bundles the matcher tier from zero node_modules inputs', async (t) => {
      const { entry, inputs } = await bundleEntry('url-matcher.ts', bundler, {
        minify: true,
      });
      t.diagnostic(
        `url-matcher.ts: ${entry.bytes} B minified, ${gzipBytes(entry.code)} B gzip`,
      );
      const deps = inputs.filter((input) => input.includes('node_modules'));
      assert.deepEqual(deps, [], 'matcher tier pulled in dependencies');
    });

    it('reports the remaining entry sizes (visibility, not a gate)', async (t) => {
      for (const file of REPORTED) {
        const { entry } = await bundleEntry(file, bundler, {
          minify: true,
          external: PEERS,
        });
        t.diagnostic(
          `${file}: ${entry.bytes} B minified, ${gzipBytes(entry.code)} B gzip`,
        );
      }
    });
  });
}
