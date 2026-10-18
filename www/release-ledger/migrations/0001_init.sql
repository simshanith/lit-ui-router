-- One row per <pkg>@<version>; the git tag is always name@version.
CREATE TABLE versions (
  name             TEXT NOT NULL,
  version          TEXT NOT NULL,
  state            TEXT NOT NULL CHECK (state IN ('tagged', 'published.active', 'published.deprecated', 'released.active', 'released.deprecated', 'drifted', 'abandoned')),
  state_at         TEXT NOT NULL,
  first_seen_at    TEXT NOT NULL,
  -- bumped by every write; updates compare and set on it
  rev              INTEGER NOT NULL DEFAULT 0,
  git_sha          TEXT NOT NULL,
  npm_integrity    TEXT,
  npm_published_at TEXT,
  -- advisory: npm does not record it, so only the publish-npm claim sets it
  npm_dist_tag     TEXT,
  npm_deprecated   TEXT,
  gh_release_id    INTEGER,
  gh_url           TEXT,
  gh_prerelease    INTEGER CHECK (gh_prerelease IN (0, 1)),
  gh_body          TEXT,
  gh_published_at  TEXT,
  PRIMARY KEY (name, version),
  -- each source's facts arrive together
  CHECK ((npm_integrity IS NULL) = (npm_published_at IS NULL)),
  CHECK (npm_dist_tag IS NULL OR npm_integrity IS NOT NULL),
  CHECK (
    (gh_release_id IS NULL) = (gh_url IS NULL)
    AND (gh_release_id IS NULL) = (gh_prerelease IS NULL)
    AND (gh_release_id IS NULL) = (gh_body IS NULL)
    AND (gh_release_id IS NULL) = (gh_published_at IS NULL)
  ),
  -- the state follows the facts, as derive() reads them; drifted keeps whatever it recorded for repair to overwrite
  CHECK (state IN ('drifted', 'abandoned') OR (state = 'tagged') = (npm_integrity IS NULL)),
  CHECK (state IN ('drifted', 'abandoned') OR (state LIKE 'released.%') = (gh_release_id IS NOT NULL)),
  CHECK (state = 'drifted' OR (state LIKE '%.deprecated') = (npm_deprecated IS NOT NULL)),
  CHECK (state <> 'abandoned' OR npm_integrity IS NULL)
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

-- Claims as received, one per queue message, with how the fold ended; the OIDC claims are the audit fields.
CREATE TABLE pipeline_events (
  id               INTEGER PRIMARY KEY,
  message_id       TEXT NOT NULL UNIQUE,
  received_at      TEXT NOT NULL,
  repository       TEXT NOT NULL,
  job_workflow_ref TEXT NOT NULL,
  run_id           TEXT NOT NULL,
  run_attempt      INTEGER NOT NULL,
  sha              TEXT NOT NULL,
  payload          TEXT NOT NULL,
  outcome          TEXT NOT NULL CHECK (outcome IN ('applied', 'unchanged', 'rejected')),
  reason           TEXT,
  CHECK ((outcome = 'rejected') = (reason IS NOT NULL))
) STRICT;

-- Append-only: every transition, in-place update and dist-tag move or removal.
-- event plus payload is the replay source: folding them in id order rebuilds versions and dist_tags.
CREATE TABLE ledger_events (
  id                INTEGER PRIMARY KEY,
  name              TEXT NOT NULL,
  version           TEXT NOT NULL,
  event             TEXT NOT NULL,
  from_state        TEXT,
  to_state          TEXT NOT NULL,
  payload           TEXT NOT NULL,
  source            TEXT NOT NULL,
  run_url           TEXT,
  at                TEXT NOT NULL,
  pipeline_event_id INTEGER NOT NULL REFERENCES pipeline_events (id),
  FOREIGN KEY (name, version) REFERENCES versions (name, version)
) STRICT;
