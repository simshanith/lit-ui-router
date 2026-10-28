---
name: ci-log-sweep
description: Sweep a green GitHub Actions run's logs for warnings, deprecations and abnormal timings. Use when asked to audit a passing run, look for anything weird in CI, check CI for warnings, or explain a slow or odd green job.
---

# Sweep a green run's logs

The recipe lives in
[docs/CONTRIBUTING.md](../../../docs/CONTRIBUTING.md#reading-a-green-runs-logs)
and the tool in [tools/ci-logs](../../../tools/ci-logs/README.md); a red run goes
to the `ci-failure-repro` skill instead. This skill adds only what an unattended
run needs.

1. Run `tools/ci-logs` on the run, with `--baseline` a recent green `main` run
   of the same workflow and `--out` a scratch file outside the checkout. Task
   logs expire within days; say so rather than guessing when they're gone.
   A `main` run reporting 0 executed needs `--replayed`; read the `REPLAYED`
   sections then.
2. Read every `EXECUTED` section in full against its baseline. "Anything weird"
   means this step; a keyword search over the file is only a first pass, since
   it misses output that doesn't name itself.
3. A `task logs missing` count above zero is a finding: name the tasks and the
   artifact that lacks them.
4. Check each finding against the baseline and the expected-noise list in the
   recipe. One slow step in one run is not a trend.
5. Report findings; don't fix them unasked. A real problem gets the commit,
   task, message and whether `main` shows it too.
