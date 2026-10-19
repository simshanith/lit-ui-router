-- SQLite can't alter a CHECK, so claims is rebuilt with its ids to admit 'manual' and its actor.
-- Refilling a table named claims re-parents ledger_events before the deferred check; a rename leaves it failing.
PRAGMA defer_foreign_keys = true;

CREATE TABLE claims_0001 AS SELECT * FROM claims;

DROP TABLE claims;

CREATE TABLE claims (
  id               INTEGER PRIMARY KEY,
  message_id       TEXT NOT NULL UNIQUE,
  received_at      TEXT NOT NULL,
  body             TEXT NOT NULL,
  outcome          TEXT NOT NULL CHECK (outcome IN ('applied', 'unchanged', 'rejected', 'undecodable', 'exhausted')),
  reason           TEXT,
  attempts         INTEGER NOT NULL,
  name             TEXT,
  version          TEXT,
  origin           TEXT CHECK (origin IN ('run', 'sweep', 'manual')),
  repository       TEXT,
  job_workflow_ref TEXT,
  run_id           TEXT,
  run_attempt      INTEGER,
  sha              TEXT,
  -- who enqueued a manual claim, as they named themselves
  actor            TEXT,
  CHECK ((outcome = 'undecodable') = (name IS NULL)),
  CHECK ((name IS NULL) = (version IS NULL) AND (name IS NULL) = (origin IS NULL)),
  CHECK ((name IS NULL) = (repository IS NULL) AND (name IS NULL) = (sha IS NULL)),
  -- IS, not =, so an undecodable row's NULL origin counts as neither a run nor manual
  CHECK (
    (origin IS 'run') = (job_workflow_ref IS NOT NULL)
    AND (origin IS 'run') = (run_id IS NOT NULL)
    AND (origin IS 'run') = (run_attempt IS NOT NULL)
  ),
  CHECK ((origin IS 'manual') = (actor IS NOT NULL)),
  CHECK ((outcome = 'rejected') = (reason IS NOT NULL))
) STRICT;

INSERT INTO claims (
  id, message_id, received_at, body, outcome, reason, attempts, name, version, origin,
  repository, job_workflow_ref, run_id, run_attempt, sha
)
SELECT
  id, message_id, received_at, body, outcome, reason, attempts, name, version, origin,
  repository, job_workflow_ref, run_id, run_attempt, sha
FROM claims_0001;

DROP TABLE claims_0001;

CREATE INDEX claims_by_version ON claims (name, version, id);
