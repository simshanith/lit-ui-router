import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type DistTagOutcome,
  FACT_COLUMNS,
  type Fold,
  fold,
  foldStatements,
  GH_STATES,
  ghState,
  moveDistTag,
  NPM_STATES,
  npmState,
  type Observation,
  type Region,
  REGION_NAMES,
  REGIONS,
  removeDistTag,
  repair,
  stateOf,
  type Status,
  statusOf,
  STATUSES,
  type VersionRow,
} from './release-ledger.core.ts';
import {
  DEPRECATION,
  ENVELOPE,
  GH,
  NPM,
  OBSERVED,
  OTHER_SHA,
  ROWS,
  SHA,
  UNPUBLISHED,
} from './release-ledger.fixtures.ts';

function applied(result: Fold): Extract<Fold, { outcome: 'applied' }> {
  if (result.outcome !== 'applied') assert.fail(JSON.stringify(result));

  return result;
}

const after = (result: Fold): VersionRow => applied(result).row;

function rejected(result: Fold | DistTagOutcome): string {
  const reason = 'reason' in result ? result.reason : '';

  assert.ok(reason !== '', JSON.stringify(result));

  return reason;
}

const conflictColumn = (region: Region) => `${region}_conflict` as const;

/** The columns a region's observation may write. */
function regionColumns(region: Region): Set<string> {
  const { fixed, mutable } = REGIONS[region];

  return new Set<string>([...fixed, ...mutable, conflictColumn(region)]);
}

const VARIANTS: Record<Region, ((Observation[Region] & object) | null)[]> = {
  tag: [null, { sha: SHA }, { sha: OTHER_SHA }],
  npm: [
    null,
    NPM,
    { ...NPM, deprecated: DEPRECATION },
    { ...NPM, integrity: 'sha512-BBBB' },
  ],
  gh: [null, GH, { ...GH, body: 'edited' }, { ...GH, id: 43 }],
};

describe('fold: regions', () => {
  for (const [label, row] of Object.entries(ROWS)) {
    for (const region of REGION_NAMES) {
      for (const observed of VARIANTS[region]) {
        const observation = { [region]: observed };
        const name = `${label} + ${region} ${JSON.stringify(observed)}`;

        it(`${name} moves only along the region's edges`, () => {
          const result = fold(row, observation, ENVELOPE);

          if (result.outcome !== 'applied') {
            assert.equal(result.outcome, 'unchanged');

            return;
          }

          const from = stateOf(row, region);
          const to = stateOf(result.row, region);
          const edges: readonly (readonly string[])[] = REGIONS[region].edges;

          assert.ok(
            from === to || edges.some(([a, b]) => a === from && b === to),
            `${from} → ${to}`,
          );
        });

        it(`${name} writes only the region's columns`, () => {
          const result = fold(row, observation, ENVELOPE);

          if (result.outcome !== 'applied') return;

          const allowed = regionColumns(region);

          for (const column of FACT_COLUMNS) {
            if (allowed.has(column)) continue;

            assert.equal(result.row[column], row[column], column);
          }
        });
      }
    }
  }

  it('names every state its edges reach', () => {
    const named: Record<'npm' | 'gh', readonly string[]> = {
      npm: NPM_STATES,
      gh: GH_STATES,
    };

    for (const region of ['npm', 'gh'] as const) {
      for (const edge of REGIONS[region].edges) {
        for (const state of edge) assert.ok(named[region].includes(state));
      }
    }
  });

  it('never moves npm back to absent: an unpublished version is a conflict', () => {
    const row = after(fold(ROWS.published, { npm: null }, ENVELOPE));

    assert.equal(npmState(row), 'active');
    assert.equal(row.npm_conflict, 'null');
  });

  it('never moves a final release back: a deleted release is a conflict', () => {
    const row = after(fold(ROWS.released, { gh: null }, ENVELOPE));

    assert.equal(ghState(row), 'final');
    assert.equal(row.gh_conflict, 'null');
    assert.equal(row.npm_conflict, null);
  });

  it('records a deleted tag as a tag conflict', () => {
    assert.equal(
      after(fold(ROWS.released, { tag: null }, ENVELOPE)).tag_conflict,
      'null',
    );
  });

  it('is unchanged when every source repeats its facts', () => {
    assert.deepEqual(fold(ROWS.released, OBSERVED, ENVELOPE), {
      outcome: 'unchanged',
    });
    assert.deepEqual(fold(ROWS.tagged, UNPUBLISHED, ENVELOPE), {
      outcome: 'unchanged',
    });
  });
});

