import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type EdgeMember,
  filterArgs,
  formatMissing,
  missingFromClosure,
  selectedNames,
  unselectedWorkspaceEdges,
} from './check-release-closure.core.ts';

describe('filterArgs', () => {
  it('splits the filter string into pnpm argv', () => {
    assert.deepEqual(
      filterArgs(' --filter @tools/release...  --filter {packages/*}... '),
      ['--filter', '@tools/release...', '--filter', '{packages/*}...'],
    );
  });
});

describe('selectedNames', () => {
  it('reads project names off pnpm ls --json', () => {
    const json = JSON.stringify([
      { name: '@tools/release', path: '/w/tools/release' },
      { name: 'lit-ui-router', path: '/w/packages/lit-ui-router' },
    ]);
    assert.deepEqual(selectedNames(json), ['@tools/release', 'lit-ui-router']);
  });

  it('rejects output that is not a project list', () => {
    assert.throws(() => selectedNames('{}'), /did not return an array/u);
    assert.throws(() => selectedNames('[{}]'), /without a name/u);
  });
});

describe('missingFromClosure', () => {
  const selected = ['@tools/release', 'lit-ui-router', 'lit-ui-router-mobx'];

  it('passes when every required member is selected', () => {
    assert.deepEqual(
      missingFromClosure(['lit-ui-router-mobx', 'lit-ui-router'], selected),
      [],
    );
  });

  it('reports the unselected members sorted', () => {
    assert.deepEqual(
      missingFromClosure(
        ['ui-router-server', 'lit-ui-router', 'a-new-pkg'],
        selected,
      ),
      ['a-new-pkg', 'ui-router-server'],
    );
  });
});

describe('formatMissing', () => {
  it('names the need, the members and the rationale', () => {
    const text = formatMissing(
      { need: 'release-it devDependencies', why: 'because' },
      ['a-new-pkg'],
    );
    assert.equal(
      text,
      'release-it devDependencies outside RELEASE_CLOSURE: a-new-pkg: because',
    );
  });
});

describe('unselectedWorkspaceEdges', () => {
  const members: EdgeMember[] = [
    {
      name: '@tools/release',
      manifest: { devDependencies: { '@tools/shared': 'catalog:workspace' } },
    },
    {
      name: 'lit-ui-router',
      manifest: {
        dependencies: { '@uirouter/core': 'catalog:' },
        devDependencies: { '@tools/happy-dom': 'workspace:*' },
      },
    },
    { name: '@tools/shared', manifest: {} },
    { name: '@tools/happy-dom' },
    {
      name: 'sample-app',
      manifest: { dependencies: { '@tools/vue-check': 'catalog:workspace' } },
    },
    { name: '@tools/vue-check' },
  ];

  it('passes when every workspace dependency of the selection is selected', () => {
    assert.deepEqual(
      unselectedWorkspaceEdges(members, [
        '@tools/release',
        '@tools/shared',
        'lit-ui-router',
        '@tools/happy-dom',
      ]),
      [],
    );
  });

  it('reports edges out of the selection whatever the protocol, sorted', () => {
    assert.deepEqual(
      unselectedWorkspaceEdges(members, ['lit-ui-router', '@tools/release']),
      ['@tools/release -> @tools/shared', 'lit-ui-router -> @tools/happy-dom'],
    );
  });

  it('ignores npm dependencies and unselected dependents', () => {
    assert.deepEqual(unselectedWorkspaceEdges(members, ['@tools/shared']), []);
  });
});
