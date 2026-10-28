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
  GH_STATES,
  ghState,
  moveDistTag,
  NPM_STATES,
  npmState,
  type Observation,
  type Region,
  removeDistTag,
  repair,
  statusOf,
  STATUSES,
  type VersionRow,
} from '@tools/release-ledger';
import {
  DEPRECATION,
  ENVELOPE,
  GH,
  NPM,
  OBSERVED,
  OTHER_SHA,
  ROWS,
} from '@tools/release-ledger/fixtures';

import {
  CLAIM_ORIGINS,
  CLAIM_OUTCOMES,
  claimInsert,
  type ClaimRow,
  foldStatements,
  type Statement,
} from './ledger-statements.ts';

const MIGRATIONS = new URL('../migrations/', import.meta.url);

const MESSAGE_ID = 'message-1';

const MIGRATION_FILES = readdirSync(MIGRATIONS).sort();

/** Runs one migration in a transaction, as `wrangler d1 migrations apply` does. */
function migrate(db: DatabaseSync, file: string): void {
  db.exec('BEGIN');

  try {
    db.exec(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function migrated(files = MIGRATION_FILES): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  // D1 enforces foreign keys by default; SQLite does not.
  db.exec('PRAGMA foreign_keys = ON');

  for (const file of files) migrate(db, file);

  return db;
}

const VERSION_COLUMNS = [
  'name',
  'version',
  'first_seen_at',
  ...FACT_COLUMNS,
] as const;

function insertVersion(db: DatabaseSync, row: VersionRow): void {
  db.prepare(
    `INSERT INTO versions (${VERSION_COLUMNS.join(', ')}) VALUES (${VERSION_COLUMNS.map(() => '?').join(', ')})`,
  ).run(...VERSION_COLUMNS.map((column) => row[column]));
}

const RUN_CLAIM: ClaimRow = {
  message_id: MESSAGE_ID,
  received_at: 'now',
  body: '{}',
  outcome: 'applied',
  reason: null,
  attempts: 1,
  name: ENVELOPE.name,
  version: ENVELOPE.version,
  origin: 'run',
  repository: 'simshanith/lit-ui-router',
  job_workflow_ref:
    'simshanith/lit-ui-router/.github/workflows/publish-npm.yml@refs/heads/main',
  run_id: '1',
  run_attempt: 1,
  sha: 'sha',
  actor: null,
};

const SWEEP_CLAIM: ClaimRow = {
  ...RUN_CLAIM,
  origin: 'sweep',
  job_workflow_ref: null,
  run_id: null,
  run_attempt: null,
};

const MANUAL_CLAIM: ClaimRow = {
  ...SWEEP_CLAIM,
  origin: 'manual',
  actor: 'simshanith',
};

const UNDECODABLE_CLAIM: ClaimRow = {
  ...RUN_CLAIM,
  outcome: 'undecodable',
  name: null,
  version: null,
  origin: null,
  repository: null,
  job_workflow_ref: null,
  run_id: null,
  run_attempt: null,
  sha: null,
};

const insertClaim = (db: DatabaseSync, row: ClaimRow): void => {
  const { sql, params } = claimInsert(row);

  db.prepare(sql).run(...params);
};

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

/** The consumer's batch for a fold. */
function write(
  db: DatabaseSync,
  folded: Fold,
  tags: DistTagOutcome[] = [],
  messageId = MESSAGE_ID,
): void {
  const statements = foldStatements(folded, tags, messageId);

  batch(db, [
    claimInsert({
      ...RUN_CLAIM,
      message_id: messageId,
      outcome: statements.outcome,
      reason: statements.reason,
    }),
    ...(statements.write ? [statements.write] : []),
    ...statements.distTags,
    ...statements.ledger,
  ]);
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
      'table claims',
      'table dist_tags',
      'table ledger_events',
      'view version_states',
      'table versions',
    ]);
  });

  it('accepts every fixture row', () => {
    for (const row of Object.values(ROWS)) insertVersion(migrated(), row);
  });

  const violations: [string, VersionRow][] = [
    ['half the npm facts', { ...ROWS.published, npm_published_at: null }],
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
});

