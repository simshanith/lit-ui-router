---
title: MobX Bindings
description: Observable router state and reaction-based controllers with lit-ui-router-mobx
---

# lit-ui-router-mobx

<p class="badges">
<a href="https://npmx.dev/package/lit-ui-router-mobx" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/lit-ui-router-mobx" /></a>
<a href="https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router-mobx" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router-mobx@*" /></a>
</p>

[`lit-ui-router-mobx`](https://npmx.dev/package/lit-ui-router-mobx)
provides [MobX](https://mobx.js.org) bindings for lit-ui-router: an observable
mirror of the router's state and reaction-based
[ReactiveControllers](https://lit.dev/docs/composition/controllers/) that keep
components in sync with it.

It is a thin wrapper on top of `lit-ui-router` — it registers no custom
elements and adds no routing behavior. If your application already uses MobX
for its own state, these bindings let route state participate in the same
reactivity system, with automatic `requestUpdate()` and no manual refresh
plumbing.

::: tip Not using MobX?
You don't need this package to react to route changes. The core package's
zero-dependency
[`TransitionController`](/api/reference/controllers/TransitionController)
covers the same ground with transition hooks instead of observables.
:::

## Installation

```bash
npm install lit-ui-router-mobx mobx
# or
pnpm add lit-ui-router-mobx mobx
```

`lit-ui-router`, `lit`, `mobx`, and `@uirouter/core` are peer dependencies.

## Quick start

```ts
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

No router configuration is required: the controller discovers the router from
the enclosing `<ui-router>` element when the host connects, and the store
lazily attaches its single transition hook on first use.

## The pieces

### RouterStore

[`RouterStore`](/api/lit-ui-router-mobx/classes/RouterStore) is an observable
mirror of a router's current state, updated by one
`transitionService.onSuccess` hook per router.

| Member                      | Description                                                                  |
| --------------------------- | ---------------------------------------------------------------------------- |
| `RouterStore.for(router)`   | The store for a router — memoized, one per router instance                   |
| `current`                   | The current `StateDeclaration` (`globals.current`)                           |
| `params`                    | The current `RawParams` (`globals.params`), replaced per transition          |
| `transition`                | The most recent successful `Transition`                                      |
| `includes(stateOrName, p?)` | Observable version of `StateService.includes` (supports globs like `'a.**'`) |
| `attach(router)`            | Manual attachment, for self-managed store instances                          |

### RouterReactionController

[`RouterReactionController`](/api/lit-ui-router-mobx/classes/RouterReactionController)
observes the `RouterStore` of the host's `<ui-router>` context:

```ts
new RouterReactionController(host, selector, options?)
```

- `selector: (store: RouterStore) => T` — the observed expression; the result
  is exposed as `.value`
- `options.router` — explicit router instance, skipping context discovery
- `options.onChange` — effect invoked when the selected value changes (and
  once on every (re)connect); useful for resetting component state from route
  params
- `options.equals` — MobX comparer (e.g. `comparer.structural`) for precise,
  value-based change detection

### ReactionController

[`ReactionController`](/api/lit-ui-router-mobx/classes/ReactionController) is
the generic primitive behind `RouterReactionController` — the same
selector/options contract over **any** MobX observables, not just the router:

```ts
import { comparer } from 'mobx';
import { ReactionController } from 'lit-ui-router-mobx';

class NavHeader extends LitElement {
  private auth = new ReactionController(
    this,
    () => ({ user: SessionStore.user, loggedIn: SessionStore.loggedIn }),
    { equals: comparer.structural },
  );

  render() {
    const { user, loggedIn } = this.auth.value;
    // ...
  }
}
```

## Lifecycle safety

Reactions are created in `hostConnected` and disposed in `hostDisconnected`,
so nothing leaks when elements come and go from the DOM. They also fire
immediately on every (re)connect, so components that re-enter the DOM — for
example under
[sticky states](https://github.com/ui-router/sticky-states) — never render
stale values.

## Why selectors instead of render auto-tracking?

Mixins like [`MobxLitElement`](https://github.com/adobe/lit-mobx) auto-track
every observable read in `render()`. The controllers here are the
composition-friendly alternative:

- No base class required — controllers attach to any `LitElement` (or any
  `ReactiveControllerHost`)
- Dependencies are explicit: the selector names exactly which observables
  drive the host
- `equals: comparer.structural` avoids re-renders when a recomputed value is
  structurally unchanged
- The reaction lifecycle is bound to the host's connection lifecycle
  automatically

## See it in a real app

The <a href="/app-mobx" target="_self">MobX sample app</a> is a complete
application built on these controllers. It is behaviorally identical to the
<a href="/app" target="_self">vanilla sample app</a> (which uses
`TransitionController`), so the
[two codebases](https://github.com/simshanith/lit-ui-router/tree/main/apps)
can be compared file-by-file to see exactly what the MobX idiom changes.

## Further reading

- [API reference](/api/lit-ui-router-mobx/)
- [MobX — reactions](https://mobx.js.org/reactions.html)
- [Lit — Reactive Controllers](https://lit.dev/docs/composition/controllers/)
