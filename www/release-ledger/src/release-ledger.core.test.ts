import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  apply,
  type EventType,
  EVENT_TYPES,
  moveDistTag,
  type Outcome,
  type ReleaseEvent,
  type State,
  STATES,
  type VersionRow,
} from './release-ledger.core.ts';
import {
  DEPRECATION,
  ENVELOPE,
  EVENTS,
  GH,
  NPM,
  ROWS,
  SHA,
} from './release-ledger.fixtures.ts';

type Expected = State | 'unchanged' | 'rejected';

const R = 'rejected';

const U = 'unchanged';

// Every state × event pair, fed the fixture row and an event repeating its facts.
const EXPECTED: Record<State | 'none', Record<EventType, Expected>> = {
  none: {
    tag_observed: 'tagged',
    npm_observed: R,
    gh_release_observed: R,
    deprecation_observed: R,
    undeprecation_observed: R,
    mismatch_observed: R,
    abandon: R,
    repair: R,
  },
  tagged: {
    tag_observed: U,
    npm_observed: 'published.active',
    gh_release_observed: 'drifted',
    deprecation_observed: R,
    undeprecation_observed: R,
    mismatch_observed: 'drifted',
    abandon: 'abandoned',
    repair: R,
  },
  'published.active': {
    tag_observed: U,
    npm_observed: U,
    gh_release_observed: 'released.active',
    deprecation_observed: 'published.deprecated',
    undeprecation_observed: U,
    mismatch_observed: 'drifted',
    abandon: R,
    repair: R,
  },
  'published.deprecated': {
    tag_observed: U,
    npm_observed: U,
    gh_release_observed: 'released.deprecated',
    deprecation_observed: U,
    undeprecation_observed: 'published.active',
    mismatch_observed: 'drifted',
    abandon: R,
    repair: R,
  },
  'released.active': {
    tag_observed: U,
    npm_observed: U,
    gh_release_observed: U,
    deprecation_observed: 'released.deprecated',
    undeprecation_observed: U,
    mismatch_observed: 'drifted',
    abandon: R,
    repair: R,
  },
  'released.deprecated': {
    tag_observed: U,
    npm_observed: U,
    gh_release_observed: U,
    deprecation_observed: U,
    undeprecation_observed: 'released.active',
    mismatch_observed: 'drifted',
    abandon: R,
    repair: R,
  },
  drifted: {
    tag_observed: U,
    npm_observed: U,
    gh_release_observed: U,
    deprecation_observed: U,
    undeprecation_observed: U,
    mismatch_observed: U,
    abandon: R,
    repair: 'released.active',
  },
  abandoned: {
    tag_observed: U,
    npm_observed: 'drifted',
    gh_release_observed: R,
    deprecation_observed: R,
    undeprecation_observed: R,
    mismatch_observed: R,
    abandon: U,
    repair: R,
  },
};

const summarize = (outcome: Outcome): Expected =>
  outcome.kind === 'applied' ? outcome.row.state : outcome.kind;

function applied(outcome: Outcome): VersionRow {
  assert.equal(outcome.kind, 'applied', JSON.stringify(outcome));

  return outcome.row;
}

function rejected(outcome: Outcome): string {
  assert.equal(outcome.kind, 'rejected', JSON.stringify(outcome));

  return outcome.reason;
}

describe('apply: every state and event pair', () => {
  for (const from of ['none', ...STATES] as const) {
    for (const type of EVENT_TYPES) {
      const expected = EXPECTED[from][type];

      it(`${from} + ${type} → ${expected}`, () => {
        const row = from === 'none' ? undefined : ROWS[from];
        assert.equal(summarize(apply(row, EVENTS[type], ENVELOPE)), expected);
      });
    }
  }

  it('keeps the recorded deprecation when a deprecated row drifts', () => {
    const outcome = apply(
      ROWS['published.deprecated'],
      EVENTS.mismatch_observed,
      ENVELOPE,
    );

    assert.equal(applied(outcome).npm_deprecated, DEPRECATION);
  });

  it('keeps the deprecation substate in step with npm_deprecated', () => {
    for (const from of [undefined, ...STATES]) {
      for (const type of EVENT_TYPES) {
        const outcome = apply(from && ROWS[from], EVENTS[type], ENVELOPE);

        if (outcome.kind !== 'applied' || outcome.row.state === 'drifted') {
          continue;
        }

        assert.equal(
          outcome.row.state.endsWith('.deprecated'),
          outcome.row.npm_deprecated !== null,
          `${from} + ${type}`,
        );
      }
    }
  });
});

