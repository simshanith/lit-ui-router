import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type WarnLaneState,
  type WarnMessage,
  buildSnapshot,
  checkSnapshotIntegrity,
  diffWarnings,
  findWarnLaneState,
  formatWarnLaneMarker,
  parseWarnLaneMarker,
  ruleTotals,
  statusOf,
  tallyFiles,
  totalWarnings,
  warnLaneLine,
} from './warn-lanes.core.ts';

function message(
  file: string,
  ruleId: string | null,
  severity: 1 | 2 = 1,
): WarnMessage {
  return { file, line: 1, column: 1, ruleId, message: 'nope', severity };
}

describe('tallyFiles', () => {
  it('counts warnings per file per rule and drops errors', () => {
    assert.deepEqual(
      tallyFiles([
        message('b.ts', 'lit-a11y/anchor-is-valid'),
        message('a.ts', 'lit-a11y/anchor-is-valid'),
        message('a.ts', 'lit-a11y/anchor-is-valid'),
        message('a.ts', 'lit-a11y/alt-text'),
        message('a.ts', 'lit/no-invalid-html', 2),
      ]),
      {
        'a.ts': { 'lit-a11y/alt-text': 1, 'lit-a11y/anchor-is-valid': 2 },
        'b.ts': { 'lit-a11y/anchor-is-valid': 1 },
      },
    );
  });

  it('keys a rule-less warning under a reserved name', () => {
    assert.deepEqual(tallyFiles([message('a.ts', null)]), {
      'a.ts': { '(no rule)': 1 },
    });
  });

  it('sorts files and rules so a regeneration diffs only real moves', () => {
    const files = tallyFiles([
      message('z.ts', 'z-rule'),
      message('a.ts', 'z-rule'),
      message('a.ts', 'a-rule'),
    ]);
    assert.deepEqual(Object.keys(files), ['a.ts', 'z.ts']);
    assert.deepEqual(Object.keys(files['a.ts'] ?? {}), ['a-rule', 'z-rule']);
  });
});

describe('ruleTotals / totalWarnings', () => {
  const files = {
    'a.ts': { 'rule-a': 2, 'rule-b': 1 },
    'b.ts': { 'rule-b': 4 },
  };

  it('sums across files, biggest block first', () => {
    assert.deepEqual(Object.entries(ruleTotals(files)), [
      ['rule-b', 5],
      ['rule-a', 2],
    ]);
    assert.equal(totalWarnings(files), 7);
  });
});

describe('checkSnapshotIntegrity', () => {
  const files = { 'a.ts': { 'rule-a': 2 } };

  it('passes a generated snapshot', () => {
    assert.deepEqual(
      checkSnapshotIntegrity(buildSnapshot('//#lane', files)),
      [],
    );
  });

  it('rejects a hand-widened total', () => {
    const snapshot = { ...buildSnapshot('//#lane', files), total: 5 };
    assert.deepEqual(checkSnapshotIntegrity(snapshot), [
      'snapshot total is 5 but files[] sums to 2',
    ]);
  });

  it('rejects rule totals that disagree with files[]', () => {
    const snapshot = {
      ...buildSnapshot('//#lane', files),
      rules: { 'rule-a': 2, 'rule-b': 3 },
    };
    assert.deepEqual(checkSnapshotIntegrity(snapshot), [
      'snapshot rules[rule-b] is 3 but files[] sums to 0',
    ]);
  });
});

