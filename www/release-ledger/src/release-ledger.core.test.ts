import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ADVISORY_COLUMNS,
  apply,
  type EventType,
  EVENT_TYPES,
  type FactColumn,
  FACT_COLUMNS,
  fold,
  type ImmutableColumn,
  IMMUTABLE_COLUMNS,
  moveDistTag,
  MUTABLE_COLUMNS,
  removeDistTag,
  type Outcome,
  type ReleaseEvent,
  type State,
  STATES,
  type VersionRow,
} from './release-ledger.core.ts';
import {
  DEPRECATION,
  DIST_TAG,
  DRIFTED_TAG,
  ENVELOPE,
  EVENTS,
  GH,
  NPM,
  OTHER_SHA,
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
    repair: 'released.active',
  },
};

const summarize = (outcome: Outcome): Expected =>
  outcome.kind === 'applied' ? outcome.row.state : outcome.kind;

function applied(outcome: Outcome): VersionRow {
  assert.equal(outcome.kind, 'applied', JSON.stringify(outcome));

  return outcome.row;
}

function rejected(outcome: { kind: string; reason?: string }): string {
  assert.equal(outcome.kind, 'rejected', JSON.stringify(outcome));

  return outcome.reason ?? '';
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
      first_seen_at: ENVELOPE.at,
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
    {
      type: 'mismatch_observed',
      field: 'npm_integrity',
      recorded: NPM.integrity,
      observed: null,
    },
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
      rev: ROWS.drifted.rev + 1,
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
      op: 'upsert',
      row: { ...current, version: ENVELOPE.version, updated_at: ENVELOPE.at },
      expectedVersion: '0.9.0',
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

  for (const [label, row] of [
    ['tagged', ROWS.tagged],
    ['abandoned', ROWS.abandoned],
    ['drifted without npm facts', DRIFTED_TAG],
  ] as const) {
    it(`rejects a version ${label}`, () => {
      assert.equal(
        moveDistTag(undefined, row, 'latest', ENVELOPE).kind,
        'rejected',
      );
    });
  }

  it('points a tag at a drifted version that recorded npm facts', () => {
    const outcome = moveDistTag(undefined, ROWS.drifted, 'next', ENVELOPE);

    assert.equal(outcome.kind === 'applied' && outcome.op, 'upsert');
    assert.equal(
      outcome.kind === 'applied' && outcome.event.to_state,
      'drifted',
    );
  });

  it('inserts a new tag with no expected version', () => {
    const outcome = moveDistTag(
      undefined,
      ROWS['published.active'],
      'next',
      ENVELOPE,
    );

    assert.equal(
      outcome.kind === 'applied' && outcome.op === 'upsert'
        ? outcome.expectedVersion
        : 'not an upsert',
      null,
    );
  });

  it('rejects a current row for another tag', () => {
    assert.match(
      rejected(moveDistTag(current, ROWS['released.active'], 'next', ENVELOPE)),
      /latest is not next/,
    );
  });

  it('rejects a current row for another package', () => {
    assert.match(
      rejected(
        moveDistTag(
          { ...current, name: 'other' },
          ROWS['released.active'],
          'latest',
          ENVELOPE,
        ),
      ),
      /for other is not lit-ui-router/,
    );
  });

  it('rejects a target row for another version', () => {
    assert.match(
      rejected(
        moveDistTag(current, ROWS['released.active'], 'latest', {
          ...ENVELOPE,
          version: '2.0.0',
        }),
      ),
      /is not lit-ui-router@2\.0\.0/,
    );
  });

  it('rejects a version with no row', () => {
    assert.equal(
      moveDistTag(undefined, undefined, 'latest', ENVELOPE).kind,
      'rejected',
    );
  });
});

describe('fact columns', () => {
  it('splits every fact into immutable, mutable or advisory', () => {
    const split = [
      ...IMMUTABLE_COLUMNS,
      ...MUTABLE_COLUMNS,
      ...ADVISORY_COLUMNS,
    ].sort();

    assert.deepEqual(split, [...FACT_COLUMNS].sort());
  });
});

