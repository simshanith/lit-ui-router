---
name: ci-failure-repro
description: Reproduce a failing GitHub Actions run locally before diagnosing it. Use when a PR or main run is red, a check fails, or someone pastes a CI log.
---

# Reproduce a CI failure locally

The recipe lives in
[docs/CONTRIBUTING.md](../../../docs/CONTRIBUTING.md#reproducing-a-ci-failure);
Codecov checks have
[their own section](../../../docs/CONTRIBUTING.md#reproducing-a-codecov-failure).
This skill adds only what an unattended run needs.

1. Find the run: `gh pr checks <pr>`, then `gh run view <run-id>` for the
   failing-task headline.
2. Save `gh run view <run-id> --log-failed` to a file under `$CLAUDE_JOB_DIR/tmp`
   and search it for `repro:`. Never pipe it through `head` or `tail`; the
   report sits near the end of thousands of lines.
3. Reproduce before explaining. Run the `repro:` line in the foreground, on the
   merge commit for a PR run. Until it fails locally, say so rather than
   theorising from the log.
4. Skip `ELIFECYCLE` lines in the raw stream; cancelled tasks print them too.
5. A failure in a package the diff doesn't touch gets a `--force` rerun before
   anyone believes it.
6. Ask before running e2e, Cypress, or a browser task. A `wrangler dev` crash is
   a known flake; suggest a rerun first.
7. If the repro passes locally, look for what CI has that the checkout lacks: a
   fresh checkout with no stale `dist/`, `main`'s newer commits, the `CI`
   variable.

Report the failing task, the command you ran and its result, and the fix or the
open question.