describe('migrations: claims', () => {
  const valid: [string, ClaimRow][] = [
    ['an applied run claim', RUN_CLAIM],
    ['an unchanged sweep claim', { ...SWEEP_CLAIM, outcome: 'unchanged' }],
    ['a rejected claim', { ...RUN_CLAIM, outcome: 'rejected', reason: 'no' }],
    ['an undecodable message', UNDECODABLE_CLAIM],
    ['an exhausted run claim', { ...RUN_CLAIM, outcome: 'exhausted' }],
    ['an exhausted sweep claim', { ...SWEEP_CLAIM, outcome: 'exhausted' }],
    ['an applied manual claim', MANUAL_CLAIM],
    ['an exhausted manual claim', { ...MANUAL_CLAIM, outcome: 'exhausted' }],
  ];

  for (const [label, row] of valid) {
    it(`accepts ${label}`, () => {
      insertClaim(migrated(), row);
    });
  }

  const invalid: [string, ClaimRow][] = [
    // SAFETY: deliberately mistyped, to reach the CHECKs
    ['an unknown outcome', { ...RUN_CLAIM, outcome: 'stuck' as never }],
    // SAFETY: deliberately mistyped, to reach the CHECKs
    ['an unknown origin', { ...RUN_CLAIM, origin: 'cron' as never }],
    ['a rejection without a reason', { ...RUN_CLAIM, outcome: 'rejected' }],
    ['a reason without a rejection', { ...RUN_CLAIM, reason: 'no' }],
    [
      'an undecodable message with claim columns',
      { ...RUN_CLAIM, outcome: 'undecodable' },
    ],
    [
      'a decoded claim without claim columns',
      { ...UNDECODABLE_CLAIM, outcome: 'exhausted' },
    ],
    ['a claim without a version', { ...RUN_CLAIM, version: null }],
    ['a claim without an origin', { ...RUN_CLAIM, origin: null }],
    ['a claim without a repository', { ...RUN_CLAIM, repository: null }],
    ['a claim without a sha', { ...RUN_CLAIM, sha: null }],
    ['a run without its workflow', { ...RUN_CLAIM, job_workflow_ref: null }],
    ['a run without its id', { ...RUN_CLAIM, run_id: null }],
    ['a run without its attempt', { ...RUN_CLAIM, run_attempt: null }],
    ['a sweep with a run id', { ...SWEEP_CLAIM, run_id: '1' }],
    ['a manual claim without its actor', { ...MANUAL_CLAIM, actor: null }],
    ['a manual claim with a run id', { ...MANUAL_CLAIM, run_id: '1' }],
    ['a run with an actor', { ...RUN_CLAIM, actor: 'simshanith' }],
    ['a sweep with an actor', { ...SWEEP_CLAIM, actor: 'simshanith' }],
    [
      'an undecodable message with an actor',
      { ...UNDECODABLE_CLAIM, actor: 'simshanith' },
    ],
    [
      'an undecodable message with run columns',
      {
        ...UNDECODABLE_CLAIM,
        job_workflow_ref: 'w',
        run_id: '1',
        run_attempt: 1,
      },
    ],
  ];

  for (const [label, row] of invalid) {
    it(`rejects ${label}`, () => {
      assert.throws(
        () => insertClaim(migrated(), row),
        /CHECK constraint failed/,
      );
    });
  }

  it('keeps the first row for a message when asked to', () => {
    const db = migrated();

    insertClaim(db, RUN_CLAIM);

    const { sql, params } = claimInsert(
      { ...RUN_CLAIM, outcome: 'exhausted' },
      'keep',
    );

    db.prepare(sql).run(...params);
    assert.deepEqual(
      db
        .prepare('SELECT outcome FROM claims')
        .all()
        .map((row) => row.outcome),
      ['applied'],
    );
    assert.throws(() => insertClaim(db, RUN_CLAIM), /UNIQUE constraint failed/);
  });

  /** The string literals a column's `IN (...)` CHECK lists, in order. */
  function checkList(column: string): string[] {
    const sql = String(
      migrated()
        .prepare("SELECT sql FROM sqlite_schema WHERE name = 'claims'")
        .get()?.sql,
    );

    const list = new RegExp(
      `${column} +TEXT(?: NOT NULL)? CHECK \\(${column} IN \\(([^)]*)\\)\\)`,
    ).exec(sql)?.[1];

    return [...(list ?? '').matchAll(/'(\w+)'/g)].map(([, literal]) => literal);
  }

  it('lists the outcomes and origins the consumer exports', () => {
    assert.deepEqual(checkList('outcome'), CLAIM_OUTCOMES);
    assert.deepEqual(checkList('origin'), CLAIM_ORIGINS);
  });
});

