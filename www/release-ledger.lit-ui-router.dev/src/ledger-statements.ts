// The D1 statements that write a claim's row and its fold's outcome.
import {
  type DistTagOutcome,
  FACT_COLUMNS,
  type Fold,
  type LedgerEventRow,
  type VersionRow,
} from '@tools/release-ledger';

type Value = string | number | null;

/** One parameterised statement for a D1 `batch()`. */
export interface Statement {
  sql: string;
  params: Value[];
}

/** How a claim's message ended; the `claims.outcome` CHECK lists the same. */
export const CLAIM_OUTCOMES = [
  'applied',
  'unchanged',
  'rejected',
  'undecodable',
  'exhausted',
] as const;

export type ClaimOutcome = (typeof CLAIM_OUTCOMES)[number];

/** Who asked for a claim; the `claims.origin` CHECK lists the same. */
export const CLAIM_ORIGINS = ['run', 'sweep', 'manual'] as const;

export type ClaimOrigin = (typeof CLAIM_ORIGINS)[number];

/** One `claims` row, less the id D1 assigns. */
export interface ClaimRow {
  message_id: string;
  received_at: string;
  body: string;
  outcome: ClaimOutcome;
  reason: string | null;
  attempts: number;
  name: string | null;
  version: string | null;
  origin: ClaimOrigin | null;
  repository: string | null;
  job_workflow_ref: string | null;
  run_id: string | null;
  run_attempt: number | null;
  sha: string | null;
  actor: string | null;
}

const CLAIM_COLUMNS = [
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
  'actor',
] as const satisfies readonly (keyof ClaimRow)[];

const VERSION_COLUMNS = [
  'name',
  'version',
  'first_seen_at',
  ...FACT_COLUMNS,
] as const;

const LEDGER_COLUMNS = [
  'name',
  'version',
  'region',
  'event',
  'from_state',
  'to_state',
  'payload',
] as const;

const placeholders = (count: number): string =>
  Array.from({ length: count }, () => '?').join(', ');

function versionWrite(row: VersionRow, isNew: boolean): Statement {
  if (isNew) {
    return {
      sql: `INSERT INTO versions (${VERSION_COLUMNS.join(', ')}) VALUES (${placeholders(VERSION_COLUMNS.length)})`,
      params: VERSION_COLUMNS.map((column) => row[column]),
    };
  }

  return {
    sql: `UPDATE versions SET ${FACT_COLUMNS.map((column) => `${column} = ?`).join(', ')} WHERE name = ? AND version = ?`,
    params: [
      ...FACT_COLUMNS.map((column) => row[column]),
      row.name,
      row.version,
    ],
  };
}

type AppliedTag = Extract<DistTagOutcome, { kind: 'applied' }>;

function distTagWrite({ op, row }: AppliedTag): Statement {
  if (op === 'delete') {
    return {
      sql: 'DELETE FROM dist_tags WHERE name = ? AND tag = ?',
      params: [row.name, row.tag],
    };
  }

  return {
    sql: 'INSERT INTO dist_tags (name, tag, version, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (name, tag) DO UPDATE SET version = excluded.version, updated_at = excluded.updated_at',
    params: [row.name, row.tag, row.version, row.updated_at],
  };
}

/**
 * The claim's row. A fold's insert runs first in its batch, so the ledger
 * events find its id; a buried message's insert keeps any row already there.
 */
export function claimInsert(
  row: ClaimRow,
  onConflict: 'fail' | 'keep' = 'fail',
): Statement {
  const keep =
    onConflict === 'keep' ? ' ON CONFLICT (message_id) DO NOTHING' : '';

  return {
    sql: `INSERT INTO claims (${CLAIM_COLUMNS.join(', ')}) VALUES (${placeholders(CLAIM_COLUMNS.length)})${keep}`,
    params: CLAIM_COLUMNS.map((column) => row[column]),
  };
}

function ledgerInsert(event: LedgerEventRow, messageId: string): Statement {
  return {
    sql: `INSERT INTO ledger_events (claim_id, ${LEDGER_COLUMNS.join(', ')}) SELECT id, ${placeholders(LEDGER_COLUMNS.length)} FROM claims WHERE message_id = ?`,
    params: [...LEDGER_COLUMNS.map((column) => event[column]), messageId],
  };
}

/** The statements for one claim, in batch order after the consumer's claim insert. */
export interface FoldStatements {
  /** `claims.outcome`: `applied` when the row or a dist-tag moves. */
  outcome: Extract<ClaimOutcome, 'applied' | 'unchanged' | 'rejected'>;
  /** `claims.reason`: set exactly when rejected. */
  reason: string | null;
  /** The `versions` insert or update, if the row changed. */
  write: Statement | undefined;
  distTags: Statement[];
  ledger: Statement[];
}

/**
 * The batch for a claim: `[claim insert, write, ...distTags, ...ledger]`. The
 * consumer skips a message `claims` already holds before folding it.
 * Any rejection, the fold's or a dist-tag's, rejects the whole claim.
 */
export function foldStatements(
  folded: Fold,
  tags: readonly DistTagOutcome[],
  messageId: string,
): FoldStatements {
  const rejection = [folded, ...tags].find(
    (outcome) => 'reason' in outcome,
  )?.reason;

  if (rejection !== undefined) {
    return {
      outcome: 'rejected',
      reason: rejection,
      write: undefined,
      distTags: [],
      ledger: [],
    };
  }

  const moved = tags.filter((outcome) => outcome.kind === 'applied');
  const applied = folded.outcome === 'applied' ? folded : undefined;

  return {
    outcome: applied || moved.length > 0 ? 'applied' : 'unchanged',
    reason: null,
    write: applied && versionWrite(applied.row, applied.isNew),
    distTags: moved.map(distTagWrite),
    ledger: [
      ...(applied?.events ?? []),
      ...moved.map((outcome) => outcome.event),
    ].map((event) => ledgerInsert(event, messageId)),
  };
}
