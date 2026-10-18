// Reads decode through SqlSchema; the consumer's writes are the core's
// statements, plus the claim and dead-letter rows defined here.
import { Effect, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';

import type {
  FoldStatements,
  Statement,
  VersionRow,
} from './release-ledger.core.ts';

const NullableString = Schema.NullOr(Schema.String);

const NullableNumber = Schema.NullOr(Schema.Number);

const VersionRowSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  first_seen_at: Schema.String,
  rev: Schema.Number,
  abandoned_at: NullableString,
  git_sha: NullableString,
  tag_conflict: NullableString,
  npm_integrity: NullableString,
  npm_published_at: NullableString,
  npm_dist_tag: NullableString,
  npm_deprecated: NullableString,
  npm_conflict: NullableString,
  gh_release_id: NullableNumber,
  gh_url: NullableString,
  gh_prerelease: NullableNumber,
  gh_body: NullableString,
  gh_published_at: NullableString,
  gh_conflict: NullableString,
}) satisfies Schema.Schema<VersionRow>;

/** A `versions` row with the states `version_states` derives from it. */
const LedgerVersionSchema = Schema.Struct({
  ...VersionRowSchema.fields,
  npm_state: Schema.Literals(['absent', 'active', 'deprecated']),
  gh_state: Schema.Literals(['none', 'final']),
  status: Schema.Literals([
    'conflict',
    'abandoned',
    'tagged',
    'published',
    'released',
  ]),
});

export type LedgerVersion = typeof LedgerVersionSchema.Type;

const LEDGER_VERSIONS = `SELECT versions.*, npm_state, gh_state, status
  FROM versions JOIN version_states USING (name, version)`;

const DistTagRowSchema = Schema.Struct({
  name: Schema.String,
  tag: Schema.String,
  version: Schema.String,
  updated_at: Schema.String,
});

const NameVersion = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
});

const Name = Schema.Struct({ name: Schema.String });

const NameTag = Schema.Struct({ name: Schema.String, tag: Schema.String });

const MessageId = Schema.Struct({ message_id: Schema.String });

export const findVersion = (request: typeof NameVersion.Type) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return yield* SqlSchema.findOneOption({
      Request: NameVersion,
      Result: VersionRowSchema,
      execute: ({ name, version }) =>
        sql`SELECT * FROM versions WHERE name = ${name} AND version = ${version}`,
    })(request);
  });

export const findVersions = (request: typeof Name.Type) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return yield* SqlSchema.findAll({
      Request: Name,
      Result: LedgerVersionSchema,
      execute: ({ name }) =>
        sql`${sql.literal(LEDGER_VERSIONS)} WHERE name = ${name} ORDER BY first_seen_at`,
    })(request);
  });

export const findDistTags = (request: typeof Name.Type) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return yield* SqlSchema.findAll({
      Request: Name,
      Result: DistTagRowSchema,
      execute: ({ name }) => sql`SELECT * FROM dist_tags WHERE name = ${name}`,
    })(request);
  });

/** The row a dist-tag points at. */
export const findTagged = (request: typeof NameTag.Type) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return yield* SqlSchema.findOneOption({
      Request: NameTag,
      Result: LedgerVersionSchema,
      execute: ({ name, tag }) =>
        sql`${sql.literal(LEDGER_VERSIONS)} JOIN dist_tags USING (name, version)
            WHERE name = ${name} AND tag = ${tag}`,
    })(request);
  });

export const findClaim = (request: typeof MessageId.Type) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return yield* SqlSchema.findOneOption({
      Request: MessageId,
      Result: Schema.Struct({ id: Schema.Number }),
      execute: ({ message_id }) =>
        sql`SELECT id FROM pipeline_events WHERE message_id = ${message_id}`,
    })(request);
  });

export interface PipelineEvent {
  message_id: string;
  received_at: string;
  repository: string;
  job_workflow_ref: string;
  run_id: string;
  run_attempt: number;
  sha: string;
  payload: string;
  outcome: FoldStatements['outcome'];
  reason: string | null;
}

const PIPELINE_COLUMNS = [
  'message_id',
  'received_at',
  'repository',
  'job_workflow_ref',
  'run_id',
  'run_attempt',
  'sha',
  'payload',
  'outcome',
  'reason',
] as const;

/** The claim's row, inserted only while `guard` holds; every later statement in the batch needs it. */
export function pipelineInsert(
  event: PipelineEvent,
  guard: Statement,
): Statement {
  const columns = PIPELINE_COLUMNS.join(', ');
  const values = PIPELINE_COLUMNS.map(() => '?').join(', ');

  return {
    sql: `INSERT INTO pipeline_events (${columns}) SELECT ${values} WHERE ${guard.sql}`,
    params: [
      ...PIPELINE_COLUMNS.map((column) => event[column]),
      ...guard.params,
    ],
  };
}

/** A core statement as an Effect SQL statement, for `D1Client.batch`. */
export const toSql = (sql: SqlClient.SqlClient, statement: Statement) =>
  sql.unsafe(statement.sql, statement.params);

export interface DeadLetter {
  message_id: string;
  queue: string;
  attempts: number;
  body: string;
  received_at: string;
}

export const insertDeadLetter = (
  sql: SqlClient.SqlClient,
  letter: DeadLetter,
) =>
  sql`INSERT INTO dead_letters ${sql.insert({ ...letter })}
      ON CONFLICT (message_id) DO NOTHING`;
