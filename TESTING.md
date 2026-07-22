# Testing strategy: vitest vs native `node:test`

Evaluation of runner consolidation for issue [#330]. The repo runs two unit-test
populations — **vitest** (browser-mode + happy-dom) in the shipped Lit packages,
and **native `node --test`** in the runtime-neutral packages and release tooling.
This documents which runner each suite uses, why, and the verdict on
consolidating.

**Verdict: keep the split.** vitest where DOM or workerd execution is the point;
native `node:test` where dependency-freedom and release-pipeline independence are.
The coverage gap that motivated this evaluation is closeable on *both* runners and
is not, on its own, a reason to converge.

## Current inventory

### vitest (5 suites)

| Suite | Environment | Coverage | Uploaded |
|---|---|---|---|
| `packages/lit-ui-router` (10 specs) | happy-dom + real browser (`ui-sref` only) | v8 | ✓ |
| `packages/lit-ui-router-mobx` (3) | happy-dom | v8 | ✓ |
| `packages/navigation-location-plugin` (2) | real browser (chromium/firefox/webkit) | v8 | ✓ |
| `apps/sample-app-shared` (2) | real browser | — | — |
| `tools/happy-dom` (1) | happy-dom conformance | — | — |

Only the three **shipped** packages emit and upload coverage; `codecov.yml`
defines components for exactly those three.

### native `node --test` (7 suites)

| Suite | Spec files | Coverage |
|---|---|---|
| `packages/ui-router-server` | 11 | — |
| `tools/release` | 16 (`src/checks/`, `src/steps/`) | — |
| `tools/shared` | 4 | — |
| `tools/workers-builds` | 1 | — |
| `tools/build_and_test` | 1 | — |
| `apps/sample-app-routes` | 1 (matcher contract) | — |
| `docs` (`docs/worker/test`) | 1 | — |

None produce coverage: no `--experimental-test-coverage` flag, no upload.

### Other

- `apps/sample-app-lit-e2e` — Cypress (4 `.cy.ts`); videos-on-failure, not coverage.
- `tools/dts-backtest` — custom d.ts backtest harness (`run.ts` over fixtures), not a unit runner.

> Note: issue #330 references "`scripts/` root tests" and per-suite *test-case*
> counts (~179 for ui-router-server, 101 for release). There is no root
> `scripts/` dir today, and the table above counts *spec files*, not individual
> `test()` cases — the case counts remain in the hundreds, but the file inventory
> is the load-bearing figure for a runner decision.

## The four evaluation axes

### 1. Coverage — closeable on **both** runners

The mechanical cause of the gap: turbo's `test:coverage` task keys on
`vitest.config.ts` and writes `coverage/**`; the `node:test` packages run under
the plain `test` task and emit nothing. codecov only ever sees the three vitest
components.

This is **not** a vitest-exclusive capability. Node ships native coverage since
Node 20 via `--experimental-test-coverage`, with an LCOV reporter
(`--test-reporter=lcov`) that produces exactly the `lcov.info` codecov already
ingests. Closing the gap on a `node:test` package is a script + turbo-output +
codecov-component change — **not** a runner conversion. This reframes #330: the
coverage question does not force consolidation.

### 2. #291 synergy — the genuine vitest-only differentiator

`@cloudflare/vitest-pool-workers` (issue [#291]) runs specs inside real
`workerd` and exposes `SELF.fetch()` integration tests. That is vitest-only and
is the one capability native `node:test` cannot match. It matters specifically
for `docs/worker` and `apps/sample-app-routes`, where "portable by construction"
would be upgraded to "executed in the target runtime." Everywhere else, workerd
execution buys nothing.

### 3. What native `node:test` defends

- **Release-pipeline independence.** `tools/release` and `tools/shared` should
  run with zero framework transform chain — the release path must not depend on
  the test framework it is releasing. Native `node:test` keeps them runnable in
  minimal contexts.
- **Dependency-free ethos.** `ui-router-server` and `apps/sample-app-routes`
  test a matcher that is runtime-neutral by design; `node:test` needs nothing,
  matching that ethos.
- **The `@vitest/browser` patch treadmill** — but this cost is **time-limited**,
  not permanent. The content-hashed patch is scheduled for retirement (PR [#424],
  gated on vitest-dev/vitest#9381), and spec-level prevention (#422/#429) already
  removes the popup risk. Do not weight it as a standing tax against widening
  vitest.

### 4. Timing

The docs-worker and release-rework stacks (large `node:test` suites) have landed,
so an inventory is now stable. Any conversion work should follow #291's spike, not
precede it.

## Verdict — a deliberate split

1. **Keep native `node:test`** for `tools/release`, `tools/shared`,
   `tools/build_and_test`, `tools/workers-builds` — release-pipeline
   independence and zero-dep ethos outrank one-runner uniformity.
2. **Move to vitest (workers pool)** where workerd execution is the point:
   `docs/worker` and `apps/sample-app-routes`, via #291. These gain
   target-runtime evidence, `SELF.fetch()` integration, *and* coverage in one
   move.
3. **`ui-router-server` is the swing case.** Close its coverage gap first with
   Node's native `--experimental-test-coverage` (cheap, preserves the dependency-
   free ethos). Revisit vitest-pool-workers only if `SELF.fetch()` integration
   tests against the mount become wanted — bundle that decision with #291.

The coverage gap — the loudest motivation for consolidating — is resolved on
either runner. So the split is not a compromise; it is the correct shape.

[#291]: https://github.com/simshanith/lit-ui-router/issues/291
[#330]: https://github.com/simshanith/lit-ui-router/issues/330
[#424]: https://github.com/simshanith/lit-ui-router/pull/424