describe('fold: a new row', () => {
  for (const region of REGION_NAMES) {
    it(`is created by a ${region} observation alone`, () => {
      const result = applied(
        fold(undefined, { [region]: OBSERVED[region] }, ENVELOPE),
      );

      assert.equal(result.isNew, true);
      assert.equal(result.row.first_seen_at, ENVELOPE.at);
      assert.deepEqual(
        result.events.map((event) => [event.region, event.from_state]),
        [[region, null]],
      );
    });
  }

  it('is not created when every source reports the version absent', () => {
    assert.deepEqual(
      fold(undefined, { tag: null, npm: null, gh: null }, ENVELOPE),
      { outcome: 'unchanged' },
    );
  });

  it('records all three sources in one write, one ledger row per region', () => {
    const result = applied(fold(undefined, OBSERVED, ENVELOPE));

    assert.deepEqual(result.row, {
      ...ROWS.released,
      first_seen_at: ENVELOPE.at,
    });
    assert.deepEqual(
      result.events.map((event) => [event.region, event.to_state]),
      [
        ['tag', null],
        ['npm', 'active'],
        ['gh', 'final'],
      ],
    );
  });

  it('logs the observation, its source and run in the ledger row', () => {
    const [event] = applied(
      fold(undefined, { npm: NPM }, { ...ENVELOPE, run_url: 'run' }),
    ).events;

    assert.deepEqual(event, {
      name: ENVELOPE.name,
      version: ENVELOPE.version,
      region: 'npm',
      event: 'observed',
      from_state: null,
      to_state: 'active',
      payload: JSON.stringify(NPM),
      source: ENVELOPE.source,
      run_url: 'run',
      at: ENVELOPE.at,
    });
  });
});

describe('fold: out of order', () => {
  it('accepts a final release before npm', () => {
    const row = after(fold(ROWS.tagged, { gh: GH, npm: null }, ENVELOPE));

    assert.deepEqual([npmState(row), ghState(row)], ['absent', 'final']);
    assert.equal(row.gh_conflict, null);
  });

  it('then records npm without a conflict', () => {
    const row = after(fold(ROWS.releasedFirst, { npm: NPM }, ENVELOPE));

    assert.deepEqual([npmState(row), ghState(row)], ['active', 'final']);
    assert.equal(row.npm_conflict, null);
  });

  it('accepts npm before the tag', () => {
    const row = after(fold(undefined, { npm: NPM, tag: null }, ENVELOPE));

    assert.equal(row.git_sha, null);
    assert.equal(
      after(fold(row, { tag: { sha: SHA } }, ENVELOPE)).git_sha,
      SHA,
    );
  });
});

