import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Member } from '@tools/shared/workspace.ts';

import { gateDecision } from './release-peer-floor-gate.core.ts';

const members: Member[] = [
  { name: '<root>', dir: '<root>', manifest: { scripts: {} } },
  {
    name: 'lit-ui-router',
    dir: 'packages/lit-ui-router',
    manifest: { scripts: { build: 'tsc' } },
  },
  {
    name: 'lit-ui-router-mobx',
    dir: 'packages/lit-ui-router-mobx',
    manifest: {
      scripts: { 'typecheck:peer-floor': 'node peer-floor-guard.ts' },
    },
  },
];

describe('gateDecision', () => {
  it('checks a package that defines the script, filtered to that package', () => {
    assert.deepEqual(gateDecision('lit-ui-router-mobx', members), {
      kind: 'check',
      turboArgs: ['run', 'typecheck:peer-floor', '--filter=lit-ui-router-mobx'],
    });
  });

  it('skips a package without the script — the peer bump is never blocked', () => {
    const decision = gateDecision('lit-ui-router', members);
    assert.equal(decision.kind, 'skip');
    assert.match(
      decision.kind === 'skip' ? decision.reason : '',
      /defines no typecheck:peer-floor script/,
    );
  });

  it('rejects a non-member before running anything', () => {
    assert.throws(
      () => gateDecision('nonexistent-package', members),
      /not a workspace member/,
    );
  });
});
