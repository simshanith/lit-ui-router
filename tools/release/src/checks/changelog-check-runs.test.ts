import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { DriftFinding } from '@tools/changelog/drift.ts';

import {
  CHANGELOG_CHECK_RUN_NAME,
  toChangelogCheckRun,
} from './changelog-check-runs.core.ts';

const DIFFERS: DriftFinding = {
  release: 'pkg@1.0.0',
  level: 'action',
  message: 'the section differs from the published notes',
};

const AHEAD: DriftFinding = {
  release: 'pkg@1.1.0',
  level: 'info',
  message: 'a section ahead of its GitHub release',
};

describe('toChangelogCheckRun', () => {
  it('passes with only notes, and lists them', () => {
    const run = toChangelogCheckRun([AHEAD], undefined);

    assert.equal(run.name, CHANGELOG_CHECK_RUN_NAME);
    assert.equal(run.conclusion, 'success');
    assert.match(run.summary, /`pkg@1\.1\.0`: a section ahead/);
  });

  it('asks for action on drift and points at the re-sync', () => {
    const run = toChangelogCheckRun([DIFFERS, AHEAD], undefined);

    assert.equal(run.conclusion, 'action_required');
    assert.match(run.title, /^1 CHANGELOG\.md finding/);
    assert.match(run.summary, /release-notes-resync\.yml/);
    assert.match(run.summary, /\*\*Findings\*\*\n\n- `pkg@1\.0\.0`/);
  });

  it('is neutral when the ledger is unreachable', () => {
    const run = toChangelogCheckRun([], 'ledger: HTTP 503');

    assert.equal(run.conclusion, 'neutral');
    assert.match(run.summary, /- ledger: HTTP 503/);
  });
});
