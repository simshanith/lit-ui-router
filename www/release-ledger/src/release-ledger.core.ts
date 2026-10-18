// Pure logic for the release ledger: fold what npm and GitHub say about one
// `<pkg>@<version>` into its `versions` row, region by region, and describe the
// batch that writes it. The queue consumer owns the IO: it reads the row,
// observes the sources, calls `fold`, and runs `foldStatements` in one D1 batch.

/**
 * Each region's facts. Fixed facts never change once recorded; mutable facts
 * follow the source. A region's state is derived from its facts, never stored,
 * and `edges` are the only moves between derived states.
 */
export const REGIONS = {
  tag: { fixed: ['git_sha'], mutable: [], edges: [] },
  npm: {
    fixed: ['npm_integrity', 'npm_published_at'],
    mutable: ['npm_deprecated'],
    edges: [
      ['absent', 'active'],
      ['absent', 'deprecated'],
      ['active', 'deprecated'],
      ['deprecated', 'active'],
    ],
  },
  gh: {
    fixed: ['gh_release_id', 'gh_url', 'gh_prerelease', 'gh_published_at'],
    mutable: ['gh_body'],
    edges: [['none', 'final']],
  },
} as const;

export type Region = keyof typeof REGIONS;

export const REGION_NAMES = ['tag', 'npm', 'gh'] as const satisfies Region[];

/** npm does not record the tag a version was published under, so only the publish-npm claim sets it; the first value stays. */
export const ADVISORY_COLUMNS = ['npm_dist_tag'] as const;

export type NpmState = 'absent' | 'active' | 'deprecated';

export type GhState = 'none' | 'final';

/** One `versions` row, as D1 returns it. */
export interface VersionRow {
  name: string;
  version: string;
  first_seen_at: string;
  rev: number;
  /** A maintainer's verdict that the tag will never be published. */
  abandoned_at: string | null;
  git_sha: string | null;
  /** The observation that contradicts the region's fixed facts, as JSON; `null` when clean. */
  tag_conflict: string | null;
  npm_integrity: string | null;
  npm_published_at: string | null;
  npm_dist_tag: string | null;
  npm_deprecated: string | null;
  npm_conflict: string | null;
  gh_release_id: number | null;
  gh_url: string | null;
  gh_prerelease: number | null;
  gh_body: string | null;
  gh_published_at: string | null;
  gh_conflict: string | null;
}

/** One `dist_tags` row. */
export interface DistTagRow {
  name: string;
  tag: string;
  version: string;
  updated_at: string;
}

/** One `ledger_events` row, less the id D1 assigns and the `pipeline_event_id` the statements resolve. */
export interface LedgerEventRow {
  name: string;
  version: string;
  region: Region;
  event: LedgerEventType;
  from_state: string | null;
  to_state: string | null;
  payload: string;
  source: string;
  run_url: string | null;
  at: string;
}

export type LedgerEventType =
  | 'observed'
  | 'abandon'
  | 'repair'
  | 'dist_tag_moved'
  | 'dist_tag_removed';

export interface TagFacts {
  sha: string;
}

export interface NpmFacts {
  integrity: string;
  publishedAt: string;
  /** npm's deprecation message; absent when the version is not deprecated. */
  deprecated?: string;
  /** The tag `publish-npm` published under; npm does not record it, so only that claim sends it. */
  distTag?: string;
}

/** A published release: a token without push access sees no drafts. */
export interface GhReleaseFacts {
  id: number;
  url: string;
  prerelease: boolean;
  body: string;
  publishedAt: string;
}

/** What each source says right now: `null` when it reports the fact absent, omitted when not asked. */
export interface Observation {
  tag?: TagFacts | null;
  npm?: NpmFacts | null;
  gh?: GhReleaseFacts | null;
}

export type Value = string | number | null;

/** Who sent the observation and when; the consumer fills it from the claim. */
export interface Envelope {
  name: string;
  version: string;
  at: string;
  source: string;
  run_url: string | null;
}

/** One fold of a row: the row to write and its ledger rows, no change, or why the input is malformed. */
export type Fold =
  | {
      outcome: 'applied';
      row: VersionRow;
      /** The `rev` the write compares against; `null` inserts a new row. `row.rev` is the next one. */
      expectedRev: number | null;
      events: LedgerEventRow[];
    }
  | { outcome: 'unchanged' }
  | { outcome: 'rejected'; reason: string };

type Rejection = Extract<Fold, { outcome: 'rejected' }>;

const reject = (reason: string): Rejection => ({ outcome: 'rejected', reason });

