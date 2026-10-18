// Applies the migrations to an in-memory SQLite, the engine under D1, and
// writes the machine's outcomes through the real constraints.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

import {
  apply,
  distTagStatements,
  type DistTagRow,
  EVENT_TYPES,
  FACT_COLUMNS,
  fold,
  foldStatements,
  moveDistTag,
  type ReleaseEvent,
  removeDistTag,
  type Statement,
  STATES,
  type VersionRow,
} from './release-ledger.core.ts';
import {
  DRIFTED_TAG,
  ENVELOPE,
  EVENTS,
  ROWS,
} from './release-ledger.fixtures.ts';

const MIGRATIONS = new URL('../migrations/', import.meta.url);

const MESSAGE_ID = 'message-1';

function migrated(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  // D1 enforces foreign keys by default; SQLite does not.
  db.exec('PRAGMA foreign_keys = ON');

  for (const file of readdirSync(MIGRATIONS).sort()) {
    db.exec(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  }

  return db;
}

const VERSION_COLUMNS = [
  'name',
  'version',
  'state',
  'state_at',
  'first_seen_at',
  'rev',
  ...FACT_COLUMNS,
] as const;

function insertVersion(db: DatabaseSync, row: VersionRow): void {
  db.prepare(
    `INSERT INTO versions (${VERSION_COLUMNS.join(', ')}) VALUES (${VERSION_COLUMNS.map(() => '?').join(', ')})`,
  ).run(...VERSION_COLUMNS.map((column) => row[column]));
}

function insertClaim(
  db: DatabaseSync,
  messageId = MESSAGE_ID,
  outcome: { outcome: string; reason: string | null } = {
    outcome: 'applied',
    reason: null,
  },
): void {
  db.prepare(
    `INSERT INTO pipeline_events (message_id, received_at, repository, job_workflow_ref, run_id, run_attempt, sha, payload, outcome, reason)
     VALUES (?, 'now', 'simshanith/lit-ui-router', 'simshanith/lit-ui-router/.github/workflows/publish-npm.yml@refs/heads/main', '1', 1, 'sha', '{}', ?, ?)`,
  ).run(messageId, outcome.outcome, outcome.reason);
}

function insertDistTag(db: DatabaseSync, row: DistTagRow): void {
  db.prepare(
    'INSERT INTO dist_tags (name, tag, version, updated_at) VALUES (?, ?, ?, ?)',
  ).run(row.name, row.tag, row.version, row.updated_at);
}

/** Runs the statements in one transaction, as a D1 batch does, and returns each one's changes. */
function batch(db: DatabaseSync, statements: Statement[]): number[] {
  db.exec('BEGIN');

  try {
    const changes = statements.map(
      ({ sql, params }) => db.prepare(sql).run(...params).changes,
    );

    db.exec('COMMIT');

    return changes.map(Number);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

const count = (db: DatabaseSync, table: string): number =>
  Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n);

describe('migrations', () => {
  it('creates the ledger tables', () => {
    const tables = migrated()
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name",
      )
      .all()
      .map((row) => row.name);

    assert.deepEqual(tables, [
      'dist_tags',
      'ledger_events',
      'pipeline_events',
      'versions',
    ]);
  });

  it('accepts every fixture row', () => {
    for (const row of [...Object.values(ROWS), DRIFTED_TAG]) {
      insertVersion(migrated(), row);
    }
  });

  it('defaults rev to 0', () => {
    const db = migrated();
    db.prepare(
      "INSERT INTO versions (name, version, state, state_at, first_seen_at, git_sha) VALUES ('a', '1.0.0', 'tagged', 'now', 'now', 'sha')",
    ).run();

    assert.equal(db.prepare('SELECT rev FROM versions').get()?.rev, 0);
  });

  it('rejects a state outside the machine', () => {
    assert.throws(
      () =>
        insertVersion(migrated(), {
          ...ROWS.tagged,
          // SAFETY: deliberately outside the State union, to reach the CHECK
          state: 'released' as VersionRow['state'],
        }),
      /CHECK constraint failed/,
    );
  });

  const violations: [string, VersionRow][] = [
    [
      'a deprecated substate without npm_deprecated',
      { ...ROWS['released.deprecated'], npm_deprecated: null },
    ],
    [
      'npm_deprecated on an active substate',
      { ...ROWS['released.active'], npm_deprecated: 'use 2.0' },
    ],
    [
      'npm facts on a tagged row',
      { ...ROWS['published.active'], state: 'tagged' },
    ],
    [
      'npm facts on an abandoned row',
      { ...ROWS['published.active'], state: 'abandoned' },
    ],
    [
      'a published row without npm facts',
      { ...ROWS.tagged, state: 'published.active' },
    ],
    [
      'a GitHub release on a published row',
      { ...ROWS['released.active'], state: 'published.active' },
    ],
    [
      'a released row without a GitHub release',
      { ...ROWS['published.active'], state: 'released.active' },
    ],
    [
      'half the npm facts',
      { ...ROWS['published.active'], npm_published_at: null },
    ],
    [
      'a dist-tag without npm facts',
      { ...ROWS.tagged, npm_dist_tag: 'latest' },
    ],
    ['half the GitHub facts', { ...ROWS['released.active'], gh_url: null }],
    [
      'a prerelease flag outside 0 and 1',
      { ...ROWS['released.active'], gh_prerelease: 2 },
    ],
  ];

  for (const [label, row] of violations) {
    it(`rejects ${label}`, () => {
      assert.throws(
        () => insertVersion(migrated(), row),
        /CHECK constraint failed/,
      );
    });
  }

  for (const [label, row] of [
    ['its recorded deprecation', { ...ROWS['released.deprecated'] }],
    ['a GitHub release without npm', { ...ROWS['released.active'] }],
    ['no npm facts', DRIFTED_TAG],
  ] as const) {
    it(`lets a drifted row keep ${label}`, () => {
      insertVersion(migrated(), { ...row, state: 'drifted' });
    });
  }

  it('lets an abandoned row keep a GitHub release that drifted it', () => {
    insertVersion(migrated(), {
      ...ROWS['released.active'],
      state: 'abandoned',
      npm_integrity: null,
      npm_published_at: null,
      npm_dist_tag: null,
    });
  });

  it('rejects a wrongly typed column, being STRICT', () => {
    const db = migrated();

    assert.throws(
      () =>
        db
          .prepare(
            "INSERT INTO versions (name, version, state, state_at, first_seen_at, git_sha, gh_release_id) VALUES ('a', '1.0.0', 'tagged', 'now', 'now', 'sha', 'forty-two')",
          )
          .run(),
      /cannot store TEXT value in INTEGER column/,
    );
  });

  it('rejects a dist-tag or ledger event for a version with no row', () => {
    const db = migrated();
    insertClaim(db);

    assert.throws(
      () =>
        insertDistTag(db, {
          name: 'a',
          tag: 'latest',
          version: '1.0.0',
          updated_at: 'now',
        }),
      /FOREIGN KEY constraint failed/,
    );

    assert.throws(
      () =>
        db
          .prepare(
            "INSERT INTO ledger_events (name, version, event, to_state, payload, source, at, pipeline_event_id) VALUES ('a', '1.0.0', 'tag_observed', 'tagged', '{}', 'test', 'now', 1)",
          )
          .run(),
      /FOREIGN KEY constraint failed/,
    );
  });

  it('rejects a ledger event without its claim', () => {
    const db = migrated();
    insertVersion(db, ROWS.tagged);

    assert.throws(
      () =>
        db
          .prepare(
            "INSERT INTO ledger_events (name, version, event, to_state, payload, source, at, pipeline_event_id) VALUES ('lit-ui-router', '1.0.0', 'tag_observed', 'tagged', '{}', 'test', 'now', 99)",
          )
          .run(),
      /FOREIGN KEY constraint failed/,
    );
  });
});

describe('migrations: pipeline_events', () => {
  it('records a rejected claim for a version with no row', () => {
    const db = migrated();
    const result = fold(undefined, [EVENTS.npm_observed], ENVELOPE);

    insertClaim(db, MESSAGE_ID, {
      outcome: result.outcome,
      reason: result.rejected?.reason ?? null,
    });

    assert.equal(count(db, 'pipeline_events'), 1);
    assert.deepEqual(foldStatements(result, MESSAGE_ID), []);
  });

  it('requires a reason exactly when the claim was rejected', () => {
    assert.throws(
      () =>
        insertClaim(migrated(), MESSAGE_ID, {
          outcome: 'rejected',
          reason: null,
        }),
      /CHECK constraint failed/,
    );
    assert.throws(
      () =>
        insertClaim(migrated(), MESSAGE_ID, {
          outcome: 'applied',
          reason: 'no',
        }),
      /CHECK constraint failed/,
    );
    assert.throws(
      () =>
        insertClaim(migrated(), MESSAGE_ID, { outcome: 'stuck', reason: null }),
      /CHECK constraint failed/,
    );
  });

  it('records each queue message once', () => {
    const db = migrated();
    insertClaim(db);

    assert.throws(() => insertClaim(db), /UNIQUE constraint failed/);
  });
});

describe('migrations: fold statements', () => {
  it('inserts a new row and links its ledger events to the claim', () => {
    const db = migrated();
    insertClaim(db);

    const result = fold(
      undefined,
      [EVENTS.tag_observed, EVENTS.npm_observed, EVENTS.gh_release_observed],
      ENVELOPE,
    );

    const changes = batch(db, foldStatements(result, MESSAGE_ID));

    assert.deepEqual(changes, [1, 1, 1, 1]);
    assert.deepEqual(
      { ...db.prepare('SELECT state, rev, first_seen_at FROM versions').get() },
      { state: 'released.active', rev: 2, first_seen_at: ENVELOPE.at },
    );
    assert.deepEqual(
      db
        .prepare('SELECT DISTINCT pipeline_event_id AS id FROM ledger_events')
        .all()
        .map((row) => row.id),
      [1],
    );
  });

  it('updates an edited release body in place and logs it', () => {
    const db = migrated();
    insertVersion(db, ROWS['released.active']);
    insertClaim(db);

    const result = fold(
      ROWS['released.active'],
      [{ ...EVENTS.gh_release_observed, body: 'edited' }],
      ENVELOPE,
    );

    assert.deepEqual(batch(db, foldStatements(result, MESSAGE_ID)), [1, 1]);
    assert.deepEqual(
      { ...db.prepare('SELECT gh_body, state, rev FROM versions').get() },
      {
        gh_body: 'edited',
        state: 'released.active',
        rev: ROWS['released.active'].rev + 1,
      },
    );
  });

  it('changes nothing on a stale rev, and logs nothing', () => {
    const db = migrated();
    insertVersion(db, { ...ROWS['released.active'], rev: 9 });
    insertClaim(db);

    const result = fold(
      ROWS['released.active'],
      [{ ...EVENTS.gh_release_observed, body: 'edited' }],
      ENVELOPE,
    );

    assert.deepEqual(batch(db, foldStatements(result, MESSAGE_ID)), [0, 0]);
    assert.equal(
      db.prepare('SELECT gh_body FROM versions').get()?.gh_body,
      'notes',
    );
    assert.equal(count(db, 'ledger_events'), 0);
  });

  it('changes nothing when a new row already exists, and logs nothing', () => {
    const db = migrated();
    insertVersion(db, ROWS['published.active']);
    insertClaim(db);

    const result = fold(undefined, [EVENTS.tag_observed], ENVELOPE);

    assert.deepEqual(batch(db, foldStatements(result, MESSAGE_ID)), [0, 0]);
    assert.equal(count(db, 'ledger_events'), 0);
  });

  it('fails the batch when the claim was not recorded first', () => {
    const db = migrated();
    const result = fold(undefined, [EVENTS.tag_observed], ENVELOPE);

    assert.throws(
      () => batch(db, foldStatements(result, MESSAGE_ID)),
      /NOT NULL constraint failed/,
    );
    assert.equal(count(db, 'versions'), 0);
  });

  it('stores every applied outcome of the machine', () => {
    for (const from of [undefined, ...STATES]) {
      for (const type of EVENT_TYPES) {
        const row = from && ROWS[from];
        const result = fold(row, [EVENTS[type]], ENVELOPE);

        if (result.outcome !== 'applied') continue;

        const db = migrated();

        if (row) insertVersion(db, row);
        insertClaim(db);

        assert.deepEqual(
          batch(db, foldStatements(result, MESSAGE_ID)),
          [1, 1],
          `${from} + ${type}`,
        );
      }
    }
  });

  it('stores the ways out of abandoned and drifted', () => {
    for (const [row, event] of [
      [DRIFTED_TAG, EVENTS.abandon],
      [ROWS.abandoned, EVENTS.repair],
      [ROWS.abandoned, EVENTS.npm_observed],
    ] satisfies [VersionRow, ReleaseEvent][]) {
      const db = migrated();
      insertVersion(db, row);
      insertClaim(db);

      const result = fold(row, [event], ENVELOPE);

      assert.deepEqual(batch(db, foldStatements(result, MESSAGE_ID)), [1, 1]);
    }
  });

  it('rebuilds the row by replaying ledger_events payloads', () => {
    const db = migrated();

    const claims: ReleaseEvent[][] = [
      [EVENTS.tag_observed, EVENTS.npm_observed],
      [
        EVENTS.gh_release_observed,
        { ...EVENTS.gh_release_observed, body: 'edited' },
      ],
      [EVENTS.deprecation_observed],
      [EVENTS.mismatch_observed],
    ];

    let row: VersionRow | undefined;

    for (const [index, events] of claims.entries()) {
      insertClaim(db, `message-${index}`);
      const result = fold(row, events, ENVELOPE);
      batch(db, foldStatements(result, `message-${index}`));
      row = result.row ?? row;
    }

    let replayed: VersionRow | undefined;

    for (const logged of db
      .prepare('SELECT event, payload FROM ledger_events ORDER BY id')
      .all()) {
      // SAFETY: the rows were written from ReleaseEvents by foldStatements
      const event = {
        type: logged.event,
        ...JSON.parse(String(logged.payload)),
      } as ReleaseEvent;

      const outcome = apply(replayed, event, ENVELOPE);

      assert.equal(outcome.kind, 'applied');

      if (outcome.kind === 'applied') replayed = outcome.row;
    }

    assert.deepEqual(replayed, {
      ...db.prepare('SELECT * FROM versions').get(),
    });
  });
});

describe('migrations: dist-tag statements', () => {
  const latest: DistTagRow = {
    name: ENVELOPE.name,
    tag: 'latest',
    version: '0.9.0',
    updated_at: '2026-09-01T00:00:00.000Z',
  };

  function seeded(): DatabaseSync {
    const db = migrated();
    insertVersion(db, ROWS['released.active']);
    insertVersion(db, { ...ROWS['released.active'], version: '0.9.0' });
    insertClaim(db);

    return db;
  }

  const tagRows = (db: DatabaseSync) =>
    db
      .prepare('SELECT tag, version FROM dist_tags')
      .all()
      .map((row) => ({ ...row }));

  it('inserts a new tag and logs it', () => {
    const db = seeded();

    const outcome = moveDistTag(
      undefined,
      ROWS['released.active'],
      'latest',
      ENVELOPE,
    );

    assert.deepEqual(batch(db, distTagStatements(outcome, MESSAGE_ID)), [1, 1]);
    assert.deepEqual(tagRows(db), [{ tag: 'latest', version: '1.0.0' }]);
  });

  it('moves a tag and logs it', () => {
    const db = seeded();
    insertDistTag(db, latest);

    const outcome = moveDistTag(
      latest,
      ROWS['released.active'],
      'latest',
      ENVELOPE,
    );

    assert.deepEqual(batch(db, distTagStatements(outcome, MESSAGE_ID)), [1, 1]);
    assert.deepEqual(tagRows(db), [{ tag: 'latest', version: '1.0.0' }]);
  });

  it('changes nothing when the tag moved since it was read', () => {
    const db = seeded();
    insertDistTag(db, { ...latest, version: '1.0.0' });

    const outcome = moveDistTag(latest, ROWS['released.active'], 'latest', {
      ...ENVELOPE,
      at: '2026-10-03T00:00:00.000Z',
    });

    assert.deepEqual(batch(db, distTagStatements(outcome, MESSAGE_ID)), [0, 0]);
    assert.equal(count(db, 'ledger_events'), 0);
  });

  it('removes a tag and logs it', () => {
    const db = seeded();
    const next = { ...latest, tag: 'next', version: '1.0.0' };
    insertDistTag(db, next);

    const outcome = removeDistTag(
      next,
      ROWS['released.active'],
      'next',
      ENVELOPE,
    );

    assert.deepEqual(batch(db, distTagStatements(outcome, MESSAGE_ID)), [1, 1]);
    assert.deepEqual(tagRows(db), []);
    assert.equal(
      db.prepare('SELECT event FROM ledger_events').get()?.event,
      'dist_tag_removed',
    );
  });

  it('changes nothing when the tag moved before its removal, and logs nothing', () => {
    const db = seeded();
    insertDistTag(db, { ...latest, version: '1.0.0' });

    const outcome = removeDistTag(
      latest,
      { ...ROWS['released.active'], version: '0.9.0' },
      'latest',
      ENVELOPE,
    );

    assert.deepEqual(batch(db, distTagStatements(outcome, MESSAGE_ID)), [0, 0]);
    assert.equal(count(db, 'dist_tags'), 1);
    assert.equal(count(db, 'ledger_events'), 0);
  });

  it('points a tag at a drifted version that reached npm', () => {
    const db = migrated();
    insertVersion(db, ROWS.drifted);
    insertClaim(db);
    const outcome = moveDistTag(undefined, ROWS.drifted, 'latest', ENVELOPE);

    assert.deepEqual(batch(db, distTagStatements(outcome, MESSAGE_ID)), [1, 1]);
  });
});
