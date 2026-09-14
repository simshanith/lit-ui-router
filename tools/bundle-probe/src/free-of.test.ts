// The claim this gate enforces lives or dies on one distinction — a static
// import reaches the package, a dynamic one does not — so the fixtures differ
// in nothing else, and both bundlers answer for both.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { bundleEntry, bundlers } from './bundle.ts';
import { packageOf, staticExternals, violations } from './free-of.ts';

const fixture = (name: string): string =>
  fileURLToPath(new URL(path.join('../fixtures', name), import.meta.url));

const bundle = (name: string, bundler: (typeof bundlers)[number]) =>
  bundleEntry(fixture(name), bundler, {
    external: ['rolldown'],
    annotations: false,
  });

describe('packageOf', () => {
  it('takes the package off a subpath specifier', () => {
    assert.equal(packageOf('lit/directive.js'), 'lit');
  });

  it('keeps both segments of a scoped name', () => {
    assert.equal(packageOf('@uirouter/core/lib/index.js'), '@uirouter/core');
    assert.equal(packageOf('@uirouter/core'), '@uirouter/core');
  });
});

for (const bundler of bundlers) {
  describe(`free-of (${bundler})`, () => {
    it('fails an entry that statically imports the named package', async () => {
      const result = await bundle('static-entry.ts', bundler);
      assert.deepEqual(staticExternals(result), ['rolldown']);
      assert.deepEqual(violations(result, ['rolldown']), ['rolldown']);
    });

    it('passes an entry that reaches it only through a dynamic import', async () => {
      const result = await bundle('lazy-entry.ts', bundler);
      assert.deepEqual(staticExternals(result), []);
      assert.deepEqual(violations(result, ['rolldown']), []);
    });

    it('ignores packages no claim names', async () => {
      const result = await bundle('static-entry.ts', bundler);
      assert.deepEqual(violations(result, ['esbuild']), []);
    });
  });
}
