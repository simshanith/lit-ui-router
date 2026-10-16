# @tools/ci-logs

Writes one GitHub Actions run's turbo task logs to a single text file, for
reading a green run's output in full
([CONTRIBUTING: Reading a green run's logs](../../docs/CONTRIBUTING.md#reading-a-green-runs-logs)).

```bash
tools/ci-logs/src/ci-logs.ts <run-id> [--baseline <run-id>] [--replayed] --out <file>
```

Run it inside a checkout, or set `GH_REPO`, so `gh` knows the repository.

It downloads the run's `turbo-task-logs*` and `turbo-run-summaries*` artifacts
into a fresh temporary directory, one directory per artifact, and pairs them by
suffix: `turbo-task-logs-docs` with `turbo-run-summaries-docs`, and the
unsuffixed pair as the `run` group. The run summaries say which tasks executed
(`MISS`) and which replayed from the cache (`HIT`).

The file holds:

- a header for the run and the baseline;
- every executed task's log, ANSI codes stripped, headed `## <group> <taskId>`;
  with `--baseline`, the same task's log from the baseline run follows it,
  marked executed or replayed there, or a note when the baseline has no such
  task or lost its logs;
- the replayed tasks, by name only, with a note where the artifact lacks the
  log; with `--replayed`, each replayed task's log in full instead, headed
  `## <group> <taskId> (replayed; ...)`. `--baseline` pairs executed tasks only;
  a replay already carries the log of the run that filled the cache;
- counts of executed and replayed tasks, missing logs, and lines in and out.

A `main` run replays most of what its PR executed, so a baseline log is often a
replay; it describes the run that filled the cache. For the same reason a
`main` run can have no executed tasks at all; `--replayed` is how to read its
logs.

Task logs expire after 5 days and run summaries after 30, so a baseline has to
be a recent run. The tool exits nonzero only when the run has no run summaries
left.
