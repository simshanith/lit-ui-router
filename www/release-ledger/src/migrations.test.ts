// Applies the migrations to an in-memory SQLite, the engine under D1, and
// writes the fold's outcomes through the real constraints.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

import {
  type DistTagOutcome,
  type DistTagRow,
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
  removeDistTag,
  repair,
  type Statement,
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
  'first_seen_at',
  'rev',
  ...FACT_COLUMNS,
] as const;

function insertVersion(db: DatabaseSync, row: VersionRow): void {
  db.prepare(
    `INSERT INTO versions (${VERSION_COLUMNS.join(', ')}) VALUES (${VERSION_COLUMNS.map(() => '?').join(', ')})`,
  ).run(...VERSION_COLUMNS.map((column) => row[column]));
}

/** The consumer's claim insert, guarded as foldStatements asks. */
function claimInsert(
  guard: Statement,
  messageId = MESSAGE_ID,
  outcome = 'applied',
): Statement {
  const reason = outcome === 'rejected' ? 'malformed' : null;

  return {
    sql: `INSERT INTO pipeline_events (message_id, received_at, repository, job_workflow_ref, run_id, run_attempt, sha, payload, outcome, reason)
          SELECT ?, 'now', 'simshanith/lit-ui-router', 'simshanith/lit-ui-router/.github/workflows/publish-npm.yml@refs/heads/main', '1', 1, 'sha', '{}', ?, ? WHERE ${guard.sql}`,
    params: [messageId, outcome, reason, ...guard.params],
  };
}

function insertDistTag(db: DatabaseSync, row: DistTagRow): void {
  db.prepare(
    'INSERT INTO dist_tags (name, tag, version, updated_at) VALUES (?, ?, ?, ?)',
  ).run(row.name, row.tag, row.version, row.updated_at);
}

