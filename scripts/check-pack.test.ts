import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  findPackedManifestViolations,
  findUnsubstitutedRefs,
  formatPackedManifestReport,
  formatReport,
} from './check-pack.core.ts';

describe('findUnsubstitutedRefs', () => {
  it('passes a fully substituted manifest', () => {
    const manifest = {
      dependencies: { '@uirouter/core': '^6.0.8', lit: '^3.0.0' },
      peerDependencies: { mobx: '^6.0.0', 'lit-ui-router': '^1.5.1' },
      devDependencies: { vitest: '^4.1.9' },
    };
    assert.deepEqual(findUnsubstitutedRefs(manifest), []);
  });

  it('flags catalog: refs in every dependency field', () => {
    const manifest = {
      dependencies: { lit: 'catalog:publishedPeer' },
      devDependencies: { vitest: 'catalog:' },
      peerDependencies: { mobx: 'catalog:' },
      optionalDependencies: { fsevents: 'catalog:' },
    };
    assert.deepEqual(findUnsubstitutedRefs(manifest), [
      { field: 'dependencies', dep: 'lit', spec: 'catalog:publishedPeer' },
      { field: 'devDependencies', dep: 'vitest', spec: 'catalog:' },
      { field: 'peerDependencies', dep: 'mobx', spec: 'catalog:' },
      { field: 'optionalDependencies', dep: 'fsevents', spec: 'catalog:' },
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
    assert.deepEqual(findUnsubstitutedRefs({ dependencies: { odd: 42 } }), []);
  });
});

describe('formatReport', () => {
  it('passes when every packed manifest is clean', () => {
    const { ok, text } = formatReport([
      { name: 'lit-ui-router', dir: 'packages/lit-ui-router', refs: [] },
      {
        name: 'lit-ui-router-mobx',
        dir: 'packages/lit-ui-router-mobx',
        refs: [],
      },
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

describe('findPackedManifestViolations', () => {
  it('passes a clean packed manifest', () => {
    const manifest = {
      name: 'lit-ui-router',
      dependencies: { '@uirouter/core': '^6.0.8' },
      peerDependencies: { lit: '^3.0.0' },
    };
    assert.deepEqual(findPackedManifestViolations(manifest), []);
  });

  it('flags devDependencies, even when empty (the key should be deleted)', () => {
    assert.deepEqual(findPackedManifestViolations({ devDependencies: {} }), [
      'devDependencies leaked into packed manifest',
    ]);
  });

  it('flags scripts, even when empty (the key should be deleted)', () => {
    assert.deepEqual(findPackedManifestViolations({ scripts: {} }), [
      'scripts leaked into packed manifest',
    ]);
  });

  it('flags catalog:/workspace: anywhere in the runtime dependency fields', () => {
    assert.deepEqual(
      findPackedManifestViolations({
        dependencies: { lit: 'catalog:publishedPeer' },
      }),
      ['unsubstituted refs in packed manifest'],
    );
    assert.deepEqual(
      findPackedManifestViolations({
        peerDependencies: { 'lit-ui-router': 'workspace:^' },
      }),
      ['unsubstituted refs in packed manifest'],
    );
    // Substring semantics, blunter than findUnsubstitutedRefs's prefix test:
    // an aliased spec embedding the protocol mid-string still fails.
    assert.deepEqual(
      findPackedManifestViolations({
        optionalDependencies: { alias: 'npm:workspace:^1.0.0' },
      }),
      ['unsubstituted refs in packed manifest'],
    );
  });

  it('does not scan devDependencies for refs — their presence alone fails', () => {
    assert.deepEqual(
      findPackedManifestViolations({ devDependencies: { vitest: 'catalog:' } }),
      ['devDependencies leaked into packed manifest'],
    );
  });

  it('reports every violation class at once', () => {
    const manifest = {
      scripts: { build: 'turbo run build' },
      devDependencies: { vitest: '^4.1.9' },
      dependencies: { lit: 'catalog:publishedPeer' },
    };
    assert.deepEqual(findPackedManifestViolations(manifest), [
      'devDependencies leaked into packed manifest',
      'scripts leaked into packed manifest',
      'unsubstituted refs in packed manifest',
    ]);
  });

  it('ignores an empty manifest', () => {
    assert.deepEqual(findPackedManifestViolations({}), []);
  });
});

describe('formatPackedManifestReport', () => {
  it('passes when there are no violations', () => {
    const { ok, text } = formatPackedManifestReport([]);
    assert.equal(ok, true);
    assert.match(text, /packed manifest clean/);
  });

  it('fails and lists every violation', () => {
    const { ok, text } = formatPackedManifestReport([
      'devDependencies leaked into packed manifest',
      'scripts leaked into packed manifest',
    ]);
    assert.equal(ok, false);
    assert.match(text, /✗ packed manifest check failed/);
    assert.match(text, /devDependencies leaked/);
    assert.match(text, /scripts leaked/);
  });
});
