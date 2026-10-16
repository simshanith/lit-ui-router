---
title: Development and Production Builds
description: How lit-ui-router ships a separate development build, what warnings it carries, and why production bundles never contain them
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

| Package                       | Two builds | Why                                               |
| ----------------------------- | ---------- | ------------------------------------------------- |
| `lit-ui-router`               | yes        | three development warnings                        |
| `lit-ui-router-effect`        | yes        | one development warning                           |
| `lit-ui-router-mobx`          | yes        | one development warning                           |
| `lit-ui-router-ssr`           | yes        | ten development warnings; also gated under `node` |
| `navigation-location-plugin`  | no         | no runtime warnings to fold out                   |
| `ui-router-server`            | no         | no runtime warnings to fold out                   |
| `eslint-plugin-lit-ui-router` | no         | a lint plugin — it never runs in your app bundle  |

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

| Warning                                    | Fires when                                                                                            | Fix                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `uiSref` wrote an inert `href`             | `assignHref: true` (the default) writes `href` to an element with no `href` in HTML                   | Pass `assignHref: 'auto'` to scope it to real links — see [Design System Links](./design-system-links) |
| `uiSrefActive` took over an `aria-current` | the directive finds an `aria-current` it did not set, and will remove it when the state goes inactive | Pass `ariaCurrentValue: false` to keep the attribute yours                                             |
| no `<ui-router>` ancestor                  | a `<ui-view>`, `uiSref`, or `uiSrefActive` finds no router after its seek has actually run            | Wrap the subtree in `<ui-router>`, or pass a router explicitly                                         |

The missing-router warning fires once per element across all three sites, not
once per binding: a single missing provider trips `uiSref`'s render and its
click on the same element, and a wall of near-identical messages obscures the
one fix.

### `lit-ui-router-mobx`

| Warning                   | Fires when                                                        | Fix                                                         |
| ------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| no `<ui-router>` ancestor | a `RouterReactionController`'s host has no `<ui-router>` above it | Wrap the subtree in `<ui-router>`, or pass `options.router` |

This one has a consequence the message does not state: the controller then
observes nothing. `.value` stays at `options.initialValue` for the life of the
host, and the host is never asked to update — so the symptom is a component
that renders once with its initial value and never again.

## Server runtimes

Server runtimes pick a build by their own export conditions.
`lit-ui-router-ssr` maps `node` to its development build too, so a prerender
script run with plain `node` reports what it skipped. A `production` condition
ahead of `node` takes the production build back, so a production server bundle
carries no warnings. Each warning in the development build also asks the
package's `#dev-gate` import (`imports` in its `package.json`): under `node` it
reads `process.env.NODE_ENV` when the warning would fire and stays silent for
`production`; under every other condition it always answers yes. `deno` keeps
the production build, because reading `NODE_ENV` there needs `--allow-env`.

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

What to set:

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
[`eslint-plugin-lit-ui-router`](/packages/eslint-plugin) — the inert `href` and
the silent `aria-current` takeover — alongside a rule for the directives'
element-part-only constructor throw, which is unconditional and fires in both
builds. Lint reports all three across the whole codebase at author time,
including for code paths a production build will never warn about and a
development run may never reach.

## How the split is kept honest

Each package with two builds declares its development-only message prefixes in a
`dev-warnings.json` beside its manifest. The `check:dev-split` task
(`@tools/oxc-emit`) reads that list after a build and asserts both directions:
every declared prefix appears in `dist/development/*.js`, and none appears in
`dist/*.js`. Adding a warning behind the `import.meta.env.DEV` guard without
declaring it fails the check — so the list cannot silently drift from the code,
in either direction. The same task fails any emitted file that mentions
`process` unless a `package.json#imports` `node` target reaches it.
