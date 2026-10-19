-- One row per <pkg>@<version>; the git tag is always name@version.
-- No state is stored: each region's state is derived from its facts, as version_states reads them.
CREATE TABLE versions (
  name             TEXT NOT NULL,
  version          TEXT NOT NULL,
  first_seen_at    TEXT NOT NULL,
  git_sha          TEXT,
  -- each *_conflict holds the observation that contradicts the region's fixed facts, as JSON
  tag_conflict     TEXT,
  npm_integrity    TEXT,
  npm_published_at TEXT,
  npm_deprecated   TEXT,
  npm_conflict     TEXT,
  gh_release_id    INTEGER,
  gh_url           TEXT,
  gh_prerelease    INTEGER CHECK (gh_prerelease IN (0, 1)),
  gh_body          TEXT,
  gh_published_at  TEXT,
  gh_conflict      TEXT,
  PRIMARY KEY (name, version),
  -- each source's facts arrive together, and a conflict needs a fact to contradict
  CHECK (tag_conflict IS NULL OR git_sha IS NOT NULL),
  CHECK ((npm_integrity IS NULL) = (npm_published_at IS NULL)),
  CHECK (npm_integrity IS NOT NULL OR (npm_deprecated IS NULL AND npm_conflict IS NULL)),
  CHECK (
    (gh_release_id IS NULL) = (gh_url IS NULL)
    AND (gh_release_id IS NULL) = (gh_prerelease IS NULL)
    AND (gh_release_id IS NULL) = (gh_body IS NULL)
    AND (gh_release_id IS NULL) = (gh_published_at IS NULL)
  ),
  CHECK (gh_conflict IS NULL OR gh_release_id IS NOT NULL)
) STRICT;

-- Each region's derived state, and an overall status for readers.
CREATE VIEW version_states AS
SELECT
  name,
  version,
  CASE
    WHEN npm_integrity IS NULL THEN 'absent'
    WHEN npm_deprecated IS NULL THEN 'active'
    ELSE 'deprecated'
  END AS npm_state,
  CASE WHEN gh_release_id IS NULL THEN 'none' ELSE 'final' END AS gh_state,
  CASE
    WHEN coalesce(tag_conflict, npm_conflict, gh_conflict) IS NOT NULL THEN 'conflict'
    -- the tag precedes publish, so npm or a release without one is never clean
    WHEN git_sha IS NULL THEN 'untagged'
    WHEN npm_integrity IS NULL THEN 'tagged'
    WHEN gh_release_id IS NULL THEN 'published'
    ELSE 'released'
  END AS status
FROM versions;

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

-- Append-only: one row per region a fold changed, and every dist-tag move or removal, which counts against npm.
-- region, event and payload are the replay source: folding them in id order rebuilds versions and dist_tags.
CREATE TABLE ledger_events (
  id                INTEGER PRIMARY KEY,
  name              TEXT NOT NULL,
  version           TEXT NOT NULL,
  region            TEXT NOT NULL CHECK (region IN ('tag', 'npm', 'gh')),
  event             TEXT NOT NULL CHECK (event IN ('observed', 'repair', 'dist_tag_moved', 'dist_tag_removed')),
  -- the region's derived state; the tag has none, and a new row has no from_state
  from_state        TEXT,
  to_state          TEXT,
  payload           TEXT NOT NULL,
  source            TEXT NOT NULL,
  run_url           TEXT,
  at                TEXT NOT NULL,
  pipeline_event_id INTEGER NOT NULL REFERENCES pipeline_events (id),
  FOREIGN KEY (name, version) REFERENCES versions (name, version)
) STRICT;