describe('fold: conflicts', () => {
  const contradiction = { ...NPM, integrity: 'sha512-BBBB' };

  it('records the contradicting observation and keeps the recorded fact', () => {
    const row = after(fold(ROWS.published, { npm: contradiction }, ENVELOPE));

    assert.equal(row.npm_integrity, NPM.integrity);
    assert.deepEqual(JSON.parse(row.npm_conflict ?? ''), {
      npm_integrity: 'sha512-BBBB',
      npm_published_at: NPM.publishedAt,
    });
  });

  it('flags only the contradicted region', () => {
    const row = after(
      fold(ROWS.released, { ...OBSERVED, tag: { sha: OTHER_SHA } }, ENVELOPE),
    );

    assert.deepEqual(
      [row.tag_conflict, row.npm_conflict, row.gh_conflict],
      [JSON.stringify({ git_sha: OTHER_SHA }), null, null],
    );
  });

  it('keeps moving the lifecycle while in conflict', () => {
    const conflicted = after(
      fold(ROWS.published, { npm: contradiction }, ENVELOPE),
    );

    const row = after(
      fold(
        conflicted,
        { npm: { ...contradiction, deprecated: DEPRECATION } },
        ENVELOPE,
      ),
    );

    assert.equal(npmState(row), 'deprecated');
    assert.equal(row.npm_conflict, conflicted.npm_conflict);
  });

  it('keeps the conflict when the source agrees again; only repair clears it', () => {
    const conflicted = after(
      fold(ROWS.published, { npm: contradiction }, ENVELOPE),
    );

    assert.deepEqual(fold(conflicted, { npm: NPM }, ENVELOPE), {
      outcome: 'unchanged',
    });
  });

  it('records the latest contradiction', () => {
    const conflicted = after(fold(ROWS.released, { gh: null }, ENVELOPE));

    assert.equal(
      after(fold(conflicted, { gh: { ...GH, id: 43 } }, ENVELOPE)).gh_conflict,
      JSON.stringify({
        gh_release_id: 43,
        gh_url: GH.url,
        gh_prerelease: 0,
        gh_published_at: GH.publishedAt,
      }),
    );
  });

  it('is unchanged on a repeated contradiction', () => {
    const conflicted = after(fold(ROWS.released, { gh: null }, ENVELOPE));

    assert.deepEqual(fold(conflicted, { gh: null }, ENVELOPE), {
      outcome: 'unchanged',
    });
  });
});

describe('fold: mutable facts', () => {
  it('updates an edited release body in place', () => {
    const result = applied(
      fold(ROWS.released, { gh: { ...GH, body: 'edited' } }, ENVELOPE),
    );

    assert.equal(result.row.gh_body, 'edited');
    assert.equal(result.row.gh_conflict, null);
    assert.deepEqual(
      result.events.map((event) => [event.from_state, event.to_state]),
      [['final', 'final']],
    );
  });

  it('deprecates, rewords and undeprecates', () => {
    const deprecated = after(
      fold(
        ROWS.published,
        { npm: { ...NPM, deprecated: DEPRECATION } },
        ENVELOPE,
      ),
    );

    const reworded = after(
      fold(deprecated, { npm: { ...NPM, deprecated: 'use 3.0' } }, ENVELOPE),
    );

    assert.equal(reworded.npm_deprecated, 'use 3.0');
    assert.equal(
      npmState(after(fold(reworded, { npm: NPM }, ENVELOPE))),
      'active',
    );
  });

  it('records a version first seen deprecated', () => {
    assert.equal(
      npmState(
        after(
          fold(
            ROWS.tagged,
            { npm: { ...NPM, deprecated: DEPRECATION } },
            ENVELOPE,
          ),
        ),
      ),
      'deprecated',
    );
  });

  it('rejects an empty deprecation message', () => {
    assert.match(
      rejected(
        fold(ROWS.published, { npm: { ...NPM, deprecated: '' } }, ENVELOPE),
      ),
      /empty deprecation/,
    );
  });

  it('rejects a row for another version', () => {
    assert.match(
      rejected(fold(ROWS.tagged, OBSERVED, { ...ENVELOPE, version: '2.0.0' })),
      /is not lit-ui-router@2\.0\.0/,
    );
  });

  it('updates the stored row', () => {
    const result = applied(
      fold(ROWS.released, { gh: { ...GH, body: 'edited' } }, ENVELOPE),
    );

    assert.equal(result.isNew, false);
    assert.equal(result.row.first_seen_at, ROWS.released.first_seen_at);
  });
});

