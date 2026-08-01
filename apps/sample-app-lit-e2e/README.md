# sample-app-lit-e2e

One Cypress spec suite, run against both sample apps and the docs site —
this is what enforces the apps' behavioral identity and keeps every
published location strategy exercised.

## The full run

```bash
pnpm --filter sample-app-lit-e2e test
```

That production-like flow builds the docs site (which embeds both apps'
builds), serves it with wrangler on `:8787`, and runs five Cypress suites
concurrently (`test:cypress:all`):

| Suite        | Target        | Covers                                                                                                              |
| ------------ | ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `vanilla`    | `/app/`       | vanilla app, `pushState` routing                                                                                    |
| `mobx`       | `/app-mobx/`  | MobX app, `pushState` routing                                                                                       |
| `docs`       | site + mounts | docs pages plus the mount matrix — flagships, hash demo, and the server-support exhibits (`cypress.docs.config.ts`) |
| `hash`       | `/app/`       | vanilla app under the `hash` location plugin                                                                        |
| `navigation` | `/app/`       | vanilla app under the Navigation API plugin                                                                         |

The same run executes in CI via the `ci` turbo task.

## Location plugin suites

The `hash` and `navigation` suites re-run the vanilla specs with a
suite-wide plugin selected via `cypress run --expose LOCATION_PLUGIN=<mode>`.
The support file seeds the app's `featureFlags` session storage in
`cy.visit`'s `onBeforeLoad` — hash routing never rewrites `location.search`,
so a `?feature-location-plugin` URL param would pin the flag as
URL-overridden for the whole session. Explicit per-spec `features` passed to
`visitWithFeatures` still go through the URL param.

To run a single mode with its own server:

```bash
pnpm --filter sample-app-lit-e2e test:hash
pnpm --filter sample-app-lit-e2e test:navigation
```

## Measuring the wrangler crash rate

The CI dev server (`wrangler dev`) has a history of mid-suite crashes on
Linux runners (cloudflare/workers-sdk#14926 — fatal non-recovery from a
workerd restart, introduced in wrangler 4.114.0 and the reason the
catalog pins 4.113.0). `scripts/measure-deflake.ts` turns "is it still
happening?" into a number:

```bash
node scripts/measure-deflake.ts 7            # crash rate over the last 7 days
node scripts/measure-deflake.ts 2 my-branch  # one branch's runs only
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
Needs an authenticated `gh`; unavailable logs are reported per attempt,
and an over-`maxBuffer` log invalidates the stats loudly.

## Iterating against a dev server

```bash
# in one terminal
pnpm --filter sample-app-lit-vanilla dev

# in another (adjust port/base to the dev server)
cd apps/sample-app-lit-e2e
pnpm exec cypress run --config baseUrl=http://localhost:5173/app/
```
