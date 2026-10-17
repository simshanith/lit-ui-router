// Pure logic for the release ledger: the (state, event) → state table and the
// fold of one observation into a `versions` row. The queue consumer owns the IO:
// it reads the row, calls `apply`, and writes the outcome in one D1 batch.

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

/** One `versions` row, as D1 returns it. */
export interface VersionRow {
  name: string;
  version: string;
  state: State;
  state_at: string;
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

/** One `ledger_events` row, less the id D1 assigns. */
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
  distTag: string;
}

export interface GhReleaseFacts {
  id: number;
  url: string;
  prerelease: boolean;
  body: string;
  publishedAt: string;
}

type Value = string | number | null;

/** An observation about one `<pkg>@<version>`. Writers report these, never states. */
export type ReleaseEvent =
  | ({ type: 'tag_observed' } & TagFacts)
  | ({ type: 'npm_observed' } & NpmFacts)
  | ({ type: 'gh_release_observed' } & GhReleaseFacts)
  | { type: 'deprecation_observed'; message: string }
  | { type: 'undeprecation_observed' }
  | {
      type: 'mismatch_observed';
      field: FactColumn;
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
  | { kind: 'applied'; row: VersionRow; event: LedgerEventRow }
  | { kind: 'unchanged' }
  | { kind: 'rejected'; reason: string };

/** `repair` re-derives its target from the observations it carries. */
export const DERIVED = 'derived';

type Target = State | typeof DERIVED;

type Transitions = Partial<Record<EventType, Target>>;

/** The only event that creates a row. */
export const INITIAL = {
  tag_observed: 'tagged',
} as const satisfies Transitions;

// A self-transition on an observation accepts it only when it repeats the recorded fact.
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
    repair: DERIVED,
  },
  abandoned: {
    tag_observed: 'abandoned',
    abandon: 'abandoned',
  },
} as const satisfies Record<State, Transitions>;

/** The table lookup; `undefined` means the pairing is rejected. */
export function next(
  state: State | undefined,
  type: EventType,
): Target | undefined {
  const transitions: Transitions =
    state === undefined ? INITIAL : TRANSITIONS[state];

  return transitions[type];
}

/** On npm, so a dist-tag can point at it. */
export const isOnNpm = (state: State): boolean =>
  state.startsWith('published.') || state.startsWith('released.');

// Observations of immutable facts; a different value is drift, never an update.
const IMMUTABLE_FACT_EVENTS: ReadonlySet<EventType> = new Set([
  'tag_observed',
  'npm_observed',
  'gh_release_observed',
]);

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
  npm_dist_tag: npm.distTag,
});

const ghFacts = (gh: GhReleaseFacts): Facts => ({
  gh_release_id: gh.id,
  gh_url: gh.url,
  gh_prerelease: gh.prerelease ? 1 : 0,
  gh_body: gh.body,
  gh_published_at: gh.publishedAt,
});

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
      // npm undeprecates with an empty message
      return event.message === ''
        ? reject('an empty deprecation message is undeprecation_observed')
        : facts({ npm_deprecated: event.message });
    case 'undeprecation_observed':
      return facts({ npm_deprecated: null });
    case 'repair':
      return repairFacts(event);
    default:
      return facts({});
  }
}

function derive(written: Facts): State {
  if (written.npm_integrity == null) return 'tagged';

  const lifecycle = written.gh_release_id == null ? 'published' : 'released';

  return written.npm_deprecated == null
    ? `${lifecycle}.active`
    : `${lifecycle}.deprecated`;
}

function contradiction(row: VersionRow, written: Facts): Rejection | undefined {
  for (const column of FACT_COLUMNS) {
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

const sameFacts = (a: VersionRow, b: VersionRow): boolean =>
  FACT_COLUMNS.every((column) => a[column] === b[column]);

function payloadOf(event: ReleaseEvent): string {
  const { type: _type, ...payload } = event;

  return JSON.stringify(payload);
}

/** The target state and written columns, or why the pairing is rejected. */
function transition(
  row: VersionRow | undefined,
  event: ReleaseEvent,
  envelope: Envelope,
): { kind: 'transition'; to: State; facts: Facts } | Rejection {
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

  const result = eventFacts(event);

  if (result.kind === 'rejected') return result;

  const conflict =
    row !== undefined && IMMUTABLE_FACT_EVENTS.has(event.type)
      ? contradiction(row, result.facts)
      : undefined;

  return (
    conflict ?? {
      kind: 'transition',
      to: target === DERIVED ? derive(result.facts) : target,
      facts: result.facts,
    }
  );
}

/** Fold one event into the row, or reject the pairing. */
export function apply(
  row: VersionRow | undefined,
  event: ReleaseEvent,
  envelope: Envelope,
): Outcome {
  const result = transition(row, event, envelope);

  if (result.kind === 'rejected') return result;

  const { to } = result;

  // INITIAL only admits tag_observed, whose facts carry the sha
  const nextRow: VersionRow = {
    ...EMPTY_FACTS,
    git_sha: '',
    ...row,
    ...result.facts,
    name: envelope.name,
    version: envelope.version,
    state: to,
    state_at: envelope.at,
  };

  if (row?.state === to && sameFacts(row, nextRow)) {
    return { kind: 'unchanged' };
  }

  return {
    kind: 'applied',
    row: nextRow,
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

export type DistTagOutcome =
  | { kind: 'applied'; row: DistTagRow; event: LedgerEventRow }
  | { kind: 'unchanged' }
  | { kind: 'rejected'; reason: string };

/** Point `tag` at `target`. The ledger event is the only history of the move. */
export function moveDistTag(
  current: DistTagRow | undefined,
  target: VersionRow | undefined,
  tag: string,
  envelope: Envelope,
): DistTagOutcome {
  if (target === undefined) {
    return reject(`${envelope.name}@${envelope.version} has no ledger row`);
  }

  if (!isOnNpm(target.state)) {
    return reject(`${target.name}@${target.version} is ${target.state}`);
  }

  if (current?.version === target.version) return { kind: 'unchanged' };

  return {
    kind: 'applied',
    row: {
      name: target.name,
      tag,
      version: target.version,
      updated_at: envelope.at,
    },
    event: {
      name: target.name,
      version: target.version,
      event: 'dist_tag_moved',
      from_state: target.state,
      to_state: target.state,
      payload: JSON.stringify({ tag, from: current?.version ?? null }),
      source: envelope.source,
      run_url: envelope.run_url,
      at: envelope.at,
    },
  };
}