describe('repair', () => {
  const conflicted = after(
    fold(
      ROWS.released,
      { npm: { ...NPM, integrity: 'sha512-BBBB' }, gh: null },
      ENVELOPE,
    ),
  );

  it('adopts the observation and clears only its region', () => {
    const result = applied(
      repair(
        conflicted,
        'npm',
        { npm: { ...NPM, integrity: 'sha512-BBBB' } },
        ENVELOPE,
      ),
    );

    assert.equal(result.row.npm_integrity, 'sha512-BBBB');
    assert.equal(result.row.npm_conflict, null);
    assert.equal(result.row.gh_conflict, 'null');
    assert.deepEqual(
      result.events.map((event) => [event.region, event.event]),
      [['npm', 'repair']],
    );
  });

  it('ignores the other regions of the observation', () => {
    const row = after(
      repair(
        conflicted,
        'npm',
        { ...OBSERVED, gh: { ...GH, id: 7 } },
        ENVELOPE,
      ),
    );

    for (const column of REGIONS.gh.fixed) {
      assert.equal(row[column], conflicted[column], column);
    }
  });

  it('cannot erase recorded facts', () => {
    assert.match(
      rejected(repair(conflicted, 'gh', { gh: null }, ENVELOPE)),
      /cannot erase recorded gh facts/,
    );
  });

  it('needs the current observation', () => {
    assert.match(
      rejected(repair(conflicted, 'npm', {}, ENVELOPE)),
      /needs the current npm observation/,
    );
  });

  it('needs a conflict', () => {
    assert.match(
      rejected(repair(ROWS.released, 'npm', OBSERVED, ENVELOPE)),
      /needs a conflict on npm/,
    );
    assert.match(
      rejected(repair(undefined, 'tag', OBSERVED, ENVELOPE)),
      /needs a conflict on tag/,
    );
  });
});

describe('REGIONS', () => {
  it('assigns every fact column to one region, as fixed, mutable or conflict', () => {
    const assigned = [
      ...REGION_NAMES.flatMap((region) => [
        ...REGIONS[region].fixed,
        ...REGIONS[region].mutable,
        conflictColumn(region),
      ]),
    ];

    assert.deepEqual([...assigned].sort(), [...FACT_COLUMNS].sort());
  });
});

