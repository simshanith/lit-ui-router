import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pickTarball, strippedManifest } from './release-pack.core.ts';

describe('strippedManifest', () => {
  const manifest = {
    name: 'lit-ui-router',
    version: '1.8.0',
    scripts: { build: 'tsc', 'commit:changelog': 'echo' },
    dependencies: { lit: '^3.0.0' },
    devDependencies: { '@tools/typedoc-plugin-lit-ui-router': 'workspace:*' },
    peerDependencies: { '@uirouter/core': '^6.0.0' },
  };

  it('drops exactly devDependencies and scripts, like npm pkg delete did', () => {
    assert.deepEqual(strippedManifest(manifest), {
      name: 'lit-ui-router',
      version: '1.8.0',
      dependencies: { lit: '^3.0.0' },
      peerDependencies: { '@uirouter/core': '^6.0.0' },
    });
  });

  it('preserves key order of the surviving fields', () => {
    assert.deepEqual(Object.keys(strippedManifest(manifest)), [
      'name',
      'version',
      'dependencies',
      'peerDependencies',
    ]);
  });

  it('is a no-op shape-wise when the fields are already absent', () => {
    const bare = { name: 'x', version: '1.0.0' };
    assert.deepEqual(strippedManifest(bare), bare);
  });

  it('does not mutate the manifest it was handed', () => {
    // release-pack restores from the original bytes, but the caller also holds
    // this object across the pack — stripping must not reach back into it.
    const source = { ...manifest };
    strippedManifest(source);
    assert.deepEqual(source, manifest);
  });
});

describe('pickTarball', () => {
  it('finds the single .tgz among package files', () => {
    assert.equal(
      pickTarball(['dist', 'package.json', 'lit-ui-router-1.8.0.tgz']),
      'lit-ui-router-1.8.0.tgz',
    );
  });

  it('names the failure on zero or multiple tarballs', () => {
    assert.throws(() => pickTarball(['dist', 'package.json']), /found 0/);
    assert.throws(
      () => pickTarball(['a-1.0.0.tgz', 'a-0.9.0.tgz']),
      /found 2: a-1\.0\.0\.tgz, a-0\.9\.0\.tgz/,
    );
  });
});