describe('apply: facts', () => {
  it('moves a backfill that sees all three sources straight to released', () => {
    let row: VersionRow | undefined;

    for (const type of [
      'tag_observed',
      'npm_observed',
      'gh_release_observed',
    ] as const) {
      row = applied(apply(row, EVENTS[type], ENVELOPE));
    }

    assert.deepEqual(row, {
      ...ROWS['released.active'],
      state_at: ENVELOPE.at,
    });
  });

  it('records the event, its states and the envelope in the ledger row', () => {
    const outcome = apply(ROWS.tagged, EVENTS.npm_observed, {
      ...ENVELOPE,
      run_url: 'https://github.com/o/r/actions/runs/1',
    });

    assert.equal(outcome.kind, 'applied');
    assert.deepEqual(outcome.kind === 'applied' && outcome.event, {
      name: ENVELOPE.name,
      version: ENVELOPE.version,
      event: 'npm_observed',
      from_state: 'tagged',
      to_state: 'published.active',
      payload: JSON.stringify(NPM),
      source: ENVELOPE.source,
      run_url: 'https://github.com/o/r/actions/runs/1',
      at: ENVELOPE.at,
    });
  });

  it('gives a new row a null from_state', () => {
    const outcome = apply(undefined, EVENTS.tag_observed, ENVELOPE);
    assert.equal(outcome.kind === 'applied' && outcome.event.from_state, null);
  });

  const contradictions: [State, ReleaseEvent][] = [
    ['tagged', { type: 'tag_observed', sha: 'f'.repeat(40) }],
    ['released.active', { type: 'tag_observed', sha: 'f'.repeat(40) }],
    ['abandoned', { type: 'tag_observed', sha: 'f'.repeat(40) }],
    ['published.active', { ...EVENTS.npm_observed, integrity: 'sha512-BBBB' }],
    ['released.active', { ...EVENTS.npm_observed, distTag: 'next' }],
    [
      'released.active',
      { ...EVENTS.gh_release_observed, url: 'https://example.com' },
    ],
    [
      'released.deprecated',
      { ...EVENTS.gh_release_observed, prerelease: true },
    ],
  ];

  for (const [state, event] of contradictions) {
    it(`rejects a contradicting ${event.type} in ${state}`, () => {
      assert.match(
        rejected(apply(ROWS[state], event, ENVELOPE)),
        /report mismatch_observed/,
      );
    });
  }

  for (const state of ['released.active', 'released.deprecated'] as const) {
    it(`updates an edited release body in place in ${state}`, () => {
      const outcome = apply(
        ROWS[state],
        { ...EVENTS.gh_release_observed, body: 'edited' },
        ENVELOPE,
      );

      assert.equal(applied(outcome).gh_body, 'edited');
      assert.equal(applied(outcome).state, state);
      assert.equal(
        outcome.kind === 'applied' && outcome.event.from_state,
        state,
      );
    });
  }

  const ignored: ReleaseEvent[] = [
    { type: 'tag_observed', sha: 'f'.repeat(40) },
    { ...EVENTS.npm_observed, integrity: 'sha512-BBBB' },
    { ...EVENTS.gh_release_observed, id: 7 },
    { ...EVENTS.gh_release_observed, body: 'edited' },
    { type: 'deprecation_observed', message: 'use 3.0' },
    { ...EVENTS.mismatch_observed, field: 'git_sha' },
  ];

  for (const event of ignored) {
    it(`keeps a drifted row's facts on a contradicting ${event.type}`, () => {
      assert.deepEqual(apply(ROWS.drifted, event, ENVELOPE), {
        kind: 'unchanged',
      });
    });
  }

  it('still rejects a malformed event on a drifted row', () => {
    assert.equal(
      apply(
        ROWS.drifted,
        { type: 'deprecation_observed', message: '' },
        ENVELOPE,
      ).kind,
      'rejected',
    );
  });

  it('drifts an abandoned tag that reaches npm, recording the npm facts', () => {
    const row = applied(apply(ROWS.abandoned, EVENTS.npm_observed, ENVELOPE));

    assert.equal(row.state, 'drifted');
    assert.equal(row.npm_integrity, NPM.integrity);
  });

  it('records the GitHub release that drifted a tagged row', () => {
    const row = applied(
      apply(ROWS.tagged, EVENTS.gh_release_observed, ENVELOPE),
    );

    assert.equal(row.gh_release_id, GH.id);
  });

  it('records a new deprecation message without leaving the substate', () => {
    const outcome = apply(
      ROWS['released.deprecated'],
      { type: 'deprecation_observed', message: 'use 3.0' },
      ENVELOPE,
    );

    assert.equal(outcome.kind, 'applied');
    assert.equal(
      outcome.kind === 'applied' && outcome.event.from_state,
      'released.deprecated',
    );
    assert.equal(applied(outcome).npm_deprecated, 'use 3.0');
  });

  it('rejects an empty deprecation message', () => {
    assert.match(
      rejected(
        apply(
          ROWS['published.active'],
          { type: 'deprecation_observed', message: '' },
          ENVELOPE,
        ),
      ),
      /undeprecation_observed/,
    );
  });

  it('rejects a row for another version', () => {
    assert.match(
      rejected(
        apply(ROWS.tagged, EVENTS.tag_observed, {
          ...ENVELOPE,
          version: '2.0.0',
        }),
      ),
      /is not lit-ui-router@2\.0\.0/,
    );
  });
});

