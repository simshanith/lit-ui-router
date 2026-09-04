---
title: Development and Production Builds
description: How lit-ui-router ships a separate development build, what warnings it carries, and why production bundles never contain them
---

# Development and Production Builds

`lit-ui-router` and `lit-ui-router-mobx` each publish two builds of the same
code. Your bundler picks one automatically through the `development` export
condition: a dev server or a development build resolves
`dist/development/index.js`, a production build resolves `dist/index.js`.
There is nothing to install, configure, or opt into.

The two builds behave identically except for one thing: the development build
carries console warnings that the production build does not. Those warnings are
not merely disabled in production — `import.meta.env.DEV` is substituted with a
literal at emit time, so the guarded bodies fold out of `dist/*.js` entirely,
message strings included. A production bundle cannot be made to print them.

## Which packages ship it

| Package                       | Two builds | Why                                              |
| ----------------------------- | ---------- | ------------------------------------------------ |
| `lit-ui-router`               | yes        | three development warnings                       |
| `lit-ui-router-mobx`          | yes        | one development warning                          |
| `navigation-location-plugin`  | no         | no runtime warnings to fold out                  |
| `ui-router-server`            | no         | no runtime warnings to fold out                  |
| `eslint-plugin-lit-ui-router` | no         | a lint plugin — it never runs in your app bundle |

The split exists where there is something to strip. A package with a single
build is not missing a feature.

Every entry point of `lit-ui-router` is covered, not just the root: `pure`,
`register`, `ui-router.register`, and `ui-view.register` each carry their own
`development` condition.

## The second gate: lit's own build

Every warning here is gated twice. Past `import.meta.env.DEV`, it also checks
that lit itself resolved to its development build, by probing for
`ReactiveElement.enableWarning` — a method lit declares optional precisely
because it exists only in development.

So a development build of these packages paired with a production lit stays
silent. That pairing is unusual, but it is what a consumer gets when their
bundler resolves the two packages under different conditions, and a warning
that fires there would be noise rather than signal.

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

## What still warns in production

Two warnings are not part of the split and ship in both builds: `<ui-router>`
and `<ui-view>` each warn if their tag name is already defined, then skip
registration. That is a first-definition-wins degradation rather than a
`define()` throw, and it usually means two copies of the package are loaded —
worth saying in production, because it is a packaging fault rather than an
authoring mistake.

## Catching the same problems at author time

Two of the warnings above have static counterparts in
[`eslint-plugin-lit-ui-router`](/packages/eslint-plugin) — the inert `href` and
the silent `aria-current` takeover — alongside a rule for the directives'
element-part-only constructor throw, which is unconditional and fires in both
builds. Lint reports all three across the whole codebase at author time,
including for code paths a production build will never warn about and a
development run may never reach.

## How the split is kept honest

Each of the two packages declares its development-only message prefixes in a
`dev-warnings.json` beside its manifest. The `check:dev-split` task
(`@tools/oxc-emit`) reads that list after a build and asserts both directions:
every declared prefix appears in `dist/development/*.js`, and none appears in
`dist/*.js`. Adding a warning behind the `import.meta.env.DEV` guard without
declaring it fails the check — so the list cannot silently drift from the code,
in either direction.
