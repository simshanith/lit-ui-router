# sample-app-lit-e2e

One Playwright Test suite and an axe pass, run against all four sample apps and the docs site —
this is what enforces the apps' behavioral identity and keeps every
published location strategy exercised.

## The full run

```bash
mise run test_e2e
```

That production-like flow builds the docs site (which embeds every app's
build), serves it with wrangler on port 8787, and runs the Playwright suites in
parallel. `a11y` runs only when named; on CI it is the `acceptance (a11y)` job (`.github/workflows/acceptance.yml`):

| Suite       | Target          | Covers                                                                                                                                     |
| ----------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `vanilla`   | `/app/`         | vanilla app, default routing — the Navigation API plugin                                                                                   |
| `mobx`      | `/app-mobx/`    | MobX app, default routing — the Navigation API plugin                                                                                      |
| `effect`    | `/app-effect/`  | Effect app, default routing — the Navigation API plugin                                                                                    |
| `signals`   | `/app-signals/` | Signals app, default routing — the Navigation API plugin                                                                                   |
| `docs`      | site + mounts   | docs pages plus the mount matrix — flagships, hash demo, and the server-support exhibits                                                   |
| `hash`      | `/app-hash/`    | vanilla app under the `hash` location plugin                                                                                               |
| `a11y`      | site + mounts   | axe-core (`@tools/a11y`) over the docs pages (one API reference page per kind) in light and dark, and a walk through each sample-app mount |
| `pushstate` | `/app/`         | vanilla app under the `pushState` fallback                                                                                                 |

Every suite but `a11y` is a project in `playwright.config.ts`, and each suite is its own turbo task (`test:e2e:<suite>`). The Playwright suites have their own cache keys,
so rerunning one after a flake costs that suite alone rather than the whole
set. `a11y` is uncached, because contrast and target size are measured on the host's rendering; a scan that finds violations saves a full-page screenshot to `a11y-screenshots/`. Name the suites you want and the umbrella runs those, around the same
server, cached and summarized exactly like the full run:

```bash
mise run test_e2e hash          # one suite
mise run test_e2e hash mobx     # an arbitrary set
mise run test_e2e --help        # the suites this checkout has
```

Suites that run together split Playwright's default worker pool, half the
cores, between them: `scripts/run-e2e.ts` sets `E2E_WORKERS` unless it is
already set. Without the split, a full local run starts a pool per suite and
its page loads time out.

The suite list is derived from this package's `test:e2e:*` scripts by
`scripts/run-e2e.ts`, so a new suite is one `package.json` entry plus its
`turbo.json` task — nothing to add to `.config/mise/config.toml`, and no way
to forget an entry there and drop a suite from the PR gate.

`turbo run test:e2e:hash` still works directly when a server is already up on
the dev-server port; the umbrella is what gets you one. To bring one up by
hand:

```bash
mise run //www/lit-ui-router.dev:serve   # builds the site first, then serves it
mise run build_www   # just the build
```

The umbrella builds through the same `build_www` and then hands
`start-server-and-test` the www launcher, `www/lit-ui-router.dev/scripts/wrangler-dev.ts`,
by path — not the serve task, so the build runs once per `mise run test_e2e`. Nor the `pnpm`
form below: `start-server-and-test` stops the server with SIGINT, and a
`pnpm --filter` run reports that as a failed recursive run. Without mise,
`turbo run wrangler:dev --filter=@www/lit-ui-router.dev` builds and serves the
same way — `wrangler:dev` declares `dependsOn: ["build"]` — reaching the server
through a `pnpm run` hop the mise task does not have. Bare
`pnpm --filter @www/lit-ui-router.dev run wrangler:dev` skips the build and
serves whatever is already in `dist`.

The umbrella serves the worker's production build, the one that deploys:
`scripts/run-e2e.ts` sets `WWW_WORKER_BUILD=production` unless it is already
set, and the launcher reads it.

