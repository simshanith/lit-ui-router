// Pure logic for the release ledger: the (state, event) → state table, the fold of
// a claim's observations into a `versions` row, and the statements that write it.
// The queue consumer owns the IO: it reads the row, calls `fold`, and runs
// `foldStatements` in one D1 batch after its `pipeline_events` insert.

export const STATES = [
  'tagged',
  'published.active',
  'published.deprecated',
  'released.active',
  'released.deprecated',
  'drifted',
  'abandoned',
] as const;

export type State = (typeof STATES)[number];

export const EVENT_TYPES = [
  'tag_observed',
  'npm_observed',
  'gh_release_observed',
  'deprecation_observed',
  'undeprecation_observed',
  'mismatch_observed',
  'abandon',
  'repair',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** The `versions` columns that record what a source said. */
export const FACT_COLUMNS = [
  'git_sha',
  'npm_integrity',
  'npm_published_at',
  'npm_dist_tag',
  'npm_deprecated',
  'gh_release_id',
  'gh_url',
  'gh_prerelease',
  'gh_body',
  'gh_published_at',
] as const;

export type FactColumn = (typeof FACT_COLUMNS)[number];

/** Facts that never change once recorded; a source that disagrees is drift. */
export const IMMUTABLE_COLUMNS = [
  'git_sha',
  'npm_integrity',
  'npm_published_at',
  'gh_release_id',
  'gh_url',
  'gh_prerelease',
  'gh_published_at',
] as const satisfies readonly FactColumn[];

export type ImmutableColumn = (typeof IMMUTABLE_COLUMNS)[number];

/** Facts a source may legitimately change; they update in place. */
export const MUTABLE_COLUMNS: ReadonlySet<FactColumn> = new Set([
  'npm_deprecated',
  'gh_body',
]);

/** Facts no source can verify later: the first value recorded stays, and nothing disagrees with it. */
export const ADVISORY_COLUMNS: ReadonlySet<FactColumn> = new Set([
  'npm_dist_tag',
]);

/** One `versions` row, as D1 returns it. */
export interface VersionRow {
  name: string;
  version: string;
  state: State;
  state_at: string;
  first_seen_at: string;
  rev: number;
  git_sha: string;
  npm_integrity: string | null;
  npm_published_at: string | null;
  npm_dist_tag: string | null;
  npm_deprecated: string | null;
  gh_release_id: number | null;
  gh_url: string | null;
  gh_prerelease: number | null;
  gh_body: string | null;
  gh_published_at: string | null;
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
  event: string;
  from_state: State | null;
  to_state: State;
  payload: string;
  source: string;
  run_url: string | null;
  at: string;
}

export interface TagFacts {
  sha: string;
}

export interface NpmFacts {
  integrity: string;
  publishedAt: string;
  /** The tag `publish-npm` published under; npm does not record it, so only that claim sends it. */
  distTag?: string;
}

export interface GhReleaseFacts {
  id: number;
  url: string;
  prerelease: boolean;
  body: string;
  publishedAt: string;
}

export type Value = string | number | null;

/** An observation about one `<pkg>@<version>`. Writers report these, never states. */
export type ReleaseEvent =
  | ({ type: 'tag_observed' } & TagFacts)
  | ({ type: 'npm_observed' } & NpmFacts)
  | ({ type: 'gh_release_observed' } & GhReleaseFacts)
  | { type: 'deprecation_observed'; message: string }
  | { type: 'undeprecation_observed' }
  | {
      type: 'mismatch_observed';
      field: ImmutableColumn;
      recorded: Value;
      observed: Value;
    }
  | { type: 'abandon' }
  | {
      type: 'repair';
      tag: TagFacts;
      npm?: NpmFacts;
      ghRelease?: GhReleaseFacts;
      deprecated?: string;
    };

/** Who sent the event and when; the consumer fills it from the claim. */
export interface Envelope {
  name: string;
  version: string;
  at: string;
  source: string;
  run_url: string | null;
}

export type Outcome =
  | {
      kind: 'applied';
      row: VersionRow;
      event: LedgerEventRow;
      /** The `rev` the write compares against; `null` inserts a new row. `row.rev` is the next one. */
      expectedRev: number | null;
    }
  | { kind: 'unchanged' }
  | { kind: 'rejected'; reason: string };

/** `repair` re-derives its target from the observations it carries. */
export const DERIVED = 'derived';

/** Accepted and dropped: a drifted row keeps its recorded facts until `repair`. */
export const IGNORED = 'ignored';

type Target = State | typeof DERIVED | typeof IGNORED;

type Transitions = Partial<Record<EventType, Target>>;

/** The only event that creates a row. */
export const INITIAL = {
  tag_observed: 'tagged',
} as const satisfies Transitions;

// A self-transition is a no-op on a repeated fact, an update on a changed mutable
// fact, and a rejection on a contradicted immutable one.
export const TRANSITIONS = {
  tagged: {
    tag_observed: 'tagged',
    npm_observed: 'published.active',
    gh_release_observed: 'drifted',
    mismatch_observed: 'drifted',
    abandon: 'abandoned',
  },
  'published.active': {
    tag_observed: 'published.active',
    npm_observed: 'published.active',
    gh_release_observed: 'released.active',
    deprecation_observed: 'published.deprecated',
    undeprecation_observed: 'published.active',
    mismatch_observed: 'drifted',
  },
  'published.deprecated': {
    tag_observed: 'published.deprecated',
    npm_observed: 'published.deprecated',
    gh_release_observed: 'released.deprecated',
    deprecation_observed: 'published.deprecated',
    undeprecation_observed: 'published.active',
    mismatch_observed: 'drifted',
  },
  'released.active': {
    tag_observed: 'released.active',
    npm_observed: 'released.active',
    gh_release_observed: 'released.active',
    deprecation_observed: 'released.deprecated',
    undeprecation_observed: 'released.active',
    mismatch_observed: 'drifted',
  },
  'released.deprecated': {
    tag_observed: 'released.deprecated',
    npm_observed: 'released.deprecated',
    gh_release_observed: 'released.deprecated',
    deprecation_observed: 'released.deprecated',
    undeprecation_observed: 'released.active',
    mismatch_observed: 'drifted',
  },
  drifted: {
    tag_observed: IGNORED,
    npm_observed: IGNORED,
    gh_release_observed: IGNORED,
    deprecation_observed: IGNORED,
    undeprecation_observed: IGNORED,
    mismatch_observed: IGNORED,
    abandon: 'abandoned',
    repair: DERIVED,
  },
  abandoned: {
    tag_observed: 'abandoned',
    npm_observed: 'drifted',
    abandon: 'abandoned',
    repair: DERIVED,
  },
} as const satisfies Record<State, Transitions>;

interface Guard {
  label: string;
  holds: (row: VersionRow) => boolean;
}

/** Conditions on a table entry; the pairing is rejected when one fails. */
export const GUARDS: Partial<Record<State, Partial<Record<EventType, Guard>>>> =
  {
    // a tag deleted or moved before publish
    drifted: {
      abandon: {
        label: 'no npm facts',
        holds: (row) => row.npm_integrity === null,
      },
    },
  };

/** The table lookup; `undefined` means the pairing is rejected. */
export function next(
  state: State | undefined,
  type: EventType,
): Target | undefined {
  const transitions: Transitions =
    state === undefined ? INITIAL : TRANSITIONS[state];

  return transitions[type];
}

/** On npm, so a dist-tag can point at it. A drifted row is, if it recorded npm facts. */
export const isOnNpm = (row: Pick<VersionRow, 'state' | 'npm_integrity'>) =>
  row.state.startsWith('published.') ||
  row.state.startsWith('released.') ||
  (row.state === 'drifted' && row.npm_integrity !== null);

type FactRow = Pick<VersionRow, FactColumn>;

type Facts = Partial<FactRow>;

type Rejection = Extract<Outcome, { kind: 'rejected' }>;

type FactsResult = { kind: 'facts'; facts: Facts } | Rejection;

const reject = (reason: string): Rejection => ({ kind: 'rejected', reason });

const EMPTY_FACTS: Omit<FactRow, 'git_sha'> = {
  npm_integrity: null,
  npm_published_at: null,
  npm_dist_tag: null,
  npm_deprecated: null,
  gh_release_id: null,
  gh_url: null,
  gh_prerelease: null,
  gh_body: null,
  gh_published_at: null,
};

const npmFacts = (npm: NpmFacts): Facts => ({
  npm_integrity: npm.integrity,
  npm_published_at: npm.publishedAt,
  ...(npm.distTag !== undefined && { npm_dist_tag: npm.distTag }),
});

const ghFacts = (gh: GhReleaseFacts): Facts => ({
  gh_release_id: gh.id,
  gh_url: gh.url,
  gh_prerelease: gh.prerelease ? 1 : 0,
  gh_body: gh.body,
  gh_published_at: gh.publishedAt,
});

// npm undeprecates with an empty message
const EMPTY_DEPRECATION =
  'an empty deprecation message is undeprecation_observed';

function repairFacts(
  event: Extract<ReleaseEvent, { type: 'repair' }>,
): FactsResult {
  if (event.ghRelease !== undefined && event.npm === undefined) {
    return reject(
      'repair cannot derive a state: a GitHub release without npm is drift',
    );
  }

  if (event.deprecated !== undefined && event.npm === undefined) {
    return reject('repair cannot derive a state: a deprecation without npm');
  }

  if (event.deprecated === '') return reject(EMPTY_DEPRECATION);

  return {
    kind: 'facts',
    facts: {
      ...EMPTY_FACTS,
      git_sha: event.tag.sha,
      ...(event.npm && npmFacts(event.npm)),
      ...(event.ghRelease && ghFacts(event.ghRelease)),
      npm_deprecated: event.deprecated ?? null,
    },
  };
}

const facts = (written: Facts): FactsResult => ({
  kind: 'facts',
  facts: written,
});

/** The columns an event writes, or the reason it is malformed. */
function eventFacts(event: ReleaseEvent): FactsResult {
  switch (event.type) {
    case 'tag_observed':
      return facts({ git_sha: event.sha });
    case 'npm_observed':
      return facts(npmFacts(event));
    case 'gh_release_observed':
      return facts(ghFacts(event));
    case 'deprecation_observed':
      return event.message === ''
        ? reject(EMPTY_DEPRECATION)
        : facts({ npm_deprecated: event.message });
    case 'undeprecation_observed':
      return facts({ npm_deprecated: null });
    case 'repair':
      return repairFacts(event);
    default:
      return facts({});
  }
}

const IMMUTABLE: ReadonlySet<string> = new Set(IMMUTABLE_COLUMNS);

/** A mismatch must name an immutable fact the row records, as the row records it, and disagree. */
function mismatchRejection(
  row: VersionRow,
  event: Extract<ReleaseEvent, { type: 'mismatch_observed' }>,
): Rejection | undefined {
  const { field, recorded, observed } = event;

  if (!IMMUTABLE.has(field)) {
    return reject(`mismatch_observed names ${field}, not an immutable fact`);
  }

  if (recorded === null) {
    return reject(`mismatch_observed on ${field} has nothing recorded`);
  }

  if (row[field] !== recorded) {
    return reject(
      `mismatch_observed on ${field} is stale: the row records ${JSON.stringify(row[field])}, not ${JSON.stringify(recorded)}`,
    );
  }

  if (observed === recorded) {
    return reject(`mismatch_observed on ${field} observed the recorded value`);
  }

  return undefined;
}

function derive(written: Facts): State {
  if (written.npm_integrity == null) return 'tagged';

  const lifecycle = written.gh_release_id == null ? 'published' : 'released';

  return written.npm_deprecated == null
    ? `${lifecycle}.active`
    : `${lifecycle}.deprecated`;
}

function contradiction(row: VersionRow, written: Facts): Rejection | undefined {
  for (const column of IMMUTABLE_COLUMNS) {
    const value = written[column];
    const recorded = row[column];

    if (value === undefined || recorded === null || recorded === value) {
      continue;
    }

    return reject(
      `${column} is recorded as ${JSON.stringify(recorded)}, observed ${JSON.stringify(value)}: report mismatch_observed`,
    );
  }

  return undefined;
}

/** The first recorded dist-tag stays; `repair` sets it only alongside npm facts. */
function advisory(
  row: VersionRow | undefined,
  event: ReleaseEvent,
  written: Facts,
): Facts {
  const recorded = row?.npm_dist_tag ?? null;

  if (event.type === 'repair') {
    return written.npm_integrity === null
      ? written
      : { ...written, npm_dist_tag: event.npm?.distTag ?? recorded };
  }

  return recorded === null ? written : { ...written, npm_dist_tag: recorded };
}

const sameFacts = (a: VersionRow, b: VersionRow): boolean =>
  FACT_COLUMNS.every((column) => a[column] === b[column]);

function payloadOf(event: ReleaseEvent): string {
  const { type: _type, ...payload } = event;

  return JSON.stringify(payload);
}

function preconditions(
  row: VersionRow | undefined,
  event: ReleaseEvent,
): Rejection | undefined {
  const guard = row && GUARDS[row.state]?.[event.type];

  if (guard && !guard.holds(row)) {
    return reject(`${event.type} in ${row.state} needs ${guard.label}`);
  }

  if (row !== undefined && event.type === 'mismatch_observed') {
    return mismatchRejection(row, event);
  }

  return undefined;
}

/** The target state and written columns, or why the pairing is rejected. */
function transition(
  row: VersionRow | undefined,
  event: ReleaseEvent,
  envelope: Envelope,
):
  | { kind: 'transition'; to: State; facts: Facts }
  | { kind: 'unchanged' }
  | Rejection {
  if (
    row !== undefined &&
    (row.name !== envelope.name || row.version !== envelope.version)
  ) {
    return reject(
      `row ${row.name}@${row.version} is not ${envelope.name}@${envelope.version}`,
    );
  }

  const target = next(row?.state, event.type);

  if (target === undefined) {
    return reject(
      `${event.type} is not accepted in ${row?.state ?? 'a missing row'}`,
    );
  }

  const precondition = preconditions(row, event);

  if (precondition) return precondition;

  const result = eventFacts(event);

  if (result.kind === 'rejected') return result;

  if (target === IGNORED) return { kind: 'unchanged' };

  const written = advisory(row, event, result.facts);

  if (target === DERIVED) {
    return { kind: 'transition', to: derive(written), facts: written };
  }

  const conflict = row === undefined ? undefined : contradiction(row, written);

  return conflict ?? { kind: 'transition', to: target, facts: written };
}

/** Fold one event into the row, or reject the pairing. */
export function apply(
  row: VersionRow | undefined,
  event: ReleaseEvent,
  envelope: Envelope,
): Outcome {
  const result = transition(row, event, envelope);

  if (result.kind !== 'transition') return result;

  const { to } = result;

  // INITIAL only admits tag_observed, whose facts carry the sha
  const nextRow: VersionRow = {
    ...EMPTY_FACTS,
    git_sha: '',
    first_seen_at: envelope.at,
    ...row,
    ...result.facts,
    name: envelope.name,
    version: envelope.version,
    state: to,
    state_at: envelope.at,
    rev: row === undefined ? 0 : row.rev + 1,
  };

  if (row?.state === to && sameFacts(row, nextRow)) {
    return { kind: 'unchanged' };
  }

  return {
    kind: 'applied',
    row: nextRow,
    expectedRev: row?.rev ?? null,
    event: {
      name: envelope.name,
      version: envelope.version,
      event: event.type,
      from_state: row?.state ?? null,
      to_state: to,
      payload: payloadOf(event),
      source: envelope.source,
      run_url: envelope.run_url,
      at: envelope.at,
    },
  };
}

/** One claim's observations, folded in order. */
export interface Fold {
  /** `rejected` when an event was rejected, even if earlier ones applied. */
  outcome: 'applied' | 'unchanged' | 'rejected';
  /** The row to write, or `undefined` when no event applied. */
  row: VersionRow | undefined;
  /** The `rev` the write compares against; `null` inserts a new row. */
  expectedRev: number | null;
  /** The `ledger_events` rows, one per applied event. */
  events: LedgerEventRow[];
  /** The first rejected event; the fold stops there and the events after it are not folded. */
  rejected: { index: number; reason: string } | null;
}

/** Fold a claim's events in order, stopping at the first rejection; the applied prefix stands. */
export function fold(
  row: VersionRow | undefined,
  events: readonly ReleaseEvent[],
  envelope: Envelope,
): Fold {
  let current = row;
  let rejected: Fold['rejected'] = null;
  const applied: LedgerEventRow[] = [];

  for (const [index, event] of events.entries()) {
    const outcome = apply(current, event, envelope);

    if (outcome.kind === 'rejected') {
      rejected = { index, reason: outcome.reason };
      break;
    }

    if (outcome.kind === 'applied') {
      current = outcome.row;
      applied.push(outcome.event);
    }
  }

  const changed = applied.length > 0;

  return {
    outcome: rejected ? 'rejected' : changed ? 'applied' : 'unchanged',
    row: changed ? current : undefined,
    expectedRev: row?.rev ?? null,
    events: applied,
    rejected,
  };
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

function distTagRejection(
  current: DistTagRow | undefined,
  tag: string,
  envelope: Envelope,
): Rejection | undefined {
  if (current !== undefined && current.tag !== tag) {
    return reject(`dist-tag row ${current.tag} is not ${tag}`);
  }

  if (current !== undefined && current.name !== envelope.name) {
    return reject(`dist-tag row for ${current.name} is not ${envelope.name}`);
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
    return reject(`${envelope.name}@${envelope.version} has no ledger row`);
  }

  if (target.name !== envelope.name || target.version !== envelope.version) {
    return reject(
      `row ${target.name}@${target.version} is not ${envelope.name}@${envelope.version}`,
    );
  }

  if (!isOnNpm(target)) {
    return reject(`${target.name}@${target.version} is ${target.state}`);
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
    return reject(
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

interface DistTagPayload {
  tag: string;
  from?: string | null;
}

function distTagEvent(
  row: VersionRow,
  event: 'dist_tag_moved' | 'dist_tag_removed',
  envelope: Envelope,
  payload: DistTagPayload,
): LedgerEventRow {
  return {
    name: row.name,
    version: row.version,
    event,
    from_state: row.state,
    to_state: row.state,
    payload: JSON.stringify(payload),
    source: envelope.source,
    run_url: envelope.run_url,
    at: envelope.at,
  };
}

/** One parameterised statement for a D1 `batch()`. */
export interface Statement {
  sql: string;
  params: Value[];
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

const UPDATED_COLUMNS = VERSION_COLUMNS.filter(
  (column) =>
    column !== 'name' && column !== 'version' && column !== 'first_seen_at',
);

const LEDGER_COLUMNS = [
  'name',
  'version',
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

// A 0-row write does not fail a D1 batch, so each dependent insert checks the write landed.
function ledgerInsert(
  event: LedgerEventRow,
  messageId: string,
  guard: Statement,
): Statement {
  return {
    sql: `INSERT INTO ledger_events (${LEDGER_COLUMNS.join(', ')}, pipeline_event_id) SELECT ${placeholders(LEDGER_COLUMNS.length)}, (SELECT id FROM pipeline_events WHERE message_id = ?) WHERE ${guard.sql}`,
    params: [
      ...LEDGER_COLUMNS.map((column) => event[column]),
      messageId,
      ...guard.params,
    ],
  };
}

function versionWrite(row: VersionRow, expectedRev: number | null): Statement {
  if (expectedRev === null) {
    return {
      sql: `INSERT INTO versions (${VERSION_COLUMNS.join(', ')}) VALUES (${placeholders(VERSION_COLUMNS.length)}) ON CONFLICT (name, version) DO NOTHING`,
      params: VERSION_COLUMNS.map((column) => row[column]),
    };
  }

  return {
    sql: `UPDATE versions SET ${UPDATED_COLUMNS.map((column) => `${column} = ?`).join(', ')} WHERE name = ? AND version = ? AND rev = ?`,
    params: [
      ...UPDATED_COLUMNS.map((column) => row[column]),
      row.name,
      row.version,
      expectedRev,
    ],
  };
}

/**
 * The batch for a fold: the compare-and-set `versions` write, then one guarded
 * `ledger_events` insert per applied event. Runs after the consumer inserts the
 * claim's `pipeline_events` row with `messageId`. When the first result reports
 * 0 changes the row moved: re-read and fold again.
 */
export function foldStatements(result: Fold, messageId: string): Statement[] {
  const { row } = result;

  if (row === undefined) return [];

  const landed: Statement = {
    sql: 'EXISTS (SELECT 1 FROM versions WHERE name = ? AND version = ? AND rev = ?)',
    params: [row.name, row.version, row.rev],
  };

  return [
    versionWrite(row, result.expectedRev),
    ...result.events.map((event) => ledgerInsert(event, messageId, landed)),
  ];
}

/**
 * The batch for a dist-tag outcome, compare-and-set on the version the tag
 * pointed at. When the write reports 0 changes the tag moved: re-read and retry.
 */
export function distTagStatements(
  outcome: DistTagOutcome,
  messageId: string,
): Statement[] {
  if (outcome.kind !== 'applied') return [];

  const { row } = outcome;

  if (outcome.op === 'delete') {
    const present: Statement = {
      sql: 'EXISTS (SELECT 1 FROM dist_tags WHERE name = ? AND tag = ? AND version = ?)',
      params: [row.name, row.tag, row.version],
    };

    // the guard reads the row before the delete removes it
    return [
      ledgerInsert(outcome.event, messageId, present),
      {
        sql: 'DELETE FROM dist_tags WHERE name = ? AND tag = ? AND version = ?',
        params: [row.name, row.tag, row.version],
      },
    ];
  }

  const write: Statement =
    outcome.expectedVersion === null
      ? {
          sql: 'INSERT INTO dist_tags (name, tag, version, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (name, tag) DO NOTHING',
          params: [row.name, row.tag, row.version, row.updated_at],
        }
      : {
          sql: 'UPDATE dist_tags SET version = ?, updated_at = ? WHERE name = ? AND tag = ? AND version = ?',
          params: [
            row.version,
            row.updated_at,
            row.name,
            row.tag,
            outcome.expectedVersion,
          ],
        };

  const landed: Statement = {
    sql: 'EXISTS (SELECT 1 FROM dist_tags WHERE name = ? AND tag = ? AND version = ? AND updated_at = ?)',
    params: [row.name, row.tag, row.version, row.updated_at],
  };

  return [write, ledgerInsert(outcome.event, messageId, landed)];
}
