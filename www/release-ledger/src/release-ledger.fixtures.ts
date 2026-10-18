// Shared test fixtures: consistent rows, and observations that repeat their facts.
import type {
  Envelope,
  GhReleaseFacts,
  NpmFacts,
  Observation,
  VersionRow,
} from './release-ledger.core.ts';

export const SHA = '0123456789abcdef0123456789abcdef01234567';

export const OTHER_SHA = 'f'.repeat(40);

export const DIST_TAG = 'latest';

export const NPM: NpmFacts = {
  integrity: 'sha512-AAAA',
  publishedAt: '2026-10-01T00:00:00.000Z',
  distTag: DIST_TAG,
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
  first_seen_at: '2026-10-01T00:00:00.000Z',
  rev: 0,
  abandoned_at: null,
  git_sha: SHA,
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
};

const published: VersionRow = {
  ...tagged,
  rev: 1,
  npm_integrity: NPM.integrity,
  npm_published_at: NPM.publishedAt,
  npm_dist_tag: DIST_TAG,
};

const ghColumns = {
  gh_release_id: GH.id,
  gh_url: GH.url,
  gh_prerelease: 0,
  gh_body: GH.body,
  gh_published_at: GH.publishedAt,
};

export const ROWS = {
  tagged,
  published,
  deprecated: { ...published, npm_deprecated: DEPRECATION },
  released: { ...published, ...ghColumns, rev: 2 },
  /** A release seen before npm: valid, and reconcile's lag rule reports it. */
  releasedFirst: { ...tagged, ...ghColumns, rev: 1 },
  abandoned: { ...tagged, abandoned_at: '2026-10-01T12:00:00.000Z', rev: 1 },
} satisfies Record<string, VersionRow>;

/** Everything the sources say about `ROWS.released`. */
export const OBSERVED: Required<Observation> = {
  tag: { sha: SHA },
  npm: NPM,
  gh: GH,
};

/** What each source says about `ROWS.tagged`. */
export const UNPUBLISHED: Required<Observation> = {
  tag: { sha: SHA },
  npm: null,
  gh: null,
};
