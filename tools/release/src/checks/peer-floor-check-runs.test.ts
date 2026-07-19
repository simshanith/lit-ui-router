import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Member } from '@tools/shared/workspace.ts';

import {
  peerFloorCheckRunName,
  peerFloorMembers,
  peerFloorTurboArgs,
  toPeerFloorCheckRun,
} from './peer-floor-check-runs.core.ts';

const REPO = 'simshanith/lit-ui-router';
const RELEASE_URL = `https://github.com/${REPO}/actions/workflows/bump-version.yml`;

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

describe('peerFloorCheckRunName', () => {
  it('composes the exact per-package run name', () => {
    assert.equal(
      peerFloorCheckRunName('lit-ui-router-mobx'),
      'peer-floor (lit-ui-router-mobx)',
    );
  });
});

describe('peerFloorMembers', () => {
  it('selects only members defining the script, never the root', () => {
    assert.deepEqual(
      peerFloorMembers(members).map((member) => member.name),
      ['lit-ui-router-mobx'],
    );
  });

  it('is empty when no package opts in — the tier stays inert', () => {
    assert.deepEqual(peerFloorMembers(members.slice(0, 2)), []);
  });
});

describe('peerFloorTurboArgs', () => {
  it('runs the task filtered to the one package', () => {
    assert.deepEqual(peerFloorTurboArgs('lit-ui-router-mobx'), [
      'run',
      'typecheck:peer-floor',
      '--filter=lit-ui-router-mobx',
    ]);
  });
});

describe('toPeerFloorCheckRun', () => {
  it('maps an honest floor to success', () => {
    const payload = toPeerFloorCheckRun(
      { name: 'lit-ui-router-mobx', ok: true },
      REPO,
    );
    assert.equal(payload.conclusion, 'success');
    assert.equal(payload.name, 'peer-floor (lit-ui-router-mobx)');
    assert.equal(
      payload.title,
      'src typechecks against the published peer floor',
    );
    assert.doesNotMatch(payload.summary, /To resolve/);
  });

  it('maps a stale floor to action_required, never failure', () => {
    const payload = toPeerFloorCheckRun(
      { name: 'lit-ui-router-mobx', ok: false },
      REPO,
    );
    assert.equal(payload.conclusion, 'action_required');
    assert.equal(
      payload.title,
      'floor stale: release the peer, then bump the publishedPeer floor',
    );
  });

  it('names the remedy path in a stale summary', () => {
    const { summary } = toPeerFloorCheckRun(
      { name: 'lit-ui-router-mobx', ok: false },
      REPO,
    );
    assert.match(summary, new RegExp(`\\(${RELEASE_URL}\\)`));
    assert.match(summary, /catalog:publishedPeer floor and the peerFloor pin/);
    assert.match(summary, /flips green on the floor/);
  });
});
