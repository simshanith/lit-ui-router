import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Member } from '@tools/shared/workspace.ts';

import {
  dependentsOf,
  failureMessage,
  installArgs,
} from './release-dependent-floor-gate.core.ts';

const guards = {
  'check:bundle': 'floor-guard && check-bundle-inputs',
  'typecheck:peer-floor':
    'floor-guard && floor-types-guard tsconfig.peer-floor.json && tsc -p tsconfig.peer-floor.json --noEmit',
};

const members: Member[] = [
  { name: '<root>', dir: '<root>', manifest: { scripts: {} } },
  {
    name: 'ui-router-server',
    dir: 'packages/ui-router-server',
    manifest: { scripts: { 'check:bundle': guards['check:bundle'] } },
  },
  {
    name: 'lit-ui-router-ssr',
    dir: 'packages/lit-ui-router-ssr',
    manifest: {
      scripts: guards,
      peerDependencies: { 'ui-router-server': 'catalog:publishedPeerSsr' },
      devDependencies: {
        'ui-router-server': 'catalog:workspace',
        'ui-router-server-floor': 'catalog:peerFloorSsr',
      },
    },
  },
  {
    name: 'bundled-consumer',
    dir: 'packages/bundled-consumer',
    manifest: {
      scripts: { 'check:bundle': guards['check:bundle'] },
      dependencies: { 'ui-router-server': 'catalog:publishedDependencies' },
    },
  },
  {
    name: 'unguarded-consumer',
    dir: 'packages/unguarded-consumer',
    manifest: {
      scripts: {},
      peerDependencies: { 'ui-router-server': 'catalog:publishedPeer' },
    },
  },
  {
    name: 'sample-app',
    dir: 'apps/sample-app',
    manifest: {
      private: true,
      scripts: guards,
      dependencies: { 'ui-router-server': 'catalog:workspace' },
    },
  },
];

describe('dependentsOf', () => {
  it('selects published dependents with a guard, never the package itself', () => {
    assert.deepEqual(dependentsOf('ui-router-server', members), [
      {
        name: 'bundled-consumer',
        kind: 'dependency',
        rangeCatalog: 'publishedDependencies',
        floorCatalog: undefined,
        turboArgs: ['run', 'check:bundle', '--filter=bundled-consumer'],
      },
      {
        name: 'lit-ui-router-ssr',
        kind: 'peer',
        rangeCatalog: 'publishedPeerSsr',
        floorCatalog: 'peerFloorSsr',
        turboArgs: [
          'run',
          'check:bundle',
          'typecheck:peer-floor',
          '--filter=lit-ui-router-ssr',
        ],
      },
    ]);
  });

  it('returns nothing for a package no one depends on', () => {
    assert.deepEqual(dependentsOf('lit-ui-router-ssr', members), []);
  });

  it('rejects a non-member before running anything', () => {
    assert.throws(
      () => dependentsOf('nonexistent-package', members),
      /not a workspace member/,
    );
  });
});

describe('installArgs', () => {
  it('relinks only the dependents, from the lockfile as fixed', () => {
    assert.deepEqual(installArgs(dependentsOf('ui-router-server', members)), [
      'install',
      '--frozen-lockfile',
      '--filter=bundled-consumer',
      '--filter=lit-ui-router-ssr',
    ]);
  });
});

describe('failureMessage', () => {
  it('names the dependent, the range it needs and both ways out', () => {
    const failed = dependentsOf('ui-router-server', members).filter(
      ({ name }) => name === 'lit-ui-router-ssr',
    );

    const message = failureMessage({
      packageName: 'ui-router-server',
      version: '0.8.0',
      failed,
      rangeOf: (catalog) =>
        catalog === 'publishedPeerSsr' ? '^0.7.0' : undefined,
    });

    assert.match(message, /^ui-router-server@0\.8\.0 would release with 1 /);
    assert.match(
      message,
      /lit-ui-router-ssr: its ui-router-server peer floor no longer proves "\^0\.7\.0" .* it needs "\^0\.8\.0"/,
    );
    assert.match(
      message,
      /narrow publishedPeerSsr ui-router-server to "\^0\.8\.0" and repin ui-router-server-floor in peerFloorSsr to 0\.8\.0 in this release/,
    );
    assert.match(
      message,
      /land lit-ui-router-ssr's change after ui-router-server@0\.8\.0 is released/,
    );
  });
});
