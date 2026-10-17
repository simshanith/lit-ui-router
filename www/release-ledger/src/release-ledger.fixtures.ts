// Shared test fixtures: one consistent row per state, and events that repeat its facts.
import type {
  Envelope,
  GhReleaseFacts,
  NpmFacts,
  ReleaseEvent,
  State,
  VersionRow,
} from './release-ledger.core.ts';

export const SHA = '0123456789abcdef0123456789abcdef01234567';

export const NPM: NpmFacts = {
  integrity: 'sha512-AAAA',
  publishedAt: '2026-10-01T00:00:00.000Z',
  distTag: 'latest',
};

export const GH: GhReleaseFacts = {
  id: 42,
  url: 'https://github.com/simshanith/lit-ui-router/releases/tag/lit-ui-router%401.0.0',
  prerelease: false,
  body: 'notes',
  publishedAt: '2026-10-01T00:01:00.000Z',
};

export const DEPRECATION = 'use 2.0';

export const ENVELOPE: Envelope = {
  name: 'lit-ui-router',
  version: '1.0.0',
  at: '2026-10-02T00:00:00.000Z',
  source: 'test',
  run_url: null,
};

const tagged: VersionRow = {
  name: ENVELOPE.name,
  version: ENVELOPE.version,
  state: 'tagged',
  state_at: '2026-10-01T00:00:00.000Z',
  git_sha: SHA,
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

const published: VersionRow = {
  ...tagged,
  state: 'published.active',
  npm_integrity: NPM.integrity,
  npm_published_at: NPM.publishedAt,
  npm_dist_tag: NPM.distTag,
};

const released: VersionRow = {
  ...published,
  state: 'released.active',
  gh_release_id: GH.id,
  gh_url: GH.url,
  gh_prerelease: 0,
  gh_body: GH.body,
  gh_published_at: GH.publishedAt,
};

export const ROWS: Record<State, VersionRow> = {
  tagged,
  'published.active': published,
  'published.deprecated': {
    ...published,
    state: 'published.deprecated',
    npm_deprecated: DEPRECATION,
  },
  'released.active': released,
  'released.deprecated': {
    ...released,
    state: 'released.deprecated',
    npm_deprecated: DEPRECATION,
  },
  drifted: { ...released, state: 'drifted' },
  abandoned: { ...tagged, state: 'abandoned' },
};

/** One event of each type, carrying the facts the fixture rows record. */
export const EVENTS = {
  tag_observed: { type: 'tag_observed', sha: SHA },
  npm_observed: { type: 'npm_observed', ...NPM },
  gh_release_observed: { type: 'gh_release_observed', ...GH },
  deprecation_observed: { type: 'deprecation_observed', message: DEPRECATION },
  undeprecation_observed: { type: 'undeprecation_observed' },
  mismatch_observed: {
    type: 'mismatch_observed',
    field: 'npm_integrity',
    recorded: NPM.integrity,
    observed: 'sha512-BBBB',
  },
  abandon: { type: 'abandon' },
  repair: { type: 'repair', tag: { sha: SHA }, npm: NPM, ghRelease: GH },
} satisfies {
  [Type in ReleaseEvent['type']]: Extract<ReleaseEvent, { type: Type }>;
};
