#!/usr/bin/env node
// Stamps the start of a CI session, so run-summary can tell the turbo runs of
// THIS job from whatever a local `.turbo/runs` has accumulated. `--summarize`
// takes only true|false — no path, no label — so a summary carries no job
// identity, and the runs directory is append-only: without a boundary the
// choice is "the newest run" (which hides the rest of the session) or "every
// file present" (which locally reports last week's).
//
// Written by the first step of `mise run ci` / `ci_main`, before any turbo run.
//
// Fails open, like the reporter it serves: no marker means the report falls
// back to the newest single run, which is worth strictly less than the build
// this step would otherwise redden.
//
// env: TURBO_SUMMARY_SESSION (marker path; override for tests and local
//      reproduction).

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const SESSION_FILE =
  process.env.TURBO_SUMMARY_SESSION ?? '.turbo/summary-session';

async function main(): Promise<void> {
  await mkdir(dirname(SESSION_FILE), { recursive: true });
  // Epoch ms, matching the mtimes the reporter compares it against. Rewritten
  // rather than appended: a session is the latest mark, not a history.
  await writeFile(SESSION_FILE, `${Date.now()}\n`);
}

main().catch((error: unknown) => {
  console.log(
    `could not mark the turbo summary session, the report falls back to the newest run: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
});
