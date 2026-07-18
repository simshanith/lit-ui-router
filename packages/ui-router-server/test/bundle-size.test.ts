import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gzipSync } from 'node:zlib';

import { bundleEntry, bundlers } from './bundle.ts';

// CloudFront Functions rejects functions over 10,240 bytes; the matcher
// tier's contract is fitting under that ceiling with zero runtime deps.
const CFF_CEILING = 10_240;

// Peers are the consumer's own installs; externalizing them prices only this
// package's code in the reported entries. The matcher is bundled with NO
// externals: its budget must hold with nothing supplied from outside.
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

const gzipBytes = (code: string): number => gzipSync(code).byteLength;

for (const bundler of bundlers) {
  describe(`bundle size (${bundler})`, () => {
    it('fits the matcher tier under the CloudFront Functions ceiling', async (t) => {
      const { entry } = await bundleEntry('url-matcher.ts', bundler, {
        minify: true,
      });
      t.diagnostic(
        `url-matcher.ts: ${entry.bytes} B minified, ${gzipBytes(entry.code)} B gzip (ceiling ${CFF_CEILING} B)`,
      );
      assert.ok(
        entry.bytes <= CFF_CEILING,
        `matcher is ${entry.bytes} B minified; the CloudFront Functions ceiling is ${CFF_CEILING} B`,
      );
    });

    it('bundles the matcher tier from zero node_modules inputs', async () => {
      const { inputs } = await bundleEntry('url-matcher.ts', bundler, {
        minify: true,
      });
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