const UNCHANGED: Fold = { outcome: 'unchanged' };

export const npmState = (row: VersionRow): NpmState =>
  row.npm_integrity === null
    ? 'absent'
    : row.npm_deprecated === null
      ? 'active'
      : 'deprecated';

export const ghState = (row: VersionRow): GhState =>
  row.gh_release_id === null ? 'none' : 'final';

/** The region's derived state; the tag has none. */
export function stateOf(row: VersionRow, region: Region): string | null {
  if (region === 'npm') return npmState(row);

  return region === 'gh' ? ghState(row) : null;
}

/** On npm, so a dist-tag can point at it. */
export const isOnNpm = (row: VersionRow): boolean => row.npm_integrity !== null;

type Columns = Partial<VersionRow>;

/** The columns an observation of each region writes. */
const COLUMNS_OF = {
  tag: ({ tag }) => (tag ? { git_sha: tag.sha } : {}),
  npm: ({ npm }) =>
    npm
      ? {
          npm_integrity: npm.integrity,
          npm_published_at: npm.publishedAt,
          npm_deprecated: npm.deprecated ?? null,
        }
      : {},
  gh: ({ gh }) =>
    gh
      ? {
          gh_release_id: gh.id,
          gh_url: gh.url,
          gh_prerelease: gh.prerelease ? 1 : 0,
          gh_body: gh.body,
          gh_published_at: gh.publishedAt,
        }
      : {},
} satisfies Record<Region, (observed: Observation) => Columns>;

const columnsOf = (region: Region, observed: Observation): Columns =>
  COLUMNS_OF[region](observed);

const recorded = (row: VersionRow, region: Region): boolean =>
  row[REGIONS[region].fixed[0]] !== null;

const conflictColumn = (region: Region) => `${region}_conflict` as const;

function pick(columns: Columns, keys: readonly (keyof VersionRow)[]): Columns {
  return Object.fromEntries(
    keys.flatMap((key) => (key in columns ? [[key, columns[key]]] : [])),
  );
}

/** The observed fixed facts, as the conflict column records them. */
const conflictOf = (region: Region, observed: Observation): string =>
  observed[region] === null
    ? 'null'
    : JSON.stringify(pick(columnsOf(region, observed), REGIONS[region].fixed));

function contradicts(
  row: VersionRow,
  region: Region,
  columns: Columns,
): boolean {
  return REGIONS[region].fixed.some(
    (column) => row[column] !== columns[column],
  );
}

/** The first recorded dist-tag stays. */
function advisory(row: VersionRow, observed: Observation): Columns {
  const distTag = observed.npm?.distTag;

  return row.npm_dist_tag === null && distTag !== undefined
    ? { npm_dist_tag: distTag }
    : {};
}

/** The columns an observation changes in one region. */
function observeRegion(
  row: VersionRow,
  region: Region,
  observed: Observation,
): Columns {
  if (observed[region] === undefined) return {};

  const columns = columnsOf(region, observed);
  const distTag = region === 'npm' ? advisory(row, observed) : {};

  if (!recorded(row, region)) {
    if (observed[region] === null) return {};

    // npm or a release proves the abandon verdict wrong
    return region === 'tag'
      ? columns
      : { ...columns, ...distTag, abandoned_at: null };
  }

  const mutable = pick(columns, REGIONS[region].mutable);

  // never back to absent: a recorded fact that disappears is a conflict too
  if (observed[region] === null || contradicts(row, region, columns)) {
    return {
      ...mutable,
      ...distTag,
      [conflictColumn(region)]: conflictOf(region, observed),
    };
  }

  return { ...mutable, ...distTag };
}

function malformed(observed: Observation): string | undefined {
  if (observed.npm?.deprecated === '') {
    return 'an empty deprecation message: npm undeprecates with one, so omit it';
  }

  if (observed.npm?.distTag === '') return 'an empty dist-tag';

  return undefined;
}

function identity(
  row: VersionRow | undefined,
  envelope: Envelope,
): Rejection | undefined {
  if (
    row !== undefined &&
    (row.name !== envelope.name || row.version !== envelope.version)
  ) {
    return reject(
      `row ${row.name}@${row.version} is not ${envelope.name}@${envelope.version}`,
    );
  }

  return undefined;
}

// rev -1 marks a row not yet stored
const blank = (envelope: Envelope): VersionRow => ({
  name: envelope.name,
  version: envelope.version,
  first_seen_at: envelope.at,
  rev: -1,
  abandoned_at: null,
  git_sha: null,
  tag_conflict: null,
  npm_integrity: null,
  npm_published_at: null,
  npm_dist_tag: null,
  npm_deprecated: null,
  npm_conflict: null,
  gh_release_id: null,
  gh_url: null,
  gh_prerelease: null,
  gh_body: null,
  gh_published_at: null,
  gh_conflict: null,
});