describe('apply: mismatch_observed', () => {
  const mismatch = (
    fields: Partial<Extract<ReleaseEvent, { type: 'mismatch_observed' }>>,
  ): ReleaseEvent => ({ ...EVENTS.mismatch_observed, ...fields });

  const notImmutable: FactColumn[] = [
    'gh_body',
    'npm_deprecated',
    'npm_dist_tag',
  ];

  for (const field of notImmutable) {
    it(`rejects a mismatch on ${field}`, () => {
      const event = mismatch({
        // SAFETY: deliberately outside ImmutableColumn, as an untrusted claim could be
        field: field as ImmutableColumn,
        recorded: ROWS['released.deprecated'][field],
        observed: 'other',
      });

      assert.match(
        rejected(apply(ROWS['released.deprecated'], event, ENVELOPE)),
        /not an immutable fact/,
      );
    });
  }

  it('rejects a mismatch with nothing recorded', () => {
    assert.match(
      rejected(
        apply(
          ROWS.tagged,
          mismatch({ field: 'npm_integrity', recorded: null }),
          ENVELOPE,
        ),
      ),
      /nothing recorded/,
    );
  });

  it('rejects a stale mismatch that names a value the row no longer records', () => {
    assert.match(
      rejected(
        apply(
          ROWS['released.active'],
          mismatch({ field: 'gh_release_id', recorded: 7, observed: null }),
          ENVELOPE,
        ),
      ),
      /is stale/,
    );
  });

  it('rejects a mismatch that observed the recorded value', () => {
    assert.match(
      rejected(
        apply(ROWS['published.active'], mismatch({ observed: SHA }), ENVELOPE),
      ),
      /observed the recorded value/,
    );
  });

  it('still validates a mismatch on a drifted row', () => {
    assert.match(
      rejected(
        apply(ROWS.drifted, mismatch({ recorded: OTHER_SHA }), ENVELOPE),
      ),
      /is stale/,
    );
  });

  it('drifts on a deleted GitHub release', () => {
    const row = applied(
      apply(
        ROWS['released.active'],
        mismatch({ field: 'gh_release_id', recorded: GH.id, observed: null }),
        ENVELOPE,
      ),
    );

    assert.equal(row.state, 'drifted');
    assert.equal(row.gh_release_id, GH.id);
  });
});

describe('apply: the advisory dist-tag', () => {
  const { distTag: _distTag, ...withoutTag } = NPM;

  it('records a new version without a dist-tag when the claim has none', () => {
    const row = applied(
      apply(ROWS.tagged, { type: 'npm_observed', ...withoutTag }, ENVELOPE),
    );

    assert.equal(row.state, 'published.active');
    assert.equal(row.npm_dist_tag, null);
  });

  it('fills a missing dist-tag in place from a later publish-npm claim', () => {
    const row = applied(
      apply(
        { ...ROWS['published.active'], npm_dist_tag: null },
        EVENTS.npm_observed,
        ENVELOPE,
      ),
    );

    assert.equal(row.state, 'published.active');
    assert.equal(row.npm_dist_tag, DIST_TAG);
  });

  for (const [label, event] of [
    ['a missing', { type: 'npm_observed', ...withoutTag }],
    ['another', { ...EVENTS.npm_observed, distTag: 'next' }],
  ] satisfies [string, ReleaseEvent][]) {
    it(`never treats ${label} dist-tag as drift`, () => {
      assert.deepEqual(apply(ROWS['released.active'], event, ENVELOPE), {
        kind: 'unchanged',
      });
    });
  }

  it('lets repair keep the recorded dist-tag', () => {
    const row = applied(
      apply(ROWS.drifted, { ...EVENTS.repair, npm: withoutTag }, ENVELOPE),
    );

    assert.equal(row.npm_dist_tag, DIST_TAG);
  });

  it('lets repair set the dist-tag it carries', () => {
    const row = applied(
      apply(
        ROWS.drifted,
        { ...EVENTS.repair, npm: { ...NPM, distTag: 'next' } },
        ENVELOPE,
      ),
    );

    assert.equal(row.npm_dist_tag, 'next');
  });

  it('clears the dist-tag when repair finds no npm version', () => {
    const row = applied(
      apply(ROWS.drifted, { type: 'repair', tag: { sha: SHA } }, ENVELOPE),
    );

    assert.equal(row.npm_dist_tag, null);
  });
});

describe('apply: rev and first_seen_at', () => {
  it('inserts a new row at rev 0', () => {
    const outcome = apply(undefined, EVENTS.tag_observed, ENVELOPE);

    assert.equal(outcome.kind === 'applied' && outcome.expectedRev, null);
    assert.equal(applied(outcome).rev, 0);
    assert.equal(applied(outcome).first_seen_at, ENVELOPE.at);
  });

  for (const [state, event] of [
    ['tagged', EVENTS.npm_observed],
    ['released.active', { ...EVENTS.gh_release_observed, body: 'edited' }],
    ['drifted', EVENTS.repair],
  ] satisfies [State, ReleaseEvent][]) {
    it(`compares against the read rev on ${event.type} in ${state}`, () => {
      const outcome = apply(ROWS[state], event, ENVELOPE);

      assert.equal(
        outcome.kind === 'applied' && outcome.expectedRev,
        ROWS[state].rev,
      );
      assert.equal(applied(outcome).rev, ROWS[state].rev + 1);
      assert.equal(applied(outcome).first_seen_at, ROWS[state].first_seen_at);
    });
  }
});