describe('moveDistTag', () => {
  const current = {
    name: ENVELOPE.name,
    tag: 'latest',
    version: '0.9.0',
    updated_at: '2026-09-01T00:00:00.000Z',
  };

  it('points the tag at the version and logs the move against npm', () => {
    assert.deepEqual(moveDistTag(current, ROWS.released, 'latest', ENVELOPE), {
      kind: 'applied',
      op: 'upsert',
      row: { ...current, version: ENVELOPE.version, updated_at: ENVELOPE.at },
      event: {
        name: ENVELOPE.name,
        version: ENVELOPE.version,
        region: 'npm',
        event: 'dist_tag_moved',
        from_state: 'active',
        to_state: 'active',
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
        ROWS.published,
        'latest',
        ENVELOPE,
      ),
      { kind: 'unchanged' },
    );
  });

  for (const [label, row] of [
    ['tagged', ROWS.tagged],
    ['released before npm', ROWS.releasedFirst],
  ] as const) {
    it(`rejects a version ${label}`, () => {
      assert.match(
        rejected(moveDistTag(undefined, row, 'latest', ENVELOPE)),
        /is not on npm/,
      );
    });
  }

  it('points a tag at a version whose npm facts are in conflict', () => {
    const row = after(fold(ROWS.published, { npm: null }, ENVELOPE));

    assert.equal(moveDistTag(undefined, row, 'next', ENVELOPE).kind, 'applied');
  });

  it('rejects a current row for another tag', () => {
    assert.match(
      rejected(moveDistTag(current, ROWS.released, 'next', ENVELOPE)),
      /latest is not next/,
    );
  });

  it('rejects a current row for another package', () => {
    assert.match(
      rejected(
        moveDistTag(
          { ...current, name: 'other' },
          ROWS.released,
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
        moveDistTag(current, ROWS.released, 'latest', {
          ...ENVELOPE,
          version: '2.0.0',
        }),
      ),
      /is not lit-ui-router@2\.0\.0/,
    );
  });

  it('rejects a version with no row', () => {
    assert.match(
      rejected(moveDistTag(undefined, undefined, 'latest', ENVELOPE)),
      /has no ledger row/,
    );
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
    assert.deepEqual(removeDistTag(current, ROWS.released, 'next', ENVELOPE), {
      kind: 'applied',
      op: 'delete',
      row: current,
      event: {
        name: ENVELOPE.name,
        version: ENVELOPE.version,
        region: 'npm',
        event: 'dist_tag_removed',
        from_state: 'active',
        to_state: 'active',
        payload: JSON.stringify({ tag: 'next' }),
        source: ENVELOPE.source,
        run_url: null,
        at: ENVELOPE.at,
      },
    });
  });

  it('is a no-op when the tag is already gone', () => {
    assert.deepEqual(removeDistTag(undefined, undefined, 'next', ENVELOPE), {
      kind: 'unchanged',
    });
  });

  it('rejects a current row for another tag', () => {
    assert.match(
      rejected(removeDistTag(current, ROWS.released, 'latest', ENVELOPE)),
      /next is not latest/,
    );
  });

  it('rejects a version row the tag does not point at', () => {
    assert.match(
      rejected(
        removeDistTag(
          { ...current, version: '0.9.0' },
          ROWS.released,
          'next',
          ENVELOPE,
        ),
      ),
      /has no ledger row/,
    );
  });
});

describe('foldStatements', () => {
  const move = moveDistTag(undefined, ROWS.released, 'next', ENVELOPE);

  it('reports applied when only a dist-tag moves', () => {
    const statements = foldStatements(
      fold(ROWS.released, OBSERVED, ENVELOPE),
      [move],
      'message-1',
    );

    assert.equal(statements.outcome, 'applied');
    assert.equal(statements.write, undefined);
    assert.equal(statements.distTags.length, 1);
    assert.equal(statements.ledger.length, 1);
  });

  it('rejects the whole claim with a rejected dist-tag outcome, carrying its reason', () => {
    assert.deepEqual(
      foldStatements(
        fold(undefined, OBSERVED, ENVELOPE),
        [moveDistTag(undefined, ROWS.tagged, 'next', ENVELOPE)],
        'message-1',
      ),
      {
        outcome: 'rejected',
        reason: 'lit-ui-router@1.0.0 is not on npm',
        write: undefined,
        distTags: [],
        ledger: [],
      },
    );
  });

  it('reports unchanged with nothing to write', () => {
    const statements = foldStatements(
      fold(ROWS.released, OBSERVED, ENVELOPE),
      [{ kind: 'unchanged' }],
      'message-1',
    );

    assert.deepEqual(statements, {
      outcome: 'unchanged',
      reason: null,
      write: undefined,
      distTags: [],
      ledger: [],
    });
  });

  it('reports rejected with the reason for malformed input', () => {
    const statements = foldStatements(
      fold(ROWS.published, { npm: { ...NPM, deprecated: '' } }, ENVELOPE),
      [],
      'message-1',
    );

    assert.equal(statements.outcome, 'rejected');
    assert.match(statements.reason ?? '', /empty deprecation message/);
  });
});

describe('statusOf', () => {
  const cases: [Status, VersionRow][] = [
    ['conflict', { ...ROWS.released, git_sha: null, gh_conflict: 'null' }],
    ['conflict', { ...ROWS.tagged, tag_conflict: 'null' }],
    ['untagged', { ...ROWS.published, git_sha: null }],
    ['untagged', { ...ROWS.releasedFirst, git_sha: null }],
    ['tagged', ROWS.tagged],
    ['tagged', ROWS.releasedFirst],
    ['published', ROWS.deprecated],
    ['released', ROWS.released],
  ];

  for (const [status, row] of cases) {
    it(`derives ${status}`, () => assert.equal(statusOf(row), status));
  }

  it('covers every status', () => {
    assert.deepEqual([...new Set(cases.map(([status]) => status))], STATUSES);
  });
});
