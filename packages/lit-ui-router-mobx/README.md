# lit-ui-router-mobx

[![npm version](https://img.shields.io/npm/v/lit-ui-router-mobx.svg)](https://www.npmjs.com/package/lit-ui-router-mobx)
[![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router-mobx@*)](https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router-mobx)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![codecov](https://codecov.io/gh/simshanith/lit-ui-router/graph/badge.svg?component=lit-ui-router-mobx)](https://app.codecov.io/gh/simshanith/lit-ui-router?components%5B0%5D=lit-ui-router-mobx)

[MobX](https://mobx.js.org) bindings for [lit-ui-router](https://lit-ui-router.dev): an observable router store and reaction-based Lit ReactiveControllers.

A thin wrapper on top of `lit-ui-router` — it registers no custom elements and adds no routing behavior. It mirrors the router's state into MobX observables and gives components a declarative, lifecycle-safe way to observe them (and any other MobX state) with automatic `requestUpdate()` — no manual refresh plumbing.

## Features

- **`RouterStore`** — an observable mirror of the current state, params, and transition; one store (and one transition hook) per router via `RouterStore.for(router)`
- **`RouterReactionController`** — observes the store of the nearest `<ui-router>` context, discovered automatically through the `ui-router-context` event; no prop drilling and no store wiring in router configuration
- **`ReactionController`** — the generic primitive: runs a MobX `reaction` over an explicit selector while the host is connected; works with any MobX observables, not just the router
- **Lifecycle-safe** — reactions are created in `hostConnected` and disposed in `hostDisconnected`; they fire immediately on (re)connect so components that re-enter the DOM (e.g. sticky states) never render stale values

## Installation

```bash
npm install lit-ui-router-mobx mobx
# or
pnpm add lit-ui-router-mobx mobx
# or
yarn add lit-ui-router-mobx mobx
```

`lit-ui-router`, `lit`, `mobx`, and `@uirouter/core` are peer dependencies.

## Quick Start

```typescript
import { html, LitElement } from 'lit';
import { RouterReactionController } from 'lit-ui-router-mobx';

class AppNav extends LitElement {
  // Re-renders only when the section's visibility actually flips —
  // not on every transition.
  private active = new RouterReactionController(this, (route) => ({
    inbox: route.includes('inbox.**'),
    contacts: route.includes('contacts.**'),
  }));

  render() {
    return html`...${this.active.value.inbox ? 'Inbox is open' : ''}...`;
  }
}
```

No router configuration is required: the controller discovers the router from the enclosing `<ui-router>` element on `hostConnected`, and `RouterStore.for(router)` lazily attaches the store's single transition hook on first use.

## API

### `RouterStore`

An observable mirror of a router's current state, updated by one `transitionService.onSuccess` hook.

| Member                      | Description                                                                  |
| --------------------------- | ---------------------------------------------------------------------------- |
| `RouterStore.for(router)`   | The store for a router — memoized, one per router instance                   |
| `current`                   | The current `StateDeclaration` (`globals.current`)                           |
| `params`                    | The current `RawParams` (`globals.params`), replaced per transition          |
| `transition`                | The most recent successful `Transition`                                      |
| `includes(stateOrName, p?)` | Observable version of `StateService.includes` (supports globs like `'a.**'`) |
| `attach(router)`            | Manual attachment, for self-managed store instances                          |

### `RouterReactionController`

A ReactiveController that observes the `RouterStore` of the host's `<ui-router>` context:

```typescript
new RouterReactionController(host, selector, options?)
```

- `selector: (store: RouterStore) => T` — the observed expression; the result is exposed as `.value`
- `options.router` — explicit router instance, skipping context discovery
- `options.onChange` — effect invoked when the selected value changes (and once on every (re)connect); useful for resetting component state from route params
- `options.equals` — MobX comparer (e.g. `comparer.structural`) for precise, value-based change detection

### `ReactionController`

The generic primitive behind `RouterReactionController` — the same selector/options contract over any MobX observables:

```typescript
import { comparer } from 'mobx';
import { ReactionController } from 'lit-ui-router-mobx';

class NavHeader extends LitElement {
  private auth = new ReactionController(this, () => ({ user: SessionStore.user, loggedIn: SessionStore.loggedIn }), { equals: comparer.structural });

  render() {
    const { user, loggedIn } = this.auth.value;
    // ...
  }
}
```

## Why selectors instead of render auto-tracking?

Mixins like [`MobxLitElement`](https://github.com/adobe/lit-mobx) auto-track every observable read in `render()`. The controllers here are the composition-friendly alternative:

- No base class required — controllers attach to any `LitElement` (or any `ReactiveControllerHost`)
- Dependencies are explicit: the selector names exactly which observables drive the host
- `equals: comparer.structural` avoids re-renders when a recomputed value is structurally unchanged
- The reaction lifecycle is bound to the host's connection lifecycle automatically

## Links

- [lit-ui-router](https://lit-ui-router.dev)
- [MobX — reactions](https://mobx.js.org/reactions.html)
- [Lit — Reactive Controllers](https://lit.dev/docs/composition/controllers/)
- [@uirouter/core — TransitionService hooks](https://ui-router.github.io/core/docs/latest/classes/transition.transitionservice.html)
