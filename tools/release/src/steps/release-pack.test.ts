import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pickTarball, strippedManifestJson } from './release-pack.core.ts';

describe('strippedManifestJson', () => {
  const manifest = {
    name: 'lit-ui-router',
    version: '1.8.0',
    scripts: { build: 'tsc', 'commit:changelog': 'echo' },
    dependencies: { lit: '^3.0.0' },
    devDependencies: { 'typedoc-plugin-lit-ui-router': 'workspace:*' },
    peerDependencies: { '@uirouter/core': '^6.0.0' },
  };

  it('drops exactly devDependencies and scripts, like npm pkg delete did', () => {
    const stripped: unknown = JSON.parse(
      strippedManifestJson(JSON.stringify(manifest)),
    );
    assert.deepEqual(stripped, {
      name: 'lit-ui-router',
      version: '1.8.0',
      dependencies: { lit: '^3.0.0' },
      peerDependencies: { '@uirouter/core': '^6.0.0' },
    });
  });

  it('preserves key order of the surviving fields', () => {
    const stripped = strippedManifestJson(JSON.stringify(manifest));
    const keys = Object.keys(JSON.parse(stripped) as Record<string, unknown>);
    assert.deepEqual(keys, [
      'name',
      'version',
      'dependencies',
      'peerDependencies',
    ]);
  });

  it('is a no-op shape-wise when the fields are already absent', () => {
    const bare = { name: 'x', version: '1.0.0' };
    assert.deepEqual(
      JSON.parse(strippedManifestJson(JSON.stringify(bare))),
      bare,
    );
  });

  it('ends with a newline (a manifest is a text file)', () => {
    assert.ok(strippedManifestJson('{}').endsWith('\n'));
  });

  it('rejects non-object manifests', () => {
    assert.throws(() => strippedManifestJson('[]'), /JSON object/);
    assert.throws(() => strippedManifestJson('"str"'), /JSON object/);
    assert.throws(() => strippedManifestJson('null'), /JSON object/);
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
