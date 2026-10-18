// Applies the migrations to an in-memory SQLite, the engine under D1, and
// writes the machine's outcomes through the real constraints.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

import {
  apply,
  EVENT_TYPES,
  FACT_COLUMNS,
  type LedgerEventRow,
  STATES,
  type VersionRow,
} from './release-ledger.core.ts';
import { ENVELOPE, EVENTS, ROWS } from './release-ledger.fixtures.ts';

const MIGRATIONS = new URL('../migrations/', import.meta.url);

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
  ...FACT_COLUMNS,
] as const;

function insertVersion(db: DatabaseSync, row: VersionRow): void {
  db.prepare(
    `INSERT INTO versions (${VERSION_COLUMNS.join(', ')}) VALUES (${VERSION_COLUMNS.map(() => '?').join(', ')})`,
  ).run(...VERSION_COLUMNS.map((column) => row[column]));
}

function insertEvent(db: DatabaseSync, event: LedgerEventRow): void {
  db.prepare(
    `INSERT INTO ledger_events (name, version, event, from_state, to_state, payload, source, run_url, at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    event.name,
    event.version,
    event.event,
    event.from_state,
    event.to_state,
    event.payload,
    event.source,
    event.run_url,
    event.at,
  );
}

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
    for (const state of STATES) {
      const db = migrated();
      insertVersion(db, ROWS[state]);
    }
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

  it('rejects a deprecated substate without npm_deprecated', () => {
    assert.throws(
      () =>
        insertVersion(migrated(), {
          ...ROWS['released.deprecated'],
          npm_deprecated: null,
        }),
      /CHECK constraint failed/,
    );
  });

  it('rejects npm_deprecated on an active substate', () => {
    assert.throws(
      () =>
        insertVersion(migrated(), {
          ...ROWS['released.active'],
          npm_deprecated: 'use 2.0',
        }),
      /CHECK constraint failed/,
    );
  });

  it('lets a drifted row keep its recorded deprecation', () => {
    insertVersion(migrated(), {
      ...ROWS['released.deprecated'],
      state: 'drifted',
    });
  });

  it('rejects a wrongly typed column, being STRICT', () => {
    const db = migrated();

    assert.throws(
      () =>
        db
          .prepare(
            "INSERT INTO versions (name, version, state, state_at, git_sha, gh_release_id) VALUES ('a', '1.0.0', 'tagged', 'now', 'sha', 'forty-two')",
          )
          .run(),
      /cannot store TEXT value in INTEGER column/,
    );
  });

  it('rejects a dist-tag or ledger event for a version with no row', () => {
    const db = migrated();

    assert.throws(
      () =>
        db
          .prepare(
            "INSERT INTO dist_tags (name, tag, version, updated_at) VALUES ('a', 'latest', '1.0.0', 'now')",
          )
          .run(),
      /FOREIGN KEY constraint failed/,
    );

    assert.throws(
      () =>
        insertEvent(db, {
          name: 'a',
          version: '1.0.0',
          event: 'tag_observed',
          from_state: null,
          to_state: 'tagged',
          payload: '{}',
          source: 'test',
          run_url: null,
          at: 'now',
        }),
      /FOREIGN KEY constraint failed/,
    );
  });

  it('updates an edited release body in place and logs it', () => {
    const db = migrated();
    insertVersion(db, ROWS['released.active']);

    const outcome = apply(
      ROWS['released.active'],
      { ...EVENTS.gh_release_observed, body: 'edited' },
      ENVELOPE,
    );

    assert.equal(outcome.kind, 'applied');

    if (outcome.kind !== 'applied') return;

    db.prepare(
      'UPDATE versions SET gh_body = ?, state_at = ? WHERE name = ? AND version = ? AND state = ?',
    ).run(
      outcome.row.gh_body,
      outcome.row.state_at,
      outcome.row.name,
      outcome.row.version,
      ROWS['released.active'].state,
    );
    insertEvent(db, outcome.event);

    assert.deepEqual(
      { ...db.prepare('SELECT gh_body, state FROM versions').get() },
      { gh_body: 'edited', state: 'released.active' },
    );
  });

  it('stores an abandoned tag that reached npm as drifted', () => {
    const db = migrated();
    const outcome = apply(ROWS.abandoned, EVENTS.npm_observed, ENVELOPE);

    assert.equal(outcome.kind, 'applied');

    if (outcome.kind !== 'applied') return;

    insertVersion(db, outcome.row);
    insertEvent(db, outcome.event);
  });

  it('stores every applied outcome of the machine', () => {
    for (const from of [undefined, ...STATES]) {
      for (const type of EVENT_TYPES) {
        const outcome = apply(from && ROWS[from], EVENTS[type], ENVELOPE);

        if (outcome.kind !== 'applied') continue;

        const db = migrated();
        insertVersion(db, outcome.row);
        insertEvent(db, outcome.event);
      }
    }
  });
});