The server is deliberately outside the turbo graph. No turbo lifecycle fits it:
as a `with:` sidecar it is started but never reaped, and a top-level persistent
run does tear down cleanly on a signal but knows nothing about readiness or
about stopping once something else finishes. `start-server-and-test` owns all
three — starting it, waiting on readiness, and tearing it down even on failure.
Only the server leaves the graph; the suites stay first-class cached tasks.

`mise run ci` runs the turbo graph and then this umbrella, so `test:e2e:*`
appear in no `ci:*` turbo task. CI runs one `mise run test_e2e <suites>` job per
group of default suites, in parallel with the graph. The
[`build-test-run.yml`](../../.github/workflows/build-test-run.yml) `plan` job
builds that matrix from `scripts/suites.ts` (`mise run e2e_plan`), so a new
suite joins CI with no workflow edit.

### The port

8787 is a default, not a fixture. It lives in code —
`www/lit-ui-router.dev/dev-port.ts`, beside the server that binds it — so every
entry point resolves it the same way, mise or no mise. Setting `WWW_DEV_PORT`
overrides it, and the server, the Playwright config, the axe suite, and the
deflake sampler all read the override.

That matters because the port is contended: a second checkout running the suite
on 8787 tests the _first_ one's build, silently. To move a worktree off the
shared port, give it a gitignored `.config/mise/config.local.toml`:

```toml
[env]
WWW_DEV_PORT = "8801"
```

`config_root` resolves per worktree, so the file binds only that checkout — the
same shape `turbo.local.env` and `cloudflare.local.env` already use. A plain
`export WWW_DEV_PORT=8801` works identically for a one-off run.

The checked-in `.config/mise/config.toml` deliberately does **not** declare
`WWW_DEV_PORT`. It evaluates before `config.local.toml`, so a default there
would already be in the environment when the local file rendered, and the local
override would silently defer to it.

### Failure output

Playwright Test keeps a screenshot and a trace of each failing test in
`test-results/<suite>/`; a passing test keeps nothing. The trace records the DOM,
console and network of every step: open it with
`pnpm --dir apps/sample-app-lit-e2e exec playwright show-trace <trace.zip>`.
On CI a failed job uploads `test-results/` as the `playwright-traces-<group>`
artifact, and the job's run summary links it.

## Against a served origin

`E2E_BASE_URL` points the suites at a site that is already served, such as a
deployed preview, instead of the local dev server. `--base-url` on the umbrella
sets it:

```bash
mise run test_e2e --base-url https://lit-ui-router.dev hash
```

With it set, the umbrella starts no server and waits on nothing; the suites run
straight against that origin. The value is a bare `http(s)` origin, with or
without a trailing slash, because the site links its mounts by absolute path.
Anything else fails before a suite starts. `scripts/base-url.ts` resolves it for
every consumer: the Playwright config, the axe suite, and the readiness URLs of
a local run.

The site still builds locally: the suites' build edge reaches it, and the axe
suite enumerates the docs pages from its `dist`, so a local build that has
drifted from the deployed one audits the wrong page list.

The Playwright suites hash `E2E_BASE_URL` (`turbo.json`), so a run against one
origin never replays a cache entry from another, or from the local server. Two
runs against the same origin at the same commit do share one, even when the
deployment behind it changed; `TURBO_FORCE=1` re-runs them.

## Location plugin suites

The `hash` and `pushstate` suites re-run the vanilla specs with a suite-wide
plugin: the `locationPlugin` option of their projects in `playwright.config.ts`.
The `page` fixture in `src/playwright/app/fixtures.ts` seeds the app's
`featureFlags` session storage through `addInitScript` — hash routing never
rewrites `location.search`, so a `?feature-location-plugin` URL param would pin
the flag as URL-overridden for the whole session. Explicit per-spec `features`
passed to `visit` still go through the URL param.

The `vanilla` and `mobx` suites seed nothing, so they exercise the app's own
resolution — the Navigation API, with pushState only where the browser lacks
it. That is why there is no `navigation` lane and there _is_ a `pushState`
one: every strategy that is not the default needs a lane of its own, or it
rides the default and loses coverage the moment the default moves.
`location_plugin.spec.ts` asserts which plugin each lane actually booted.

To run a single mode with its own server:

