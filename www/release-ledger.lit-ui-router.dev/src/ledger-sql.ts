// Reads decode through SqlSchema; the consumer's writes are the statements in
// ledger-statements.ts.
import {
  GH_STATES,
  NPM_STATES,
  STATUSES,
  type VersionRow,
} from '@tools/release-ledger';
import { Effect, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';

import type { Statement } from './ledger-statements.ts';

const NullableString = Schema.NullOr(Schema.String);

const NullableNumber = Schema.NullOr(Schema.Number);

const VersionRowSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  first_seen_at: Schema.String,
  git_sha: NullableString,
  tag_conflict: NullableString,
  npm_integrity: NullableString,
  npm_published_at: NullableString,
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
  npm_state: Schema.Literals(NPM_STATES),
  gh_state: Schema.Literals(GH_STATES),
  status: Schema.Literals(STATUSES),
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

/** A package the ledger has recorded, with the version its npm `latest` dist-tag points at. */
export interface LedgerPackage {
  name: string;
  latest: LedgerVersion | null;
}

// `package` keeps the name when no `latest` row joins.
const PackageRowSchema = Schema.Union([
  Schema.Struct({ package: Schema.String, ...LedgerVersionSchema.fields }),
  Schema.Struct({ package: Schema.String, version: Schema.Null }),
]);

/** Every package with a recorded version, by name, each with its `latest` row or null. */
export const findPackages = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* SqlSchema.findAll({
    Request: Schema.Void,
    Result: PackageRowSchema,
    execute: () =>
      sql`SELECT names.name AS package, latest.*
          FROM (SELECT DISTINCT name FROM versions) AS names
          LEFT JOIN (${sql.literal(LEDGER_VERSIONS)} JOIN dist_tags USING (name, version)
            WHERE tag = 'latest') AS latest ON latest.name = names.name
          ORDER BY names.name`,
  })(undefined);

  return rows.map(({ package: name, ...latest }): LedgerPackage => ({
    name,
    latest: latest.version === null ? null : latest,
  }));
});

export const findClaim = (request: typeof MessageId.Type) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return yield* SqlSchema.findOneOption({
      Request: MessageId,
      Result: Schema.Struct({ id: Schema.Number }),
      execute: ({ message_id }) =>
        sql`SELECT id FROM claims WHERE message_id = ${message_id}`,
    })(request);
  });

/** A ledger statement as an Effect SQL statement, for `D1Client.batch`. */
export const toSql = (sql: SqlClient.SqlClient, statement: Statement) =>
  sql.unsafe(statement.sql, statement.params);
