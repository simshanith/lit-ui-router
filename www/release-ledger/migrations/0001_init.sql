-- One row per <pkg>@<version>; the git tag is always name@version.
CREATE TABLE versions (
  name             TEXT NOT NULL,
  version          TEXT NOT NULL,
  state            TEXT NOT NULL CHECK (state IN ('tagged', 'published.active', 'published.deprecated', 'released.active', 'released.deprecated', 'drifted', 'abandoned')),
  state_at         TEXT NOT NULL,
  git_sha          TEXT NOT NULL,
  npm_integrity    TEXT,
  npm_published_at TEXT,
  npm_dist_tag     TEXT,
  npm_deprecated   TEXT,
  gh_release_id    INTEGER,
  gh_url           TEXT,
  gh_prerelease    INTEGER,
  gh_body          TEXT,
  gh_published_at  TEXT,
  PRIMARY KEY (name, version),
  -- drifted keeps the recorded deprecation for repair to overwrite
  CHECK (state = 'drifted' OR (state LIKE '%.deprecated') = (npm_deprecated IS NOT NULL))
) STRICT;

-- npm's movable pointers: one row per tag, and moving a tag is an upsert.
CREATE TABLE dist_tags (
  name       TEXT NOT NULL,
  tag        TEXT NOT NULL,
  version    TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (name, tag),
  FOREIGN KEY (name, version) REFERENCES versions (name, version)
) STRICT;

-- Append-only: every transition and every dist-tag move.
CREATE TABLE ledger_events (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  version    TEXT NOT NULL,
  event      TEXT NOT NULL,
  from_state TEXT,
  to_state   TEXT NOT NULL,
  payload    TEXT NOT NULL,
  source     TEXT NOT NULL,
  run_url    TEXT,
  at         TEXT NOT NULL,
  FOREIGN KEY (name, version) REFERENCES versions (name, version)
) STRICT;

-- Claims as received, kept for replay; the OIDC claims are the audit fields.
CREATE TABLE pipeline_events (
  id               INTEGER PRIMARY KEY,
  received_at      TEXT NOT NULL,
  repository       TEXT NOT NULL,
  job_workflow_ref TEXT NOT NULL,
  run_id           TEXT NOT NULL,
  sha              TEXT NOT NULL,
  payload          TEXT NOT NULL
) STRICT;