describe('diffWarnings', () => {
  const snapshot = {
    'a.ts': { 'rule-a': 2, 'rule-b': 1 },
    'b.ts': { 'rule-b': 1 },
  };

  it('is silent when the inventory matches the floor', () => {
    assert.deepEqual(diffWarnings(snapshot, snapshot), {
      regressions: [],
      improvements: [],
    });
  });

  it('reports a new rule in a snapshotted file as a regression', () => {
    const { regressions } = diffWarnings(snapshot, {
      ...snapshot,
      'a.ts': { ...snapshot['a.ts'], 'rule-c': 1 },
    });
    assert.deepEqual(regressions, [
      { file: 'a.ts', rule: 'rule-c', was: 0, now: 1 },
    ]);
  });

  it('reports a warning in a brand-new file as a regression', () => {
    const { regressions } = diffWarnings(snapshot, {
      ...snapshot,
      'c.ts': { 'rule-a': 1 },
    });
    assert.deepEqual(regressions, [
      { file: 'c.ts', rule: 'rule-a', was: 0, now: 1 },
    ]);
  });

  it('closes the swap hole: a fix elsewhere does not fund a new warning', () => {
    // Same total (3), but rule-a lost one in a.ts and rule-b gained one in b.ts.
    const { regressions, improvements } = diffWarnings(snapshot, {
      'a.ts': { 'rule-a': 1, 'rule-b': 1 },
      'b.ts': { 'rule-b': 2 },
    });
    assert.deepEqual(regressions, [
      { file: 'b.ts', rule: 'rule-b', was: 1, now: 2 },
    ]);
    assert.deepEqual(improvements, [
      { file: 'a.ts', rule: 'rule-a', was: 2, now: 1 },
    ]);
  });

  it('reports a drained entry as an improvement, not a regression', () => {
    assert.deepEqual(diffWarnings(snapshot, { 'a.ts': { 'rule-b': 1 } }), {
      regressions: [],
      improvements: [
        { file: 'a.ts', rule: 'rule-a', was: 2, now: 0 },
        { file: 'b.ts', rule: 'rule-b', was: 1, now: 0 },
      ],
    });
  });

  it('treats an empty snapshot as the end state: any warning regresses', () => {
    const { regressions } = diffWarnings({}, { 'a.ts': { 'rule-a': 1 } });
    assert.deepEqual(regressions, [
      { file: 'a.ts', rule: 'rule-a', was: 0, now: 1 },
    ]);
  });
});

describe('statusOf', () => {
  it('names the three positions relative to the floor', () => {
    assert.equal(statusOf(36, 36), 'at-floor');
    assert.equal(statusOf(35, 36), 'below-floor');
    assert.equal(statusOf(37, 36), 'above-floor');
  });
});

describe('the marker', () => {
  const state: WarnLaneState = {
    task: '//#lint:elements',
    total: 36,
    floor: 36,
    status: 'at-floor',
    regressions: 0,
    rules: { 'lit-a11y/anchor-is-valid': 32, 'lit-a11y/alt-text': 4 },
  };

  it('round-trips through a single log line', () => {
    const line = formatWarnLaneMarker(state);
    assert.equal(line.split('\n').length, 1);
    assert.deepEqual(parseWarnLaneMarker(line), state);
  });

  it('ignores lines that are not markers, and malformed payloads', () => {
    assert.equal(
      parseWarnLaneMarker('36 problems (0 errors, 36 warnings)'),
      undefined,
    );
    assert.equal(parseWarnLaneMarker('warn-lane: {oops'), undefined);
    assert.equal(parseWarnLaneMarker('warn-lane: {"total":1}'), undefined);
  });

  it('finds the last marker in a task log', () => {
    const log = [
      '$ lint-elements',
      formatWarnLaneMarker({ ...state, total: 1 }),
      'some later output',
      formatWarnLaneMarker(state),
      '',
    ].join('\n');
    assert.deepEqual(findWarnLaneState(log), state);
  });

  it('returns nothing for a log with no marker', () => {
    assert.equal(findWarnLaneState('all good\n'), undefined);
  });
});

describe('warnLaneLine', () => {
  it('names a lane sitting exactly on its floor', () => {
    assert.equal(
      warnLaneLine('//#lint:elements', {
        task: '//#lint:elements',
        total: 36,
        floor: 36,
        status: 'at-floor',
        regressions: 0,
        rules: { 'lit-a11y/anchor-is-valid': 32 },
      }),
      '//#lint:elements — 36 warnings, at the snapshot floor — lit-a11y/anchor-is-valid 32',
    );
  });

  it('calls a stale snapshot stale', () => {
    assert.match(
      warnLaneLine('//#lint:elements', {
        task: '//#lint:elements',
        total: 30,
        floor: 36,
        status: 'below-floor',
        regressions: 0,
        rules: {},
      }),
      /6 below the snapshot floor — the snapshot is stale$/,
    );
  });

  it('leads with the regression count when the snapshot was breached', () => {
    // The case a scalar budget cannot see: a fix funded a new warning, so the
    // total — and the status — never moved.
    assert.match(
      warnLaneLine('//#lint:elements', {
        task: '//#lint:elements',
        total: 36,
        floor: 36,
        status: 'at-floor',
        regressions: 1,
        rules: { 'lit-a11y/alt-text': 2 },
      }),
      /1 warning entry not in the snapshot \(36 warnings, floor 36\)/,
    );
  });

  it('says so when a watched lane left no state', () => {
    assert.match(
      warnLaneLine('//#lint:elements', undefined),
      /no state in this run/,
    );
  });
});