const changes = (row: VersionRow, columns: Columns): boolean =>
  Object.entries(columns).some(
    // SAFETY: the keys come from VersionRow columns
    ([column, value]) => row[column as keyof VersionRow] !== value,
  );

/** A region's observation, as `ledger_events.payload` replays it; `abandon` carries none. */
type Payload = Observation[Region] | null;

function ledgerEvent(
  before: VersionRow,
  after: VersionRow,
  region: Region,
  event: LedgerEventType,
  payload: Payload,
  envelope: Envelope,
): LedgerEventRow {
  return {
    name: envelope.name,
    version: envelope.version,
    region,
    event,
    from_state: before.rev < 0 ? null : stateOf(before, region),
    to_state: stateOf(after, region),
    payload: JSON.stringify(payload),
    source: envelope.source,
    run_url: envelope.run_url,
    at: envelope.at,
  };
}

/** Applies each region's columns in turn, one ledger row per region that changed. */
function write(
  row: VersionRow,
  regions: [Region, Columns, LedgerEventType, Payload][],
  envelope: Envelope,
): Fold {
  let current = row;
  const events: LedgerEventRow[] = [];

  for (const [region, columns, event, payload] of regions) {
    if (!changes(current, columns)) continue;

    const next = { ...current, ...columns };

    events.push(ledgerEvent(current, next, region, event, payload, envelope));
    current = next;
  }

  if (events.length === 0) return UNCHANGED;

  const expectedRev = row.rev < 0 ? null : row.rev;

  return {
    outcome: 'applied',
    row: { ...current, rev: expectedRev === null ? 0 : expectedRev + 1 },
    expectedRev,
    events,
  };
}

/** Fold what the sources say into the row. Only malformed input is rejected. */
export function fold(
  row: VersionRow | undefined,
  observed: Observation,
  envelope: Envelope,
): Fold {
  const rejection = identity(row, envelope);

  if (rejection) return rejection;

  const reason = malformed(observed);

  if (reason) return reject(reason);

  const current = row ?? blank(envelope);

  return write(
    current,
    REGION_NAMES.map((region) => [
      region,
      observeRegion(current, region, observed),
      'observed',
      observed[region],
    ]),
    envelope,
  );
}

/** A maintainer's verdict: the tag will never be published. Only while npm is absent and there is no release. */
export function abandon(row: VersionRow | undefined, envelope: Envelope): Fold {
  const rejection = identity(row, envelope);

  if (rejection) return rejection;

  if (row === undefined) return reject('abandon needs a row');

  if (row.npm_integrity !== null || row.gh_release_id !== null) {
    return reject(
      `abandon needs npm absent and no release; npm is ${npmState(row)}, gh is ${ghState(row)}`,
    );
  }

  return write(
    row,
    [
      [
        'tag',
        { abandoned_at: row.abandoned_at ?? envelope.at },
        'abandon',
        null,
      ],
    ],
    envelope,
  );
}

/** Adopt the current observation as the region's facts and clear its conflict. Never back to absent. */
export function repair(
  row: VersionRow | undefined,
  region: Region,
  observed: Observation,
  envelope: Envelope,
): Fold {
  const rejection = identity(row, envelope);

  if (rejection) return rejection;

  if (row?.[conflictColumn(region)] == null) {
    return reject(`repair needs a conflict on ${region}`);
  }

  if (observed[region] === undefined) {
    return reject(`repair needs the current ${region} observation`);
  }

  if (observed[region] === null) {
    return reject(`repair cannot erase recorded ${region} facts`);
  }

  const reason = malformed(observed);

  if (reason) return reject(reason);

  const columns: Columns = {
    ...columnsOf(region, observed),
    ...(region === 'npm' &&
      observed.npm?.distTag !== undefined && {
        npm_dist_tag: observed.npm.distTag,
      }),
    [conflictColumn(region)]: null,
  };

  return write(row, [[region, columns, 'repair', observed[region]]], envelope);
}

export type DistTagOutcome =
  | {
      kind: 'applied';
      op: 'upsert';
      row: DistTagRow;
      /** The version the tag must still point at; `null` inserts it. */
      expectedVersion: string | null;
      event: LedgerEventRow;
    }
  | {
      kind: 'applied';
      op: 'delete';
      /** The row to delete, as read. */
      row: DistTagRow;
      event: LedgerEventRow;
    }
  | { kind: 'unchanged' }
  | { kind: 'rejected'; reason: string };