/** Runs the statements in one transaction, as a D1 batch does. */
function batch(db: DatabaseSync, statements: Statement[]): void {
  db.exec('BEGIN');

  try {
    for (const { sql, params } of statements) db.prepare(sql).run(...params);

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** The consumer's batch for a fold; `true` when the claim was recorded. */
function write(
  db: DatabaseSync,
  folded: Fold,
  tags: DistTagOutcome[] = [],
  messageId = MESSAGE_ID,
): boolean {
  const statements = foldStatements(folded, tags, messageId);

  batch(db, [
    claimInsert(statements.guard, messageId, statements.outcome),
    ...(statements.write ? [statements.write] : []),
    ...statements.distTags,
    ...statements.ledger,
  ]);

  return (
    db
      .prepare('SELECT 1 FROM pipeline_events WHERE message_id = ?')
      .get(messageId) !== undefined
  );
}

const rowOf = (folded: Fold): VersionRow | undefined =>
  folded.outcome === 'applied' ? folded.row : undefined;

const LATEST: DistTagRow = {
  name: ENVELOPE.name,
  tag: 'latest',
  version: '0.9.0',
  updated_at: '2026-09-01T00:00:00.000Z',
};

/** The version and an older one, both on npm. */
function seeded(): DatabaseSync {
  const db = migrated();

  insertVersion(db, ROWS.published);
  insertVersion(db, { ...ROWS.published, version: '0.9.0' });

  return db;
}

const count = (db: DatabaseSync, table: string): number =>
  Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n);

const stored = (db: DatabaseSync) => ({
  ...db.prepare('SELECT * FROM versions').get(),
});

describe('migrations', () => {
  it('creates the ledger tables and view', () => {
    const objects = migrated()
      .prepare(
        "SELECT type, name FROM sqlite_schema WHERE type IN ('table', 'view') ORDER BY name",
      )
      .all()
      .map((row) => `${String(row.type)} ${String(row.name)}`);

    assert.deepEqual(objects, [
      'table dead_letters',
      'table dist_tags',
      'table ledger_events',
      'table pipeline_events',
      'view version_states',
      'table versions',
    ]);
  });

  it('accepts every fixture row', () => {
    for (const row of Object.values(ROWS)) insertVersion(migrated(), row);
  });

  const violations: [string, VersionRow][] = [
    ['half the npm facts', { ...ROWS.published, npm_published_at: null }],
    ['a dist-tag without npm', { ...ROWS.tagged, npm_dist_tag: 'latest' }],
    ['a deprecation without npm', { ...ROWS.tagged, npm_deprecated: 'no' }],
    ['an npm conflict without npm', { ...ROWS.tagged, npm_conflict: 'null' }],
    ['half the GitHub facts', { ...ROWS.released, gh_url: null }],
    [
      'a gh conflict without a release',
      { ...ROWS.published, gh_conflict: 'null' },
    ],
    [
      'a tag conflict without a sha',
      { ...ROWS.tagged, git_sha: null, tag_conflict: 'null' },
    ],
    [
      'a prerelease flag outside 0 and 1',
      { ...ROWS.released, gh_prerelease: 2 },
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

  it('rejects a wrongly typed column, being STRICT', () => {
    assert.throws(
      () =>
        insertVersion(migrated(), {
          ...ROWS.released,
          // SAFETY: deliberately mistyped, to reach STRICT
          gh_release_id: 'forty-two' as never,
        }),
      /cannot store TEXT value in INTEGER column/,
    );
  });

  it('rejects a dist-tag for a version with no row', () => {
    assert.throws(
      () =>
        insertDistTag(migrated(), {
          name: 'a',
          tag: 'latest',
          version: '1.0.0',
          updated_at: 'now',
        }),
      /FOREIGN KEY constraint failed/,
    );
  });

  it('requires a reason exactly when the claim was rejected', () => {
    for (const [outcome, reason] of [
      ['rejected', null],
      ['applied', 'no'],
      ['stuck', null],
    ]) {
      assert.throws(
        () =>
          migrated()
            .prepare(
              "INSERT INTO pipeline_events (message_id, received_at, repository, job_workflow_ref, run_id, run_attempt, sha, payload, outcome, reason) VALUES ('m', 'now', 'r', 'w', '1', 1, 's', '{}', ?, ?)",
            )
            .run(outcome, reason),
        /CHECK constraint failed/,
      );
    }
  });
});

describe('migrations: version_states', () => {
  const cases: [string, VersionRow, string][] = [
    ['tagged', ROWS.tagged, 'tagged'],
    ['published', ROWS.published, 'published'],
    ['deprecated', ROWS.deprecated, 'published'],
    ['released', ROWS.released, 'released'],
    ['released before npm', ROWS.releasedFirst, 'tagged'],
    ['in conflict', { ...ROWS.released, gh_conflict: 'null' }, 'conflict'],
    ['untagged', { ...ROWS.published, git_sha: null }, 'untagged'],
    ['released untagged', { ...ROWS.released, git_sha: null }, 'untagged'],
    [
      'untagged conflict',
      { ...ROWS.released, git_sha: null, npm_conflict: 'null' },
      'conflict',
    ],
  ];

  for (const [label, row, status] of cases) {
    it(`derives the states of a ${label} row as the core does`, () => {
      const db = migrated();
      insertVersion(db, row);

      assert.deepEqual(
        {
          ...db
            .prepare('SELECT npm_state, gh_state, status FROM version_states')
            .get(),
        },
        { npm_state: npmState(row), gh_state: ghState(row), status },
      );
      assert.equal(statusOf(row), status);
    });
  }

  /** The string literals one CASE of the view can yield, in order. */
  function viewCase(column: string): string[] {
    const sql = String(
      migrated()
        .prepare("SELECT sql FROM sqlite_schema WHERE name = 'version_states'")
        .get()?.sql,
    );

    const body = sql
      .split('CASE')
      .find((branch) => branch.includes(`END AS ${column}`));

    return [...(body ?? '').matchAll(/(?:THEN|ELSE) '(\w+)'/g)].map(
      ([, literal]) => literal,
    );
  }

  it('names the states and statuses the core exports', () => {
    assert.deepEqual(viewCase('npm_state'), NPM_STATES);
    assert.deepEqual(viewCase('gh_state'), GH_STATES);
    assert.deepEqual(viewCase('status'), STATUSES);
  });
});

describe('migrations: fold statements', () => {
  it('inserts a new row and links its ledger events to the claim', () => {
    const db = migrated();

    assert.ok(write(db, fold(undefined, OBSERVED, ENVELOPE)));
    assert.deepEqual(stored(db), {
      ...ROWS.released,
      rev: 0,
      first_seen_at: ENVELOPE.at,
    });
    assert.deepEqual(
      db
        .prepare(
          'SELECT region, pipeline_event_id AS id FROM ledger_events ORDER BY id',
        )
        .all()
        .map((row) => [row.region, row.id]),
      [
        ['tag', 1],
        ['npm', 1],
        ['gh', 1],
      ],
    );
  });

  it('records a rejected claim and writes nothing else', () => {
    const db = migrated();

    assert.ok(
      write(db, fold(undefined, { npm: { ...NPM, deprecated: '' } }, ENVELOPE)),
    );
    assert.equal(count(db, 'versions'), 0);
  });

  it('records no claim and writes nothing on a stale rev', () => {
    const db = migrated();
    insertVersion(db, { ...ROWS.released, rev: 9 });

    const folded = fold(
      ROWS.released,
      { gh: { ...GH, body: 'edited' } },
      ENVELOPE,
    );

    assert.equal(write(db, folded), false);
    assert.equal(stored(db).gh_body, GH.body);
    assert.equal(count(db, 'ledger_events'), 0);
  });

  it('records no claim when a new row already exists', () => {
    const db = migrated();
    insertVersion(db, ROWS.published);

    assert.equal(write(db, fold(undefined, OBSERVED, ENVELOPE)), false);
    assert.equal(count(db, 'ledger_events'), 0);
  });

  it('records no claim and writes nothing when a dist-tag moved since it was read', () => {
    const db = seeded();

    insertDistTag(db, { ...LATEST, version: ENVELOPE.version });

    const folded = fold(
      ROWS.published,
      { npm: { ...NPM, deprecated: DEPRECATION } },
      ENVELOPE,
    );

    const tags = [moveDistTag(LATEST, rowOf(folded), 'latest', ENVELOPE)];

    assert.equal(write(db, folded, tags), false);
    assert.equal(stored(db).npm_deprecated, null);
    assert.equal(count(db, 'ledger_events'), 0);
  });

  it('records a claim that only moves a dist-tag as applied', () => {
    const db = migrated();

    insertVersion(db, ROWS.published);

    const tags = [moveDistTag(undefined, ROWS.published, 'next', ENVELOPE)];

    assert.ok(write(db, fold(ROWS.published, { npm: NPM }, ENVELOPE), tags));
    assert.equal(
      db.prepare('SELECT outcome FROM pipeline_events').get()?.outcome,
      'applied',
    );
    assert.deepEqual(
      { ...db.prepare('SELECT region, event FROM ledger_events').get() },
      { region: 'npm', event: 'dist_tag_moved' },
    );
  });

  it('moves and removes dist-tags with the fold', () => {
    const db = seeded();
    const next = { ...LATEST, tag: 'next', version: ENVELOPE.version };

    insertDistTag(db, LATEST);
    insertDistTag(db, next);

    const folded = fold(ROWS.published, { gh: GH }, ENVELOPE);

    assert.ok(
      write(db, folded, [
        moveDistTag(LATEST, rowOf(folded), 'latest', ENVELOPE),
        removeDistTag(next, rowOf(folded), 'next', ENVELOPE),
      ]),
    );
    assert.deepEqual(
      db
        .prepare('SELECT tag, version FROM dist_tags')
        .all()
        .map((tag) => ({ ...tag })),
      [{ tag: 'latest', version: ENVELOPE.version }],
    );
    assert.deepEqual(
      db
        .prepare('SELECT event FROM ledger_events ORDER BY id')
        .all()
        .map((event) => event.event),
      ['observed', 'dist_tag_moved', 'dist_tag_removed'],
    );
  });

  it('records no claim when a removed dist-tag pointed at a version that moved', () => {
    const db = seeded();
    const older = { ...ROWS.published, version: '0.9.0' };

    insertDistTag(db, LATEST);

    const removal = removeDistTag(LATEST, older, 'latest', ENVELOPE);

    db.prepare(
      "UPDATE versions SET rev = rev + 1, npm_deprecated = 'gone' WHERE version = '0.9.0'",
    ).run();

    assert.equal(
      write(db, fold(ROWS.published, { gh: GH }, ENVELOPE), [removal]),
      false,
    );
    assert.equal(count(db, 'dist_tags'), 1);
    assert.equal(count(db, 'ledger_events'), 0);
  });

  const observations: Observation[] = [
    OBSERVED,
    { tag: null, npm: null, gh: null },
    { tag: { sha: OTHER_SHA } },
    { npm: { ...NPM, integrity: 'sha512-BBBB' } },
    { npm: { ...NPM, deprecated: DEPRECATION } },
    { gh: { ...GH, body: 'edited' } },
    { gh: { ...GH, id: 43 } },
  ];

  it('stores every applied outcome of the fold', () => {
    for (const [label, row] of [
      ['new', undefined],
      ...Object.entries(ROWS),
    ] as const) {
      for (const observed of observations) {
        const folded = fold(row, observed, ENVELOPE);

        if (folded.outcome !== 'applied') continue;

        const db = migrated();

        if (row) insertVersion(db, row);

        assert.ok(write(db, folded), `${label} + ${JSON.stringify(observed)}`);
        assert.deepEqual(stored(db), { ...folded.row });
      }
    }
  });

  it('stores a repair', () => {
    const row = rowOf(fold(ROWS.published, { npm: null }, ENVELOPE));

    assert.ok(row);

    const db = migrated();

    insertVersion(db, row);

    assert.ok(write(db, repair(row, 'npm', { npm: NPM }, ENVELOPE)));
    assert.equal(count(db, 'ledger_events'), 1);
  });
});

describe('migrations: replay', () => {
  it('rebuilds the row from ledger_events', () => {
    const db = migrated();

    const claims: Observation[] = [
      { tag: OBSERVED.tag, npm: NPM },
      { gh: GH },
      { gh: { ...GH, body: 'edited' } },
      { npm: { ...NPM, deprecated: DEPRECATION } },
      { tag: { sha: OTHER_SHA } },
    ];

    let row: VersionRow | undefined;

    for (const [index, observed] of claims.entries()) {
      const folded = fold(row, observed, ENVELOPE);
      write(db, folded, [], `message-${index}`);
      row = rowOf(folded) ?? row;
    }

    const repaired = repair(row, 'tag', { tag: { sha: OTHER_SHA } }, ENVELOPE);
    write(db, repaired, [], 'message-repair');

    let replayed: VersionRow | undefined;

    for (const logged of db
      .prepare('SELECT region, event, payload FROM ledger_events ORDER BY id')
      .all()) {
      // SAFETY: the rows were written by foldStatements
      const region = logged.region as Region;
      const facts: unknown = JSON.parse(String(logged.payload));
      // SAFETY: the payload is the region's observation, as fold logged it
      const observed = { [region]: facts } as Observation;

      const folded =
        logged.event === 'repair'
          ? repair(replayed, region, observed, ENVELOPE)
          : fold(replayed, observed, ENVELOPE);

      assert.equal(
        folded.outcome,
        'applied',
        `${region} ${String(logged.event)}`,
      );
      replayed = rowOf(folded) ?? replayed;
    }

    const { rev: _rev, ...facts } = stored(db);
    const { rev: _replayedRev, ...rebuilt } = replayed ?? {};

    assert.deepEqual(rebuilt, facts);
  });
});
