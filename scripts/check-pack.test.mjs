import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findUnsubstitutedRefs, formatReport } from './check-pack.core.mjs';

describe('findUnsubstitutedRefs', () => {
  it('passes a fully substituted manifest', () => {
    const manifest = {
      dependencies: { '@uirouter/core': '^6.0.8', lit: '^3.0.0' },
      peerDependencies: { mobx: '^6.0.0', 'lit-ui-router': '^1.5.1' },
      devDependencies: { vitest: '^4.1.9' },
    };
    assert.deepEqual(findUnsubstitutedRefs(manifest), []);
  });

  it('flags catalog: refs in any dependency field', () => {
    const manifest = {
      dependencies: { lit: 'catalog:publishedPeer' },
      devDependencies: { vitest: 'catalog:' },
    };
    assert.deepEqual(findUnsubstitutedRefs(manifest), [
      { field: 'dependencies', dep: 'lit', spec: 'catalog:publishedPeer' },
      { field: 'devDependencies', dep: 'vitest', spec: 'catalog:' },
    ]);
  });

  it('flags workspace: refs', () => {
    const manifest = {
      peerDependencies: { 'lit-ui-router': 'workspace:^' },
    };
    assert.deepEqual(findUnsubstitutedRefs(manifest), [
      { field: 'peerDependencies', dep: 'lit-ui-router', spec: 'workspace:^' },
    ]);
  });

  it('ignores missing fields and non-string specifiers', () => {
    assert.deepEqual(findUnsubstitutedRefs({}), []);
    assert.deepEqual(findUnsubstitutedRefs(undefined), []);
    assert.deepEqual(
      findUnsubstitutedRefs({ dependencies: { odd: 42 } }),
      [],
    );
  });
});

describe('formatReport', () => {
  it('passes when every packed manifest is clean', () => {
    const { ok, text } = formatReport([
      { name: 'lit-ui-router', dir: 'packages/lit-ui-router', refs: [] },
      { name: 'lit-ui-router-mobx', dir: 'packages/lit-ui-router-mobx', refs: [] },
    ]);
    assert.equal(ok, true);
    assert.match(text, /✓ pack check passed — 2 publishable packages/);
  });

  it('fails and lists every leaked ref', () => {
    const { ok, text } = formatReport([
      { name: 'lit-ui-router', dir: 'packages/lit-ui-router', refs: [] },
      {
        name: 'lit-ui-router-mobx',
        dir: 'packages/lit-ui-router-mobx',
        refs: [
          {
            field: 'peerDependencies',
            dep: 'lit-ui-router',
            spec: 'workspace:^',
          },
          {
            field: 'peerDependencies',
            dep: 'lit',
            spec: 'catalog:publishedPeer',
          },
        ],
      },
    ]);
    assert.equal(ok, false);
    assert.match(text, /✗ pack check failed/);
    assert.match(text, /lit-ui-router-mobx \(packages\/lit-ui-router-mobx\)/);
    assert.match(text, /workspace:\^/);
    assert.match(text, /catalog:publishedPeer/);
    assert.doesNotMatch(text, /lit-ui-router \(packages\/lit-ui-router\)/);
  });

  it('fails when no publishable packages were found', () => {
    const { ok, text } = formatReport([]);
    assert.equal(ok, false);
    assert.match(text, /no publishable workspace packages/);
  });
});
