---
name: ci-log-sweep
description: Sweep a green GitHub Actions run's logs for warnings, deprecations and abnormal timings. Use when asked to audit a passing run, look for anything weird in CI, check CI for warnings, or explain a slow or odd green job.
---

# Sweep a green run's logs

The recipe lives in
[docs/CONTRIBUTING.md](../../../docs/CONTRIBUTING.md#reading-a-green-runs-logs);
a red run goes to the `ci-failure-repro` skill instead. This skill adds only
what an unattended run needs.

1. Start from `gh run view <run-id>` for the job list. The job stream holds
   errors only; passing tasks' output is in the task-log artifacts.
2. Download each artifact with `gh run download <run-id> -n <name> --dir <dir>`
   into its own new, empty scratch directory outside the checkout. Task logs
   expire within days; say so rather than guessing when they're gone.
3. List executed tasks from the run summary's cache status. A replayed log
   describes the run that filled the cache.
4. Read every executed task's log in full, beside the same task's log from a
   recent green `main` run. "Anything weird" means this step; a keyword search
   misses output that doesn't name itself.
5. Use the recipe's `grep -r` as a first pass, not the sweep. rg skips the
   hidden `.turbo/` directories unless given `--hidden`. Read the logs with
   their ANSI codes in place. Never pipe logs through `head` or `tail`, and never
   re-run a download to slice it differently.
6. Check each finding against the `main` run and the expected-noise list in the
   recipe. One slow step in one run is not a trend.
7. Report findings; don't fix them unasked. A real problem gets the commit,
   task, message and whether `main` shows it too.