describe('migrations: 0002_manual_claims', () => {
  const BEFORE = MIGRATION_FILES.slice(0, 1);

  const V1_COLUMNS = [
    'message_id',
    'received_at',
    'body',
    'outcome',
    'reason',
    'attempts',
    'name',
    'version',
    'origin',
    'repository',
    'job_workflow_ref',
    'run_id',
    'run_attempt',
    'sha',
  ] as const satisfies readonly (keyof ClaimRow)[];

  function insertV1Claim(db: DatabaseSync, id: number, row: ClaimRow): void {
    db.prepare(
      `INSERT INTO claims (id, ${V1_COLUMNS.join(', ')}) VALUES (?, ${V1_COLUMNS.map(() => '?').join(', ')})`,
    ).run(id, ...V1_COLUMNS.map((column) => row[column]));
  }

  const claimsOf = (db: DatabaseSync) =>
    db
      .prepare('SELECT * FROM claims ORDER BY id')
      .all()
      .map((row) => ({ ...row }));

  it('keeps every claim and its id, and the ledger events pointing at them', () => {
    assert.deepEqual(BEFORE, ['0001_ledger.sql']);

    const db = migrated(BEFORE);

    const rows: [number, ClaimRow][] = [
      [3, RUN_CLAIM],
      [7, { ...SWEEP_CLAIM, message_id: 'message-2', outcome: 'unchanged' }],
      [8, { ...UNDECODABLE_CLAIM, message_id: 'message-3' }],
    ];

    for (const [id, row] of rows) insertV1Claim(db, id, row);
    insertVersion(db, ROWS.tagged);
    db.prepare(
      "INSERT INTO ledger_events (claim_id, name, version, region, event, payload) VALUES (7, ?, ?, 'tag', 'observed', '{}')",
    ).run(ROWS.tagged.name, ROWS.tagged.version);

    const before = claimsOf(db);

    migrate(db, '0002_manual_claims.sql');

    assert.deepEqual(
      claimsOf(db),
      before.map((row) => ({ ...row, actor: null })),
    );
    assert.deepEqual(
      db
        .prepare(
          'SELECT claims.id, claims.message_id FROM ledger_events JOIN claims ON claims.id = ledger_events.claim_id',
        )
        .all()
        .map((row) => ({ ...row })),
      [{ id: 7, message_id: 'message-2' }],
    );
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.deepEqual(
      db
        .prepare(
          "SELECT name FROM sqlite_schema WHERE type = 'index' AND tbl_name = 'claims' AND sql IS NOT NULL",
        )
        .all()
        .map((row) => row.name),
      ['claims_by_version'],
    );

    insertClaim(db, { ...MANUAL_CLAIM, message_id: 'message-4' });
    assert.throws(
      () =>
        db
          .prepare(
            "INSERT INTO ledger_events (claim_id, name, version, region, event, payload) VALUES (99, ?, ?, 'tag', 'observed', '{}')",
          )
          .run(ROWS.tagged.name, ROWS.tagged.version),
      /FOREIGN KEY constraint failed/,
    );
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

    write(db, fold(undefined, OBSERVED, ENVELOPE));
    assert.deepEqual(stored(db), {
      ...ROWS.released,
      first_seen_at: ENVELOPE.at,
    });
    assert.deepEqual(
      db
        .prepare('SELECT region, claim_id AS id FROM ledger_events ORDER BY id')
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

    write(db, fold(undefined, { npm: { ...NPM, deprecated: '' } }, ENVELOPE));
    assert.equal(count(db, 'claims'), 1);
    assert.equal(count(db, 'versions'), 0);
  });

  it('writes no dist-tag move for a rejected claim', () => {
    const db = migrated();

    insertVersion(db, ROWS.published);

    const tags = [moveDistTag(undefined, ROWS.published, 'next', ENVELOPE)];

    write(
      db,
      fold(ROWS.published, { npm: { ...NPM, deprecated: '' } }, ENVELOPE),
      tags,
    );
    assert.equal(count(db, 'dist_tags'), 0);
    assert.equal(count(db, 'ledger_events'), 0);
  });

  it('rejects the claim with a rejected dist-tag move and writes nothing', () => {
    const db = migrated();

    const tags = [moveDistTag(undefined, ROWS.tagged, 'next', ENVELOPE)];

    write(db, fold(undefined, OBSERVED, ENVELOPE), tags);
    assert.equal(
      db.prepare('SELECT outcome FROM claims').get()?.outcome,
      'rejected',
    );
    assert.equal(count(db, 'versions'), 0);
  });

  it('records a claim that only moves a dist-tag as applied', () => {
    const db = migrated();

    insertVersion(db, ROWS.published);

    const tags = [moveDistTag(undefined, ROWS.published, 'next', ENVELOPE)];

    write(db, fold(ROWS.published, { npm: NPM }, ENVELOPE), tags);
    assert.equal(
      db.prepare('SELECT outcome FROM claims').get()?.outcome,
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

    write(db, folded, [
      moveDistTag(LATEST, rowOf(folded), 'latest', ENVELOPE),
      removeDistTag(next, rowOf(folded), 'next', ENVELOPE),
    ]);
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

        write(db, folded);
        assert.deepEqual(
          stored(db),
          { ...folded.row },
          `${label} + ${JSON.stringify(observed)}`,
        );
      }
    }
  });

  it('stores a repair', () => {
    const row = rowOf(fold(ROWS.published, { npm: null }, ENVELOPE));

    assert.ok(row);

    const db = migrated();

    insertVersion(db, row);

    write(db, repair(row, 'npm', { npm: NPM }, ENVELOPE));
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

    assert.deepEqual({ ...replayed }, stored(db));
  });
});
