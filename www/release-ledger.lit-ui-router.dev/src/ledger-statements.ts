// The D1 statements that write a fold's outcome, batched after the consumer's claim insert.
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
  'source',
  'run_url',
  'at',
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

// the claim insert runs first in the batch, so the join finds its id
function ledgerInsert(event: LedgerEventRow, messageId: string): Statement {
  return {
    sql: `INSERT INTO ledger_events (${LEDGER_COLUMNS.join(', ')}, pipeline_event_id) SELECT ${placeholders(LEDGER_COLUMNS.length)}, id FROM pipeline_events WHERE message_id = ?`,
    params: [...LEDGER_COLUMNS.map((column) => event[column]), messageId],
  };
}

/** The statements for one claim, in batch order after the consumer's claim insert. */
export interface FoldStatements {
  /** `pipeline_events.outcome`: `applied` when the row or a dist-tag moves. */
  outcome: 'applied' | 'unchanged' | 'rejected';
  /** `pipeline_events.reason`: set exactly when rejected. */
  reason: string | null;
  /** The `versions` insert or update, if the row changed. */
  write: Statement | undefined;
  distTags: Statement[];
  ledger: Statement[];
}

/**
 * The batch for a claim: `[claim insert, write, ...distTags, ...ledger]`. The
 * consumer skips a message `pipeline_events` already holds before folding it.
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
