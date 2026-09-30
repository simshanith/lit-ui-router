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

1. Find the run and its failing-task headline: `gh run view <run-id>`. From a
   PR, start at `gh pr checks <pr>`; from a branch with no PR, or a PR with
   conflicts, `gh run list --branch <branch>` (the `Build and Test (branch)`
   workflow).
2. Save `gh run view <run-id> --log-failed` to a file under `$CLAUDE_JOB_DIR/tmp`
   and search it for `repro:`. Never pipe it through `head` or `tail`; the
   report sits near the end of thousands of lines.
3. Check whether it's already fixed before setting anything up: a later green
   run on the same branch (`gh run list --branch <branch>`), a merged PR, or
   `git log <sha>..origin/main -- <package dir>`.
4. Check out the commit the run tested: the SHA on the log's `Uses:` line (a
   merge commit for a PR run, the branch head otherwise). Bootstrap per
   [AGENTS.md: Setup and commands](../../../AGENTS.md#setup-and-commands).
5. Reproduce before explaining. Run the `repro:` line in the foreground, then
   on `origin/main` too when the run is old. Until it fails locally, say so
   rather than theorising from the log.
6. Skip `ELIFECYCLE` lines in the raw stream; cancelled tasks print them too.
7. A failure in a package the diff doesn't touch gets a `--force` rerun before
   anyone believes it.
8. Ask before running e2e, Cypress, or a browser task. A `wrangler dev` crash is
   a known flake; suggest a rerun first.
9. If the repro passes, look for what CI has that the checkout lacks: a fresh
   checkout with no stale `dist/`, `main`'s newer commits, `CI=true`. A timeout
   can need CI's parallel load; one rerun with `CI=true` under load is enough.
   If it still passes, report a flake with that evidence rather than looping.

Report the failing task, the commit and command you ran with their result,
whether it's already fixed on `main`, and the fix or the open question.
