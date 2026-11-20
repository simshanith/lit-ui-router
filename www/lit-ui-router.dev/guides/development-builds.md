---
title: Development and Production Builds
description: How lit-ui-router ships a separate development build, what warnings it carries, and why production bundles never contain them
type: guide
topic: builds
---

# Development and Production Builds

The packages in the table below each publish two builds of the same code.
Your bundler picks one automatically through the `development` export
condition: a dev server or a development build resolves
`dist/development/index.js`, a production build resolves `dist/index.js`.
There is nothing to install, configure, or opt into. Server runtimes that run
without a bundler choose differently; see [Server runtimes](#server-runtimes).

The two builds behave identically except for one thing: the development build
carries console warnings that the production build does not. Those warnings are
not merely disabled in production — `import.meta.env.DEV` is substituted with a
literal at emit time, so the guarded bodies fold out of `dist/*.js` entirely,
message strings included. A production bundle cannot be made to print them.

## Which packages ship it

| Package                                | Two builds | Why                                                  |
| -------------------------------------- | ---------- | ---------------------------------------------------- |
| `lit-ui-router`                        | yes        | five development warnings                            |
| `lit-ui-router-effect`                 | yes        | one development warning                              |
| `lit-ui-router-mobx`                   | yes        | one development warning                              |
| `lit-ui-router-signals`                | yes        | one development warning                              |
| `lit-ui-router-ssr`                    | yes        | twelve development warnings; also gated under `node` |
| `ui-router-server`                     | yes        | four development warnings; also gated under `node`   |
| `ui-router-effect`                     | no         | no runtime warnings to fold out                      |
| `ui-router-mobx`                       | no         | no runtime warnings to fold out                      |
| `ui-router-signals`                    | no         | no runtime warnings to fold out                      |
| `ui-router-navigation-location-plugin` | no         | no runtime warnings to fold out                      |
| `ui-router-registry`                   | no         | types only — emits no JavaScript                     |
| `ui-router-devtools`                   | no         | no runtime warnings to fold out                      |
| `eslint-plugin-lit-ui-router`          | no         | a lint plugin — it never runs in your app bundle     |

The split exists where there is something to strip. A package with a single
build is not missing a feature.

Every entry point of `lit-ui-router` is covered, not just the root: `pure`,
`register`, `ui-router.register`, `ui-view.register`, and `context` each carry
their own `development` condition.

## The second gate: lit's own build

Every warning in `lit-ui-router`, `lit-ui-router-effect`, `lit-ui-router-mobx`
and `lit-ui-router-signals` is gated twice. Past `import.meta.env.DEV`, it also checks
that lit itself resolved to its development build, by probing for
`ReactiveElement.enableWarning` — a method lit declares optional precisely
because it exists only in development.

So a development build of these packages paired with a production lit stays
silent. That pairing is unusual, but it is what a consumer gets when their
bundler resolves the two packages under different conditions, and a warning
that fires there would be noise rather than signal.

`lit-ui-router-ssr` skips this gate: a prerender script run with plain `node`
resolves lit's production build, so its warnings would never fire.

## The warnings

### `lit-ui-router`

| Warning                                           | Fires when                                                                                              | Fix                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `uiSref` wrote an inert `href`                    | `assignHref: true` (the default) writes `href` to an element with no `href` in HTML                     | Pass `assignHref: 'auto'` to scope it to real links — see [Design System Links](./design-system-links) |
| `uiSrefActive` took over an `aria-current`        | the directive finds an `aria-current` it did not set, and will remove it when the state goes inactive   | Pass `ariaCurrentValue: false` to keep the attribute yours                                             |
| no `<ui-router>` ancestor                         | a `<ui-view>`, `uiSref`, or `uiSrefActive` finds no router after its seek has actually run              | Wrap the subtree in `<ui-router>`, or pass a router explicitly                                         |
| `<ui-router>` given a different `uiRouter`        | `uiRouter` is replaced on `<ui-router>` after its first update, leaving existing views on the old one   | Set `uiRouter` before the element first updates, or replace the `<ui-router>` element                  |
| view component class does not extend `LitElement` | a routed component class fails `instanceof LitElement`, usually because two copies of `lit` are bundled | Deduplicate `lit` so the app and `lit-ui-router` share one copy                                        |

The missing-router warning fires once per element across all three sites, not
once per binding: a single missing provider trips `uiSref`'s render and its
click on the same element, and a wall of near-identical messages obscures the
one fix.

### `lit-ui-router-mobx`, `lit-ui-router-effect`, and `lit-ui-router-signals`

| Warning                   | Fires when                                                                                         | Fix                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| no `<ui-router>` ancestor | a `RouterReactionController`, `RouterRefController`, or `RouterSignalController` finds no provider | Wrap the subtree in `<ui-router>`, pass `options.router`, or call `setRouter()` on `RouterRefController` / `RouterSignalController` |

This warning has a consequence the message does not state: the controller then
observes nothing. `.value` stays at `options.initialValue` for the life of the
host, and the host is never asked to update — so the symptom is a component
that renders once with its initial value and never again.

### `ui-router-server`

| Warning                                                | Fires when                                                                                                                       | Fix                                                                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `createServerRouter`: mount answers bare base with 404 | `createServerRouter` compiles a mount other than `/` whose bare base (`/app`) resolves to `notFound` or an `otherwise` shell-404 | Add a `url: ''` route, or a redirect rule matching the empty subpath such as `/^\/?$/`                            |
| `prerender`: unclaimed path                            | a path in `paths` matches no route and its mount declares no `otherwise` projection                                              | Remove the path, add a matching route, or configure `otherwise` on the mount                                      |
| `prerender`: mount rejects trailing slash              | the first prerendered `<subpath>/index.html` page's trailing-slash spelling does not resolve to the same shell                   | Pass `config: { strict: false }` on the mount and call `router.urlService.config.strictMode(false)` on the client |
| `seed`: transported resolve could not be rebuilt       | `seed()` finds a dehydrated resolve using a transporter it was not given, or whose `decode` throws                               | Pass the matching `transport` to `seed()` / `bootstrap()`, or fix its `decode`                                    |

The mount diagnostic is a development-only warning, but the check is not.
[`diagnoseMounts(router)`](/reference/ui-router-server/index/functions/diagnoseMounts)
returns the same findings as data in every build, so asserting it is empty in
a test catches the problem in CI, whichever build the test resolves. See
[Server-Side Routing](./server-route-matching).

A mount that answers its bare base with a 404 on purpose lists the kind in its
[`ignoreDiagnostics`](/reference/ui-router-server/index/interfaces/MountConfig#ignorediagnostics),
which turns it off for that mount in the warning and in `diagnoseMounts` alike.

### `lit-ui-router-ssr`

`lit-ui-router-ssr` carries twelve development warnings across its server and
client entries: two during prerendering (`<ui-view>` missing from
`customElements`; a shadow-DOM `LitElement` rendered empty without a shadow
renderer) and ten during client hydration and adoption (release-line skew,
missing `lit-part` markers, render mismatches, views waking without an adopter
or still asleep under `defer-hydration`, and booting into a different state or
adopting zero drawn views). See
[`lit-ui-router-ssr` — Development and production builds](/packages/lit-ui-router-ssr#development-and-production-builds).

## Server runtimes

Server runtimes pick a build by their own export conditions.
`lit-ui-router-ssr` and `ui-router-server` map `node` to their development
builds too, so a prerender script or a Node server reports what it skipped. A
`production` condition ahead of `node` takes the production build back, so a
production server bundle carries no warnings. Each warning in the development
build also asks the package's `#dev-gate` import (`imports` in its
`package.json`): under `node` it reads `process.env.NODE_ENV` when the warning
would fire and stays silent for `production`; under every other condition it
always answers yes. `deno` keeps the production build, because reading
`NODE_ENV` there needs `--allow-env`.

### Recommended server workflow

- **Develop with Vite.** Build the router in your Vite config and pass it to
  `serverRouterPlugin`, as this site's
  [`.vitepress/vite.config.ts`](https://github.com/simshanith/lit-ui-router/blob/main/www/lit-ui-router.dev/.vitepress/vite.config.ts)
  does. The config loader resolves the development build, so warnings print in
  the terminal with nothing extra to configure.
- **Assert mounts in unit tests.** Assert that
  `diagnoseMounts(createServerRouter({ mounts }))` returns `[]`, as
  [`apps/sample-app-routes/test/routes.test.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-routes/test/routes.test.ts)
  does — it reports in every build and catches route issues a manual dev run
  never reaches.
- **Preview Workers in development.** Pass `WRANGLER_BUILD_CONDITIONS` on the
  `wrangler dev` command (as [below](#what-to-set)) during local previews, as
  this site's
  [`scripts/wrangler-dev.ts`](https://github.com/simshanith/lit-ui-router/blob/main/www/lit-ui-router.dev/scripts/wrangler-dev.ts)
  launcher does.
- **Test with production conditions.** Run end-to-end checks with the default
  production conditions `wrangler deploy` uses, as
  [`apps/sample-app-lit-e2e/scripts/run-e2e.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-lit-e2e/scripts/run-e2e.ts)
  does.

Elsewhere, develop on the development build and deploy with
`NODE_ENV=production` or a `production` condition. A Node or Bun server
deployed with neither warns once at boot for each mount that 404s its bare
base, as Express and React warn in the same case.

### Other runtimes

| Runtime or bundler                                   | Build it resolves                                                                          | Warns                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------- |
| plain `node`, Bun                                    | development, through `node`                                                                | unless `NODE_ENV=production`          |
| `node -C development`                                | development                                                                                | unless `NODE_ENV=production`          |
| `node -C production`                                 | production                                                                                 | never                                 |
| vitest, jest                                         | development                                                                                | unless `NODE_ENV=production`          |
| Vite SSR dev, the Vite config loader                 | development                                                                                | unless `NODE_ENV=production`          |
| `vite build --ssr`                                   | production, through `production`                                                           | never                                 |
| webpack targeting node                               | the build its `mode` names, through `development` or `production`                          | only in `mode: 'development'`         |
| esbuild or Rollup targeting node                     | development, with the `NODE_ENV` read bundled; production under the `production` condition | as the bundle's `NODE_ENV` says       |
| Deno                                                 | production, through `deno`; development under `--conditions`                               | only under `--conditions=development` |
| Workers, browsers, esbuild or Rollup for the browser | production; development under the `development` condition                                  | only in the development build         |

Only the `node` side of `#dev-gate` mentions `process`, so a Worker or browser
bundle never contains it.

### What to set

- **Bundling a server for production with esbuild or Rollup:** pass the
  `production` condition (esbuild `--conditions=production`, or `production`
  in node-resolve's `exportConditions`). Without it, the bundle ships the
  development build and the `NODE_ENV` read.
- **Deploying on Node or Bun:** set `NODE_ENV=production`, or run
  `node -C production`.
- **Development warnings on Deno or Workers:** opt in with the `development`
  condition: Deno's `--conditions=development`, or
  `WRANGLER_BUILD_CONDITIONS=development,workerd,worker,browser` (wrangler's
  own list plus `development`) on the command that starts `wrangler dev`.
  Never set it in `.env`, which `wrangler deploy` also loads.
- **Vite, vitest, jest and webpack:** nothing to set.

## What still warns in production

Two warnings are not part of the split and ship in both builds: `<ui-router>`
and `<ui-view>` each warn if another class already holds their tag name, name
that class, then skip registration. That is a first-definition-wins degradation
rather than a `define()` throw. A subclass of their own element passes silently:
it is a deliberate extension, and it is how `lit-ui-router-ssr/register` takes
`<ui-view>`. A foreign class usually means two copies of the package are
loaded — worth saying in production, because it is a packaging fault rather
than an authoring mistake.

## Catching the same problems at author time

Two of the warnings above have static counterparts in
[`eslint-plugin-lit-ui-router`](/packages/eslint-plugin-lit-ui-router) — the inert `href` and
the silent `aria-current` takeover — alongside a rule for the directives'
element-part-only constructor throw, which is unconditional and fires in both
builds. Lint reports all three across the whole codebase at author time,
including for code paths a production build will never warn about and a
development run may never reach.

[Linting](./linting) shows what the plugin catches and how to add it.

## How the split is kept honest

Every published package with two builds is verified at build time in both
directions: every declared development warning appears in `dist/development/`,
none appears in the production `dist/*.js`, and browser or Worker outputs never
reference `process`.
