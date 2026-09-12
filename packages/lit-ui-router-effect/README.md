# lit-ui-router-effect

[![npm version](https://img.shields.io/npm/v/lit-ui-router-effect.svg)](https://npmx.dev/package/lit-ui-router-effect)
[![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router-effect@*)](https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router-effect)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Flit-ui-router.dev)](https://lit-ui-router.dev/packages/effect)
[![codecov](https://codecov.io/gh/simshanith/lit-ui-router/graph/badge.svg?component=lit-ui-router-effect)](https://app.codecov.io/gh/simshanith/lit-ui-router?components%5B0%5D=lit-ui-router-effect)

[Effect](https://effect.website) bindings for [lit-ui-router](https://lit-ui-router.dev): a `SubscriptionRef` of the route and ref-following Lit ReactiveControllers.

A thin wrapper on top of `lit-ui-router` — it registers no custom elements and adds no routing behavior. It mirrors the router's state into a `SubscriptionRef` and gives components a declarative, lifecycle-safe way to follow it (and any other `SubscriptionRef`) with automatic `requestUpdate()` — no manual refresh plumbing.

## Features

- **`routeRef(router)`** — a `SubscriptionRef<RouteSnapshot>` of the current state, params, and transition; one ref (and one transition hook) per router, attached lazily on first use
- **`RouterRefController`** — follows the route ref of the nearest `<ui-router>` context, discovered automatically through the `ui-router-context` event; no prop drilling and no wiring in router configuration
- **`RefController`** — the generic primitive: selects over one or more `SubscriptionRef`s while the host is connected; works with any ref, not just the router's
- **Lifecycle-safe** — one fiber per controller, forked in `hostConnected` and interrupted in `hostDisconnected`; the value is re-read on every (re)connect so components that re-enter the DOM (e.g. sticky states) never render stale values
- **Renders before connect** — refs given directly are read at construction, so a host rendered on the server sees the same value a browser would

## Installation

```bash
npm install lit-ui-router-effect effect
# or
pnpm add lit-ui-router-effect effect
# or
yarn add lit-ui-router-effect effect
```

`lit-ui-router`, `lit`, `effect`, and `@uirouter/core` are peer dependencies.

## Quick Start

```typescript
import { html, LitElement } from 'lit';
import { Data, Equal } from 'effect';
import { RouterRefController } from 'lit-ui-router-effect';

class AppNav extends LitElement {
  // Re-renders only when a section's visibility actually flips —
  // not on every transition. Data.struct gives the selection value
  // equality, so Equal.equals compares it structurally.
  private active = new RouterRefController(
    this,
    (route) =>
      Data.struct({
        inbox: route.includes('inbox.**'),
        contacts: route.includes('contacts.**'),
      }),
    { equals: Equal.equals },
  );

  render() {
    return html`...${this.active.value.inbox ? 'Inbox is open' : ''}...`;
  }
}
```

No router configuration is required: the controller discovers the router from the enclosing `<ui-router>` element on `hostConnected`, and `routeRef(router)` lazily attaches the ref's single transition hook on first use.

## API

### `routeRef(router)`

The `SubscriptionRef<RouteSnapshot>` for a router — memoized, one per router instance. The first call registers one `transitionService.onSuccess` hook that replaces the value per successful transition.

### `RouteSnapshot`

A value taken once per successful transition. Every member answers for that moment, so a selector asking during a later transition gets the settled answer, not the in-flight one.

| Member                      | Description                                                                  |
| --------------------------- | ---------------------------------------------------------------------------- |
| `current`                   | The current `StateDeclaration` (`globals.current`)                           |
| `params`                    | The current `RawParams` (`globals.params`), a fresh object per transition    |
| `transition`                | The transition that produced the snapshot                                    |
| `includes(stateOrName, p?)` | `StateService.includes` evaluated against the snapshot (globs like `'a.**'`) |

### `RouterRefController`

A ReactiveController that follows the route ref of the host's `<ui-router>` context:

```typescript
new RouterRefController(host, selector, options?)
```

- `selector: (route: RouteSnapshot) => T` — the selected expression; the result is exposed as `.value`
- `options.router` — explicit router instance, skipping context discovery; the route is then read at construction, so `.value` is live before the host connects
- `options.onChange` — effect invoked when the selected value changes (and once on every (re)connect); useful for resetting component state from route params
- `options.equals` — comparer for precise, value-based change detection (`Equal.equals` for `Data` values, or any `(a, b) => boolean`); defaults to `Object.is`
- `options.initialValue` — the value `.value` carries before the router is discovered: before `hostConnected`, and while a host has no router context
- `options.runtime` — the runtime the subscription fiber is forked on; defaults to Effect's default runtime, and a `ManagedRuntime` satisfies it directly

### `RefController`

The generic primitive behind `RouterRefController` — the same selector/options contract over any `SubscriptionRef`s:

```typescript
import { Data, Equal } from 'effect';
import { RefController } from 'lit-ui-router-effect';

class NavHeader extends LitElement {
  private auth = new RefController(
    this,
    [Session.user$, Session.loggedIn$],
    (user, loggedIn) => Data.struct({ user, loggedIn }),
    { equals: Equal.equals },
  );

  render() {
    const { user, loggedIn } = this.auth.value;
    // ...
  }
}
```

The refs are a tuple, and the selector receives their values positionally. Pass a thunk instead (`() => [ref]`) for refs that depend on the host's place in the DOM; it is resolved on every `hostConnected`, and `.value` carries `options.initialValue` until then.

## Development and production builds

`dist/development/index.js` is published alongside `dist/index.js` and picked by the `development` export condition, which bundlers resolve automatically in development; production builds get the default. Nothing to configure. `lit-ui-router` ships the same split — see the [Development & Production Builds guide](https://lit-ui-router.dev/guides/development-builds) for the mechanism and the warnings both packages carry.

The development build adds one console warning here: a `RouterRefController` whose host has no `<ui-router>` ancestor warns once, naming that host, and follows nothing — `.value` stays at `options.initialValue`, so the host renders once and never again. Wrap the subtree in `<ui-router>`, or pass `options.router` for a host outside the router's DOM. Production builds drop the warning and its message text, and lit's own production build silences it as well.

## Links

- [Docs - Effect Bindings](https://lit-ui-router.dev/packages/effect)
- [Docs - Reactive Components guide](https://lit-ui-router.dev/guides/reactive-components)
- [lit-ui-router](https://lit-ui-router.dev)
- [Effect — SubscriptionRef](https://effect.website/docs/state-management/subscriptionref/)
- [Lit — Reactive Controllers](https://lit.dev/docs/composition/controllers/)
- [@uirouter/core — TransitionService hooks](https://ui-router.github.io/core/docs/latest/classes/transition.transitionservice.html)