const rejectTag = (reason: string): DistTagOutcome => ({
  kind: 'rejected',
  reason,
});

function distTagRejection(
  current: DistTagRow | undefined,
  tag: string,
  envelope: Envelope,
): DistTagOutcome | undefined {
  if (current !== undefined && current.tag !== tag) {
    return rejectTag(`dist-tag row ${current.tag} is not ${tag}`);
  }

  if (current !== undefined && current.name !== envelope.name) {
    return rejectTag(
      `dist-tag row for ${current.name} is not ${envelope.name}`,
    );
  }

  return undefined;
}

/** Point `tag` at `target`. The ledger event is the only history of the move. */
export function moveDistTag(
  current: DistTagRow | undefined,
  target: VersionRow | undefined,
  tag: string,
  envelope: Envelope,
): DistTagOutcome {
  const rejection = distTagRejection(current, tag, envelope);

  if (rejection) return rejection;

  if (target === undefined) {
    return rejectTag(`${envelope.name}@${envelope.version} has no ledger row`);
  }

  if (target.name !== envelope.name || target.version !== envelope.version) {
    return rejectTag(
      `row ${target.name}@${target.version} is not ${envelope.name}@${envelope.version}`,
    );
  }

  if (!isOnNpm(target)) {
    return rejectTag(`${target.name}@${target.version} is not on npm`);
  }

  if (current?.version === target.version) return { kind: 'unchanged' };

  return {
    kind: 'applied',
    op: 'upsert',
    row: {
      name: target.name,
      tag,
      version: target.version,
      updated_at: envelope.at,
    },
    expectedVersion: current?.version ?? null,
    event: distTagEvent(target, 'dist_tag_moved', envelope, {
      tag,
      from: current?.version ?? null,
    }),
  };
}

/** Delete `tag`, logging the removal against the version it pointed at. */
export function removeDistTag(
  current: DistTagRow | undefined,
  pointed: VersionRow | undefined,
  tag: string,
  envelope: Envelope,
): DistTagOutcome {
  const rejection = distTagRejection(current, tag, envelope);

  if (rejection) return rejection;

  if (current === undefined) return { kind: 'unchanged' };

  if (pointed?.name !== current.name || pointed.version !== current.version) {
    return rejectTag(
      `${current.name}@${current.version}, which ${tag} points at, has no ledger row`,
    );
  }

  return {
    kind: 'applied',
    op: 'delete',
    row: current,
    event: distTagEvent(pointed, 'dist_tag_removed', envelope, { tag }),
  };
}

function distTagEvent(
  row: VersionRow,
  event: 'dist_tag_moved' | 'dist_tag_removed',
  envelope: Envelope,
  payload: { tag: string; from?: string | null },
): LedgerEventRow {
  const state = npmState(row);

  return {
    name: row.name,
    version: row.version,
    region: 'npm',
    event,
    from_state: state,
    to_state: state,
    payload: JSON.stringify(payload),
    source: envelope.source,
    run_url: envelope.run_url,
    at: envelope.at,
  };
}

/** One parameterised statement for a D1 `batch()`, or a condition to guard one with. */
export interface Statement {
  sql: string;
  params: Value[];
}

export const FACT_COLUMNS = [
  'abandoned_at',
  'git_sha',
  'tag_conflict',
  'npm_integrity',
  'npm_published_at',
  'npm_dist_tag',
  'npm_deprecated',
  'npm_conflict',
  'gh_release_id',
  'gh_url',
  'gh_prerelease',
  'gh_body',
  'gh_published_at',
  'gh_conflict',
] as const satisfies readonly (keyof VersionRow)[];

const VERSION_COLUMNS = [
  'name',
  'version',
  'first_seen_at',
  'rev',
  ...FACT_COLUMNS,
] as const;

const UPDATED_COLUMNS = ['rev', ...FACT_COLUMNS] as const;

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

const and = (conditions: Statement[]): Statement =>
  conditions.length === 0
    ? { sql: '1', params: [] }
    : {
        sql: conditions.map((condition) => `(${condition.sql})`).join(' AND '),
        params: conditions.flatMap((condition) => condition.params),
      };

const claimed = (messageId: string): Statement => ({
  sql: 'EXISTS (SELECT 1 FROM pipeline_events WHERE message_id = ?)',
  params: [messageId],
});

