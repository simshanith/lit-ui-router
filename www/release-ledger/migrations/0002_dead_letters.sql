-- Claims whose retries ran out; the dead-letter queue would expire them.
CREATE TABLE dead_letters (
  id          INTEGER PRIMARY KEY,
  message_id  TEXT NOT NULL UNIQUE,
  queue       TEXT NOT NULL,
  attempts    INTEGER NOT NULL,
  body        TEXT NOT NULL,
  received_at TEXT NOT NULL
) STRICT;
