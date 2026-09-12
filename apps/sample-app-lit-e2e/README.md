# sample-app-lit-e2e

One Cypress spec suite, run against all three sample apps and the docs site —
this is what enforces the apps' behavioral identity and keeps every
published location strategy exercised.

## The full run

```bash
mise run test_e2e
```

That production-like flow builds the docs site (which embeds every app's
build), serves it with wrangler on port 8787, and runs every Cypress suite in
parallel:

| Suite       | Target         | Covers                                                                                                              |
| ----------- | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `vanilla`   | `/app/`        | vanilla app, default routing — the Navigation API plugin                                                            |
| `mobx`      | `/app-mobx/`   | MobX app, default routing — the Navigation API plugin                                                               |
| `effect`    | `/app-effect/` | Effect app, default routing — the Navigation API plugin                                                             |
| `docs`      | site + mounts  | docs pages plus the mount matrix — flagships, hash demo, and the server-support exhibits (`cypress.docs.config.ts`) |
| `hash`      | `/app/`        | vanilla app under the `hash` location plugin                                                                        |
| `pushState` | `/app/`        | vanilla app under the `pushState` fallback                                                                          |

Each suite is its own turbo task (`test:e2e:<suite>`) with its own cache key,
so rerunning one after a flake costs that suite alone rather than the whole
set. Name the suites you want and the umbrella runs those, around the same
server, cached and summarized exactly like the full run:

```bash
mise run test_e2e hash          # one suite
mise run test_e2e hash mobx     # an arbitrary set
mise run test_e2e --help        # the suites this checkout has
```

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

That task is also what the umbrella hands to `start-server-and-test`, so the
build edge lives on the server rather than on the suites. Without mise,
`turbo run wrangler:dev --filter=@www/lit-ui-router.dev` builds and serves the
same way — `wrangler:dev` declares `dependsOn: ["build"]` — reaching the server
through a `pnpm run` hop the mise task does not have. Bare
`pnpm --filter @www/lit-ui-router.dev run wrangler:dev` skips the build and
serves whatever is already in `dist`.

The server is deliberately outside the turbo graph. No turbo lifecycle fits it:
as a `with:` sidecar it is started but never reaped, and a top-level persistent
run does tear down cleanly on a signal but knows nothing about readiness or
about stopping once something else finishes. `start-server-and-test` owns all
three — starting it, waiting on readiness, and tearing it down even on failure.
Only the server leaves the graph; the suites stay first-class cached tasks.

The same run executes in CI: `mise run ci` runs the turbo graph and then this
umbrella, so `test:e2e:*` appear in no `ci:*` turbo task.

### The port

8787 is a default, not a fixture. It lives in code —
`www/lit-ui-router.dev/dev-port.ts`, beside the server that binds it — so every
entry point resolves it the same way, mise or no mise. Setting `WWW_DEV_PORT`
overrides it, and the server, both Cypress configs, and the deflake sampler all
read the override.

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

## Location plugin suites

The `hash` and `pushState` suites re-run the vanilla specs with a
suite-wide plugin selected via `cypress run --expose LOCATION_PLUGIN=<mode>`.
The support file seeds the app's `featureFlags` session storage in
`cy.visit`'s `onBeforeLoad` — hash routing never rewrites `location.search`,
so a `?feature-location-plugin` URL param would pin the flag as
URL-overridden for the whole session. Explicit per-spec `features` passed to
`visitWithFeatures` still go through the URL param.

The `vanilla` and `mobx` suites seed nothing, so they exercise the app's own
resolution — the Navigation API, with pushState only where the browser lacks
it. That is why there is no `navigation` lane and there _is_ a `pushState`
one: every strategy that is not the default needs a lane of its own, or it
rides the default and loses coverage the moment the default moves.
`location_plugin.cy.js` asserts which plugin each lane actually booted.

To run a single mode with its own server:

```bash
mise run test_e2e hash
mise run test_e2e pushstate
```

## Measuring the wrangler crash rate

The CI dev server (`wrangler dev`) has a history of mid-suite crashes on
Linux runners (cloudflare/workers-sdk#14926 — fatal non-recovery from a
workerd restart, introduced in wrangler 4.114.0 and the reason the
catalog pins 4.113.0). `scripts/measure-deflake.ts` turns "is it still
happening?" into a number:

```bash
mise run measure_deflake                            # crash rate over the last 7 days
mise run measure_deflake --days 2 --branch my-branch  # one branch's runs only
```

The mise task (`.config/mise/tasks/measure_deflake`) carries the
repo-specific config as flags with defaults — `mise run measure_deflake
--help` prints the spec:

| Flag           | Default                    | What it moves                                         |
| -------------- | -------------------------- | ----------------------------------------------------- |
| `--days`       | `7`                        | Window size                                           |
| `--branch`     | _(all branches)_           | Restrict to one branch's runs                         |
| `--repo`       | `simshanith/lit-ui-router` | `owner/name` to scan                                  |
| `--workflow`   | `build-test.yml`           | Workflow whose runs carry the e2e task                |
| `--max-log-mb` | `512`                      | Per-attempt log buffer; an over-cap log aborts loudly |
| `--run-limit`  | `1000`                     | `gh run list` cap; a hit clips the window's old end   |
| `--port`       | `WWW_DEV_PORT`, then 8787  | e2e dev-server port the crash signature keys on       |

That spec is the only place defaults live, save the port — its default lives in
code (see [The port](#the-port)) so the script works outside mise too. The task
passes `--days` (and `--branch`, when given) as positionals and the rest as
`MEASURE_DEFLAKE_*` env vars; the script requires all but the port and exits
pointing back at `mise run measure_deflake` if any is missing. Direct exec works — the file
is `0755` with a `#!/usr/bin/env node` shebang — but you own the contract:

```bash
MEASURE_DEFLAKE_REPO=simshanith/lit-ui-router \
  MEASURE_DEFLAKE_WORKFLOW=build-test.yml \
  MEASURE_DEFLAKE_MAX_LOG_MB=512 \
  MEASURE_DEFLAKE_RUN_LIMIT=1000 \
  ./scripts/measure-deflake.ts 2 my-branch
```

The branch filter is how an upgrade gets trialed without merging anything:
push a bump branch, force real e2e executions against it
(`gh workflow run build-test.yml --ref <branch> -f force=true`, repeated —
cache-hit runs don't count), then compare its rate to main's.

It scans every attempt of the window's `build-test` runs via `gh` (crashed
runs get rerun, so latest-attempt logs undercount) and reports crashes per
e2e execution — only attempts whose e2e task shows `cache miss/bypass`
count, since turbo cache-hit replays re-print old logs verbatim. On the
pinned wrangler it should read ~0%; a sustained non-zero rate means the
crash class is back (or was never the only one), and the fallbacks are
reviving the pm2 supervisor from PR #486 or capping suite concurrency.
Needs an authenticated `gh`. Anything that makes the sample incomplete —
unavailable attempt logs, an over-`maxBuffer` log, or a window large enough
to hit the run-list cap — is reported loudly and exits non-zero, so a
printed rate is only trustworthy on a clean exit.

## Iterating against a dev server

```bash
# in one terminal
pnpm --filter sample-app-lit-vanilla dev

# in another (adjust port/base to the dev server)
cd apps/sample-app-lit-e2e
pnpm exec cypress run --config baseUrl=http://localhost:5173/app/
```