function versionAsRead(row: VersionRow, expectedRev: number | null): Statement {
  return expectedRev === null
    ? {
        sql: 'NOT EXISTS (SELECT 1 FROM versions WHERE name = ? AND version = ?)',
        params: [row.name, row.version],
      }
    : {
        sql: 'EXISTS (SELECT 1 FROM versions WHERE name = ? AND version = ? AND rev = ?)',
        params: [row.name, row.version, expectedRev],
      };
}

function versionWrite(
  row: VersionRow,
  expectedRev: number | null,
  claim: Statement,
): Statement {
  if (expectedRev === null) {
    return {
      sql: `INSERT INTO versions (${VERSION_COLUMNS.join(', ')}) SELECT ${placeholders(VERSION_COLUMNS.length)} WHERE ${claim.sql}`,
      params: [
        ...VERSION_COLUMNS.map((column) => row[column]),
        ...claim.params,
      ],
    };
  }

  return {
    sql: `UPDATE versions SET ${UPDATED_COLUMNS.map((column) => `${column} = ?`).join(', ')} WHERE name = ? AND version = ? AND rev = ? AND ${claim.sql}`,
    params: [
      ...UPDATED_COLUMNS.map((column) => row[column]),
      row.name,
      row.version,
      expectedRev,
      ...claim.params,
    ],
  };
}

type AppliedTag = Extract<DistTagOutcome, { kind: 'applied' }>;

function distTagAsRead(outcome: AppliedTag): Statement {
  const { row } = outcome;

  const expected =
    outcome.op === 'delete' ? row.version : outcome.expectedVersion;

  return expected === null
    ? {
        sql: 'NOT EXISTS (SELECT 1 FROM dist_tags WHERE name = ? AND tag = ?)',
        params: [row.name, row.tag],
      }
    : {
        sql: 'EXISTS (SELECT 1 FROM dist_tags WHERE name = ? AND tag = ? AND version = ?)',
        params: [row.name, row.tag, expected],
      };
}

function distTagWrite(outcome: AppliedTag, claim: Statement): Statement {
  const { row } = outcome;

  if (outcome.op === 'delete') {
    return {
      sql: `DELETE FROM dist_tags WHERE name = ? AND tag = ? AND version = ? AND ${claim.sql}`,
      params: [row.name, row.tag, row.version, ...claim.params],
    };
  }

  if (outcome.expectedVersion === null) {
    return {
      sql: `INSERT INTO dist_tags (name, tag, version, updated_at) SELECT ?, ?, ?, ? WHERE ${claim.sql}`,
      params: [row.name, row.tag, row.version, row.updated_at, ...claim.params],
    };
  }

  return {
    sql: `UPDATE dist_tags SET version = ?, updated_at = ? WHERE name = ? AND tag = ? AND version = ? AND ${claim.sql}`,
    params: [
      row.version,
      row.updated_at,
      row.name,
      row.tag,
      outcome.expectedVersion,
      ...claim.params,
    ],
  };
}

// a missing claim row joins to nothing, so the event is not logged
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
  /**
   * Holds while every row the batch writes is as the fold read it. The
   * consumer's `pipeline_events` insert runs first, guarded on it; every later
   * statement runs only when that insert landed. No claim row after the batch
   * means a row moved and nothing was written: re-read and fold again.
   */
  guard: Statement;
  /** The `versions` compare-and-set, if the row changed. */
  write: Statement | undefined;
  distTags: Statement[];
  ledger: Statement[];
}

/**
 * The batch for a claim: `[claim insert guarded on guard, write, ...distTags,
 * ...ledger]`. The consumer skips a message `pipeline_events` already holds
 * before folding it.
 */
export function foldStatements(
  folded: Fold,
  tags: readonly DistTagOutcome[],
  messageId: string,
): FoldStatements {
  const claim = claimed(messageId);
  const moved = tags.filter((outcome) => outcome.kind === 'applied');
  const applied = folded.outcome === 'applied' ? folded : undefined;

  return {
    outcome:
      folded.outcome === 'rejected'
        ? 'rejected'
        : applied || moved.length > 0
          ? 'applied'
          : 'unchanged',
    guard: and([
      ...(applied ? [versionAsRead(applied.row, applied.expectedRev)] : []),
      ...moved.map(distTagAsRead),
    ]),
    write: applied && versionWrite(applied.row, applied.expectedRev, claim),
    distTags: moved.map((outcome) => distTagWrite(outcome, claim)),
    ledger: [
      ...(applied?.events ?? []),
      ...moved.map((outcome) => outcome.event),
    ].map((event) => ledgerInsert(event, messageId)),
  };
}
