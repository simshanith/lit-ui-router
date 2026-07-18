import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { bundleEntry, bundlers } from '@tools/bundle-probe';
import { readPackageProbe } from '@tools/bundle-probe/entries';

// Entries derive from the exports map — new exports join the report without
// touching this file. Peers are the consumer's own installs; externalizing
// them prices only this package's code in the reported entries. The matcher
// is bundled with NO externals: its dependency-free claim must hold with
// nothing supplied from outside. Size is governed by the codecov
// bundle_analysis check, so entry sizes are reported as diagnostics, not
// gated. (History: the matcher once targeted the 10,240 B CloudFront
// Functions ceiling; that adapter line is abandoned and the number survives
// only as context in the diagnostics.)
const { declared, entries } = await readPackageProbe(
  fileURLToPath(new URL('..', import.meta.url)),
);
const matcher = entries.find((entry) => entry.label === 'matcher');
const reported = entries.filter((entry) => entry !== matcher);

const gzipBytes = (code: string): number => gzipSync(code).byteLength;

for (const bundler of bundlers) {
  describe(`bundle size (${bundler})`, () => {
    it('bundles the matcher tier from zero node_modules inputs', async (t) => {
      assert.ok(matcher, 'expected a matcher export');
      const { entry, inputs } = await bundleEntry(matcher.file, bundler, {
        minify: true,
      });
      t.diagnostic(
        `matcher: ${entry.bytes} B minified, ${gzipBytes(entry.code)} B gzip`,
      );
      const deps = inputs.filter((input) => input.includes('node_modules'));
      assert.deepEqual(deps, [], 'matcher tier pulled in dependencies');
    });

    it('reports the remaining entry sizes (visibility, not a gate)', async (t) => {
      for (const { label, file } of reported) {
        const { entry } = await bundleEntry(file, bundler, {
          minify: true,
          external: declared,
        });
        t.diagnostic(
          `${label}: ${entry.bytes} B minified, ${gzipBytes(entry.code)} B gzip`,
        );
      }
    });
  });
}