```bash
mise run test_e2e hash
mise run test_e2e pushstate
```

## The wrangler dev server, and its crash history

`wrangler dev` serves the docs worker on :8787 for every suite. It has a history
of mid-suite fatal crashes on Linux runners (cloudflare/workers-sdk#14926 —
`wrangler dev` exits instead of recovering when Miniflare auto-restarts
workerd). The class arrived in wrangler 4.114.0, ran at ~40% of attempts on
4.118.0, and forced an exact catalog pin to 4.113.0.

wrangler 4.129.1 ships workers-sdk#15252, which replays a transiently-failed
GET/HEAD request instead of fatal-exiting the dev server. That is a mitigation,
not the missing `unsafeHandleRuntimeRestart` hook — but page-load traffic is
exactly the retryable class, and the sampler measured 20 clean attempts out of
20 against it. The catalog now carries a caret range and wrangler rides routine
dependency bumps like any other package.

### `Broken pipe` in the logs is expected

Passing runs carry one or two of these apiece:

```text
✘ [ERROR] kj::getCaughtExceptionAsKj() = kj/async-io-unix.c++:186: disconnected: ::write(...): Broken pipe
```

That is workerd reporting that the _client_ hung up before a response finished.
The 404 and back-navigation specs abort in-flight requests by design, and seven
suites share one worker. Nothing crashes and nothing recovers; it reads as an
ERROR only because workerd's own stderr is not gagged by `WRANGLER_LOG`. Do not
triage on this string — measured over eight consecutive green runs it appeared
in seven of them.

The signals that do mean the crash class is back:

| Signal                         | Healthy value |
| ------------------------------ | ------------- |
| `ECONNREFUSED 127.0.0.1:8787`  | absent        |
| empty `✘ [ERROR]` line         | absent        |
| `wrangler dev` starts, per run | exactly 1     |

### Sampling the crash rate

`deflake-e2e.yml` runs the suites N times serially, outside turbo, sweeping
workerd between attempts, and reports each attempt plus any near miss (a pass
that still logged the crash signature). It is informational, never required.

Two ways in:

- Apply the `deflake` label to a PR. The run removes the label when it
  finishes, so re-applying it is the re-run gesture.
- `workflow_dispatch` against any ref, with a `runs` count of 1–10.

Reach for it when a wrangler bump looks suspicious or the crash signature
reappears — not on every bump. A bad release runs this class at ~40% per
attempt, so a handful of attempts is enough to see it, and a single green
`build_and_test` run is not evidence of a fix.

## Iterating against a dev server

Start one app's dev server (default ports and base paths are in
[apps/README.md](../README.md#local-development); `--port` overrides):

```bash
pnpm --filter sample-app-lit-vanilla dev
```

Then run one spec against it, pointing the suite at the dev server's port with
`WWW_DEV_PORT`. Each project resolves its mount under that origin, so the same
form serves every app; pick the project whose mount the dev server serves:

```bash
WWW_DEV_PORT=5173 pnpm --dir apps/sample-app-lit-e2e test:e2e:vanilla src/playwright/app/dialog.spec.ts
WWW_DEV_PORT=5175 pnpm --dir apps/sample-app-lit-e2e test:e2e:effect src/playwright/app/dialog.spec.ts
```

`pnpm --dir apps/sample-app-lit-e2e e2e` opens Playwright's UI mode instead. The
specs in `src/playwright/app/` are the reference for each flow (login, dialogs,
location plugins); read the one nearest your change.

Load the app once before the first spec. A cold vite server transforms the
whole module graph on the first hit, and the transition that is still running
can leave the visualizer `<svg>` covering a click target — `sample_app.spec.ts`
("prompts to save a message being composed") is the usual casualty. A rerun
against the warm server passes.

To verify `prefers-color-scheme` behavior, use `browser.newContext({ colorScheme })` for load time and
`page.emulateMedia({ colorScheme })` for live flips. Playwright contexts emulate `light`
by default and pin the scheme inside iframes too, so pass `colorScheme: null`
when the OS setting or propagation into an embed is what's under test.