describe('apply: ways out', () => {
  it('abandons a drifted tag that never reached npm', () => {
    const row = applied(apply(DRIFTED_TAG, EVENTS.abandon, ENVELOPE));

    assert.equal(row.state, 'abandoned');
    assert.equal(row.git_sha, SHA);
  });

  it('refuses to abandon a drifted version that recorded npm facts', () => {
    assert.match(
      rejected(apply(ROWS.drifted, EVENTS.abandon, ENVELOPE)),
      /needs no npm facts/,
    );
  });

  it('repairs an abandoned tag', () => {
    const row = applied(
      apply(ROWS.abandoned, { type: 'repair', tag: { sha: SHA } }, ENVELOPE),
    );

    assert.equal(row.state, 'tagged');
  });

  it('rejects repair with an empty deprecation message', () => {
    assert.match(
      rejected(
        apply(ROWS.drifted, { ...EVENTS.repair, deprecated: '' }, ENVELOPE),
      ),
      /undeprecation_observed/,
    );
  });
});

describe('fold', () => {
  const BACKFILL = [
    EVENTS.tag_observed,
    EVENTS.npm_observed,
    EVENTS.gh_release_observed,
  ] satisfies ReleaseEvent[];

  it('folds a claim in order into one write', () => {
    const result = fold(undefined, BACKFILL, ENVELOPE);

    assert.equal(result.outcome, 'applied');
    assert.equal(result.expectedRev, null);
    assert.equal(result.row?.state, 'released.active');
    assert.equal(result.row?.rev, 2);
    assert.deepEqual(
      result.events.map((event) => event.event),
      BACKFILL.map((event) => event.type),
    );
    assert.equal(result.rejected, null);
  });

  it('is unchanged when every event repeats a recorded fact', () => {
    assert.deepEqual(fold(ROWS['released.active'], BACKFILL, ENVELOPE), {
      outcome: 'unchanged',
      row: undefined,
      expectedRev: ROWS['released.active'].rev,
      events: [],
      rejected: null,
    });
  });

  it('stops at the first rejection and keeps the applied prefix', () => {
    const result = fold(
      ROWS.tagged,
      [
        EVENTS.npm_observed,
        { ...EVENTS.gh_release_observed, id: 7 },
        { type: 'deprecation_observed', message: '' },
        EVENTS.deprecation_observed,
      ],
      ENVELOPE,
    );

    assert.equal(result.outcome, 'rejected');
    assert.equal(result.rejected?.index, 2);
    assert.match(result.rejected?.reason ?? '', /undeprecation_observed/);
    assert.equal(result.row?.state, 'released.active');
    assert.equal(result.row?.npm_deprecated, null);
    assert.equal(result.events.length, 2);
    assert.equal(result.expectedRev, ROWS.tagged.rev);
  });

  it('writes nothing when the first event is rejected', () => {
    const result = fold(undefined, [EVENTS.npm_observed], ENVELOPE);

    assert.equal(result.outcome, 'rejected');
    assert.equal(result.row, undefined);
    assert.equal(result.rejected?.index, 0);
  });
});

describe('removeDistTag', () => {
  const current = {
    name: ENVELOPE.name,
    tag: 'next',
    version: ENVELOPE.version,
    updated_at: '2026-09-01T00:00:00.000Z',
  };

  it('deletes the tag and logs the removal against its version', () => {
    assert.deepEqual(
      removeDistTag(current, ROWS['released.active'], 'next', ENVELOPE),
      {
        kind: 'applied',
        op: 'delete',
        row: current,
        event: {
          name: ENVELOPE.name,
          version: ENVELOPE.version,
          event: 'dist_tag_removed',
          from_state: 'released.active',
          to_state: 'released.active',
          payload: JSON.stringify({ tag: 'next' }),
          source: ENVELOPE.source,
          run_url: null,
          at: ENVELOPE.at,
        },
      },
    );
  });

  it('is a no-op when the tag is already gone', () => {
    assert.deepEqual(removeDistTag(undefined, undefined, 'next', ENVELOPE), {
      kind: 'unchanged',
    });
  });

  it('rejects a current row for another tag', () => {
    assert.match(
      rejected(
        removeDistTag(current, ROWS['released.active'], 'latest', ENVELOPE),
      ),
      /next is not latest/,
    );
  });

  it('rejects a version row the tag does not point at', () => {
    assert.match(
      rejected(
        removeDistTag(
          { ...current, version: '0.9.0' },
          ROWS['released.active'],
          'next',
          ENVELOPE,
        ),
      ),
      /has no ledger row/,
    );
  });
});