describe('apply: repair', () => {
  const repairs: [
    Omit<Extract<ReleaseEvent, { type: 'repair' }>, 'type'>,
    State,
  ][] = [
    [{ tag: { sha: SHA } }, 'tagged'],
    [{ tag: { sha: SHA }, npm: NPM }, 'published.active'],
    [
      { tag: { sha: SHA }, npm: NPM, deprecated: DEPRECATION },
      'published.deprecated',
    ],
    [{ tag: { sha: SHA }, npm: NPM, ghRelease: GH }, 'released.active'],
    [
      { tag: { sha: SHA }, npm: NPM, ghRelease: GH, deprecated: DEPRECATION },
      'released.deprecated',
    ],
  ];

  for (const [observations, state] of repairs) {
    it(`derives ${state}`, () => {
      const row = applied(
        apply(ROWS.drifted, { type: 'repair', ...observations }, ENVELOPE),
      );

      assert.equal(row.state, state);
    });
  }

  it('overwrites every recorded fact', () => {
    const row = applied(
      apply(
        ROWS.drifted,
        { type: 'repair', tag: { sha: 'f'.repeat(40) } },
        ENVELOPE,
      ),
    );

    assert.deepEqual(row, {
      ...ROWS.tagged,
      git_sha: 'f'.repeat(40),
      state_at: ENVELOPE.at,
    });
  });

  it('rejects a GitHub release without npm', () => {
    assert.match(
      rejected(
        apply(
          ROWS.drifted,
          { type: 'repair', tag: { sha: SHA }, ghRelease: GH },
          ENVELOPE,
        ),
      ),
      /GitHub release without npm/,
    );
  });

  it('rejects a deprecation without npm', () => {
    assert.match(
      rejected(
        apply(
          ROWS.drifted,
          { type: 'repair', tag: { sha: SHA }, deprecated: DEPRECATION },
          ENVELOPE,
        ),
      ),
      /deprecation without npm/,
    );
  });
});

describe('moveDistTag', () => {
  const current = {
    name: ENVELOPE.name,
    tag: 'latest',
    version: '0.9.0',
    updated_at: '2026-09-01T00:00:00.000Z',
  };

  it('points the tag at the version and logs the move', () => {
    const outcome = moveDistTag(
      current,
      ROWS['released.active'],
      'latest',
      ENVELOPE,
    );

    assert.deepEqual(outcome, {
      kind: 'applied',
      row: { ...current, version: ENVELOPE.version, updated_at: ENVELOPE.at },
      event: {
        name: ENVELOPE.name,
        version: ENVELOPE.version,
        event: 'dist_tag_moved',
        from_state: 'released.active',
        to_state: 'released.active',
        payload: JSON.stringify({ tag: 'latest', from: '0.9.0' }),
        source: ENVELOPE.source,
        run_url: null,
        at: ENVELOPE.at,
      },
    });
  });

  it('is a no-op when the tag already points there', () => {
    assert.deepEqual(
      moveDistTag(
        { ...current, version: ENVELOPE.version },
        ROWS['published.active'],
        'latest',
        ENVELOPE,
      ),
      { kind: 'unchanged' },
    );
  });

  for (const state of ['tagged', 'drifted', 'abandoned'] as const) {
    it(`rejects a version in ${state}`, () => {
      assert.equal(
        moveDistTag(undefined, ROWS[state], 'latest', ENVELOPE).kind,
        'rejected',
      );
    });
  }

  it('rejects a version with no row', () => {
    assert.equal(
      moveDistTag(undefined, undefined, 'latest', ENVELOPE).kind,
      'rejected',
    );
  });
});
