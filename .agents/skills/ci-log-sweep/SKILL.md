---
name: ci-log-sweep
description: Sweep a green GitHub Actions run's logs for warnings, deprecations and abnormal timings. Use when asked to audit a passing run, check CI for warnings, or explain a slow or odd green job.
---

# Sweep a green run's logs

The recipe lives in
[docs/CONTRIBUTING.md](../../../docs/CONTRIBUTING.md#reading-a-green-runs-logs);
a red run goes to the `ci-failure-repro` skill instead. This skill adds only
what an unattended run needs.

1. Start from `gh run view <run-id>` for the job list. The job stream holds
   errors only; passing tasks' output is in the task-log artifacts.
2. Download each artifact with `gh run download <run-id> -n <name> --dir <dir>`
   into its own new, empty directory under `$CLAUDE_JOB_DIR/tmp`. Task logs
   expire within days; say so rather than guessing when they're gone.
3. Strip ANSI codes into one file and search that file. Never pipe logs
   through `head` or `tail`, and never re-run a download to slice it
   differently.
4. Before reporting a warning, banner or timing, check the run summary's cache
   status for that task. A replayed log describes the run that filled the cache.
5. Check each finding against a recent `main` run and the expected-noise list
   in the recipe. One slow step in one run is not a trend.
6. Report findings; don't fix them unasked. A real problem gets the commit,
   task, message and whether `main` shows it too.
