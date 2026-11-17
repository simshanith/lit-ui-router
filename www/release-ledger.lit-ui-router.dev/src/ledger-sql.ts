// Reads decode through SqlSchema; the consumer's writes are the statements in
// ledger-statements.ts.
import {
  DistTagRowSchema,
  type LedgerSnapshot,
  type LedgerVersion,
  LedgerVersionSchema,
  VersionRowSchema,
} from '@tools/release-ledger';
import { Effect, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';

import type { Statement } from './ledger-statements.ts';

const LEDGER_VERSIONS = `SELECT versions.*, npm_state, gh_state, status
  FROM versions JOIN version_states USING (name, version)`;

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

const PublishRunSchema = Schema.Struct({
  repository: Schema.String,
  job_workflow_ref: Schema.String,
  run_id: Schema.String,
  run_attempt: Schema.Number,
});

/** The Actions run whose claim a version's publish posted. */
export type PublishRun = typeof PublishRunSchema.Type;

/** A version's earliest run claim; only the publish job's last step posts one. */
export const findPublishRun = (request: typeof NameVersion.Type) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return yield* SqlSchema.findOneOption({
      Request: NameVersion,
      Result: PublishRunSchema,
      execute: ({ name, version }) =>
        sql`SELECT repository, job_workflow_ref, run_id, run_attempt FROM claims
            WHERE name = ${name} AND version = ${version} AND origin = 'run'
            ORDER BY id LIMIT 1`,
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

/** The most `recent` reads at once; a larger or malformed limit reads this many, or one. */
export const RECENT_MAX = 100;

const Limit = Schema.Struct({ limit: Schema.Number });

/**
 * The newest stable versions npm has published, across packages, newest first by npm publish time.
 * Stable only: a version with a prerelease identifier, a canary among them, is left out.
 */
export const findRecent = (request: typeof Limit.Type) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return yield* SqlSchema.findAll({
      Request: Limit,
      Result: LedgerVersionSchema,
      execute: ({ limit }) =>
        sql`${sql.literal(LEDGER_VERSIONS)}
            WHERE npm_published_at IS NOT NULL AND version NOT LIKE '%-%'
            ORDER BY npm_published_at DESC, name, version
            LIMIT ${Math.min(Math.max(Math.trunc(limit) || 1, 1), RECENT_MAX)}`,
    })(request);
  });

/** Every version with its derived states and every dist-tag, as the reconcile check reads them. */
export const findLedger = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const versions = yield* SqlSchema.findAll({
    Request: Schema.Void,
    Result: LedgerVersionSchema,
    execute: () =>
      sql`${sql.literal(LEDGER_VERSIONS)} ORDER BY name, first_seen_at`,
  })(undefined);

  const distTags = yield* SqlSchema.findAll({
    Request: Schema.Void,
    Result: DistTagRowSchema,
    execute: () => sql`SELECT * FROM dist_tags ORDER BY name, tag`,
  })(undefined);

  return { versions, distTags } satisfies LedgerSnapshot;
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
