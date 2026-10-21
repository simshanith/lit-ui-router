// Pure logic for the release ledger: fold what npm and GitHub say about one
// `<pkg>@<version>` into its `versions` row, region by region. The queue
// consumer owns the IO: it reads the row, observes the sources and calls `fold`.

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

export const NPM_STATES = ['absent', 'active', 'deprecated'] as const;

export type NpmState = (typeof NPM_STATES)[number];

export const GH_STATES = ['none', 'final'] as const;

export type GhState = (typeof GH_STATES)[number];

/** `version_states.status`, in the view's order of precedence. */
export const STATUSES = [
  'conflict',
  'untagged',
  'tagged',
  'published',
  'released',
] as const;

export type Status = (typeof STATUSES)[number];

/** One `versions` row, as D1 returns it. */
export interface VersionRow {
  name: string;
  version: string;
  first_seen_at: string;
  git_sha: string | null;
  /** The observation that contradicts the region's fixed facts, as JSON; `null` when clean. */
  tag_conflict: string | null;
  npm_integrity: string | null;
  npm_published_at: string | null;
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

/** One `ledger_events` row, less the id D1 assigns and the `claim_id` the statements resolve. */
export interface LedgerEventRow {
  name: string;
  version: string;
  region: Region;
  event: LedgerEventType;
  from_state: string | null;
  to_state: string | null;
  payload: string;
}

export type LedgerEventType =
  | 'observed'
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

/** The version observed and when; the consumer fills it from the claim. */
export interface Envelope {
  name: string;
  version: string;
  at: string;
}

/** One fold of a row: the row to write and its ledger rows, no change, or why the input is malformed. */
export type Fold =
  | {
      outcome: 'applied';
      row: VersionRow;
      /** No row was stored: the write inserts one. */
      isNew: boolean;
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

/** The overall status, as `version_states` derives it; the tag precedes publish, so a row without one is never clean. */
export function statusOf(row: VersionRow): Status {
  if ((row.tag_conflict ?? row.npm_conflict ?? row.gh_conflict) !== null) {
    return 'conflict';
  }

  if (row.git_sha === null) return 'untagged';

  if (row.npm_integrity === null) return 'tagged';

  return row.gh_release_id === null ? 'published' : 'released';
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

/** The columns an observation changes in one region. */
function observeRegion(
  row: VersionRow,
  region: Region,
  observed: Observation,
): Columns {
  if (observed[region] === undefined) return {};

  const columns = columnsOf(region, observed);

  if (!recorded(row, region)) {
    if (observed[region] === null) return {};

    return columns;
  }

  const mutable = pick(columns, REGIONS[region].mutable);

  // never back to absent: a recorded fact that disappears is a conflict too
  if (observed[region] === null || contradicts(row, region, columns)) {
    return {
      ...mutable,
      [conflictColumn(region)]: conflictOf(region, observed),
    };
  }

  return mutable;
}

function malformed(observed: Observation): string | undefined {
  if (observed.npm?.deprecated === '') {
    return 'an empty deprecation message: npm undeprecates with one, so omit it';
  }

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

const blank = (envelope: Envelope): VersionRow => ({
  name: envelope.name,
  version: envelope.version,
  first_seen_at: envelope.at,
  git_sha: null,
  tag_conflict: null,
  npm_integrity: null,
  npm_published_at: null,
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

/** A region's observation, as `ledger_events.payload` replays it. */
type Payload = Observation[Region] | null;

function ledgerEvent(
  before: VersionRow,
  isNew: boolean,
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
    from_state: isNew ? null : stateOf(before, region),
    to_state: stateOf(after, region),
    payload: JSON.stringify(payload),
  };
}

/** Applies each region's columns in turn, one ledger row per region that changed. */
function write(
  row: VersionRow,
  isNew: boolean,
  regions: [Region, Columns, LedgerEventType, Payload][],
  envelope: Envelope,
): Fold {
  let current = row;
  const events: LedgerEventRow[] = [];

  for (const [region, columns, event, payload] of regions) {
    if (!changes(current, columns)) continue;

    const next = { ...current, ...columns };

    events.push(
      ledgerEvent(current, isNew, next, region, event, payload, envelope),
    );
    current = next;
  }

  if (events.length === 0) return UNCHANGED;

  return { outcome: 'applied', row: current, isNew, events };
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
    row === undefined,
    REGION_NAMES.map((region) => [
      region,
      observeRegion(current, region, observed),
      'observed',
      observed[region],
    ]),
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
    [conflictColumn(region)]: null,
  };

  return write(
    row,
    false,
    [[region, columns, 'repair', observed[region]]],
    envelope,
  );
}

export type DistTagOutcome =
  | {
      kind: 'applied';
      op: 'upsert';
      row: DistTagRow;
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
    event: distTagEvent(target, 'dist_tag_moved', {
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
    event: distTagEvent(pointed, 'dist_tag_removed', { tag }),
  };
}

function distTagEvent(
  row: VersionRow,
  event: 'dist_tag_moved' | 'dist_tag_removed',
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
  };
}

export const FACT_COLUMNS = [
  'git_sha',
  'tag_conflict',
  'npm_integrity',
  'npm_published_at',
  'npm_deprecated',
  'npm_conflict',
  'gh_release_id',
  'gh_url',
  'gh_prerelease',
  'gh_body',
  'gh_published_at',
  'gh_conflict',
] as const satisfies readonly (keyof VersionRow)[];
