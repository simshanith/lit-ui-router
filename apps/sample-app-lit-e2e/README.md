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

| Suite        | Target       | Covers                                       |
| ------------ | ------------ | -------------------------------------------- |
| `vanilla`    | `/app/`      | vanilla app, `pushState` routing             |
| `mobx`       | `/app-mobx/` | MobX app, `pushState` routing                |
| `docs`       | site pages   | docs-site smoke (`cypress.docs.config.ts`)   |
| `hash`       | `/app/`      | vanilla app under the `hash` location plugin |
| `navigation` | `/app/`      | vanilla app under the Navigation API plugin  |

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

## Iterating against a dev server

```bash
# in one terminal
pnpm --filter sample-app-lit-vanilla dev

# in another (adjust port/base to the dev server)
cd apps/sample-app-lit-e2e
pnpm exec cypress run --config baseUrl=http://localhost:5173/app/
```
