import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  auditSplits,
  controlledNames,
  formatSplit,
  lockVersions,
  parseLock,
  parsePackageKey,
} from './single-version.core.ts';

const lock = parseLock(`lockfileVersion: '9.0'

catalogs:
  default:
    esbuild:
      specifier: ^0.28.2
      version: 0.28.2
  mobx6-compat:
    mobx-6:
      specifier: npm:mobx@^6.16.1
      version: 6.16.1

overrides:
  'wrangler>esbuild': 0.28.2
  undici@>=7 <7.29.1: ^7.29.1
  'parent@>=1 <2>@scope/child': ^1.0.0
  'parent>@scope/floor@<1': ^1.0.0

importers:

  .:
    devDependencies:
      '@tools/shared':
        specifier: catalog:workspace
        version: link:tools/shared
      '@scope/pkg':
        specifier: ^1.0.0
        version: 1.2.3(typescript@5.9.3)
      lit-2:
        specifier: catalog:lit2-compat
        version: lit@2.8.0
      wrangler:
        specifier: ^4.0.0
        version: 4.136.1

packages:

  '@scope/pkg@1.2.3':
    resolution: {integrity: sha512-a}

  esbuild@0.28.1:
    resolution: {integrity: sha512-b}

  esbuild@0.28.2:
    resolution: {integrity: sha512-c}

  lit@2.8.0:
    resolution: {integrity: sha512-d}

  lit@3.3.3:
    resolution: {integrity: sha512-e}

  mobx@6.16.1:
    resolution: {integrity: sha512-f}

  undici@6.29.0:
    resolution: {integrity: sha512-k}

  undici@7.30.0:
    resolution: {integrity: sha512-g}

  wrangler@4.136.1:
    resolution: {integrity: sha512-h}

  chalk@4.1.2:
    resolution: {integrity: sha512-i}

  chalk@5.6.2:
    resolution: {integrity: sha512-j}
`);

describe('parsePackageKey', () => {
  it('splits a scoped name from its version', () => {
    assert.deepEqual(parsePackageKey('@scope/pkg@1.2.3'), {
      name: '@scope/pkg',
      version: '1.2.3',
    });
  });

  it('drops peer suffixes', () => {
    assert.deepEqual(
      parsePackageKey('vite@8.3.0(@types/node@24.13.6)(yaml@2.9.1)'),
      { name: 'vite', version: '8.3.0' },
    );
  });

  it('resolves an npm alias to its target', () => {
    assert.deepEqual(parsePackageKey('lit-2@npm:lit@2.8.0'), {
      name: 'lit',
      version: '2.8.0',
    });
  });

  it('ignores local protocols', () => {
    assert.equal(parsePackageKey('pkg@link:packages/pkg'), undefined);
    assert.equal(parsePackageKey('pkg@workspace:*'), undefined);
    assert.equal(parsePackageKey('pkg@file:vendor/pkg.tgz'), undefined);
  });
});

describe('lockVersions', () => {
  it('collects versions per name from packages keys', () => {
    const versions = lockVersions(lock);
    assert.deepEqual(versions.get('esbuild'), ['0.28.1', '0.28.2']);
    assert.deepEqual(versions.get('@scope/pkg'), ['1.2.3']);
  });
});

describe('controlledNames', () => {
  it('covers catalogs, unranged override targets and direct dependencies', () => {
    assert.deepEqual([...controlledNames(lock)].sort(), [
      '@scope/child',
      '@scope/pkg',
      'esbuild',
      'lit',
      'mobx',
      'wrangler',
    ]);
  });
});

describe('auditSplits', () => {
  const versions = lockVersions(lock);
  const controlled = controlledNames(lock);

  it('fails a controlled duplicate and passes single versions', () => {
    const { failures, allowed, stale } = auditSplits(versions, controlled, []);
    assert.deepEqual(failures, [
      { name: 'esbuild', versions: ['0.28.1', '0.28.2'] },
      { name: 'lit', versions: ['2.8.0', '3.3.3'] },
    ]);
    assert.deepEqual(allowed, []);
    assert.deepEqual(stale, []);
  });

  it('leaves transitive duplicates alone', () => {
    const { failures } = auditSplits(versions, controlled, []);
    assert.ok(!failures.some(({ name }) => name === 'chalk'));
  });

  it('moves an allowlisted duplicate out of failures', () => {
    const { failures, allowed } = auditSplits(versions, controlled, [
      { name: 'lit', why: 'lit2-compat' },
    ]);

    assert.deepEqual(
      failures.map(({ name }) => name),
      ['esbuild'],
    );
    assert.deepEqual(allowed, [{ name: 'lit', versions: ['2.8.0', '3.3.3'] }]);
  });

  it('reports an allowlist row that no longer splits as stale', () => {
    const { stale } = auditSplits(versions, controlled, [
      { name: 'mobx', why: 'mobx6-compat' },
      { name: 'gone', why: 'removed' },
    ]);

    assert.deepEqual(stale, ['mobx', 'gone']);
  });

  it('orders versions numerically', () => {
    const { failures } = auditSplits(
      new Map([['typescript', ['5.10.0', '5.9.3']]]),
      new Set(['typescript']),
      [],
    );

    assert.deepEqual(failures[0]?.versions, ['5.9.3', '5.10.0']);
  });
});

describe('formatSplit', () => {
  it('prints one terse line per package', () => {
    assert.equal(
      formatSplit({ name: 'esbuild', versions: ['0.28.1', '0.28.2'] }),
      'esbuild: 0.28.1, 0.28.2 (not allowlisted)',
    );
  });
});
