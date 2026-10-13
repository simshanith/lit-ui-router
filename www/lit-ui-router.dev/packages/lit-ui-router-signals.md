---
title: Signals Bindings
description: Watcher-based Lit controllers over TC39 Signals of the route with lit-ui-router-signals
---

# lit-ui-router-signals

<p class="badges">
<a href="https://npmx.dev/package/lit-ui-router-signals" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/lit-ui-router-signals" /></a>
<a href="https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router-signals" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router-signals@*" /></a>
</p>

[`lit-ui-router-signals`](https://npmx.dev/package/lit-ui-router-signals)
provides [TC39 Signals](https://github.com/tc39/proposal-signals) bindings for
lit-ui-router: [ReactiveControllers](https://lit.dev/docs/composition/controllers/)
that watch the [`ui-router-signals`](/packages/ui-router-signals) mirror of the
router's state and update their host when a selected value changes.

It registers no custom elements and adds no routing behavior. It has the
shape of the [Effect](/packages/lit-ui-router-effect) and [MobX](/packages/mobx) bindings:

| Signals                               | MobX                       | Effect                          |
| ------------------------------------- | -------------------------- | ------------------------------- |
| `RouterSignals` (`ui-router-signals`) | `RouterStore`              | `routeRef` (`ui-router-effect`) |
| `SignalController`                    | `ReactionController`       | `RefController`                 |
| `RouterSignalController`              | `RouterReactionController` | `RouterRefController`           |

## Installation

```bash
npm install lit-ui-router-signals@rc ui-router-signals@rc signal-polyfill
# or
pnpm add lit-ui-router-signals@rc ui-router-signals@rc signal-polyfill
```

`lit-ui-router`, `ui-router-signals`, `lit`, and `@uirouter/core` are peer
dependencies, and `signal-polyfill` is a peer of `ui-router-signals`.

## Quick start

```ts
import { html, LitElement } from 'lit';
import { RouterSignalController } from 'lit-ui-router-signals';

class AppNav extends LitElement {
  // Re-renders only when the selection flips, not on every transition.
  private inbox = new RouterSignalController(this, (signals) =>
    signals.route.get().includes('inbox.**'),
  );

  render() {
    return html`...${this.inbox.value ? 'Inbox is open' : ''}...`;
  }
}
```

No router configuration is required: the controller discovers the router from
the enclosing `<ui-router>` element when the host connects, and
`RouterSignals.for` attaches its single transition hook on first use.

## The pieces

### RouterSignalController

Watches the `RouterSignals` of a router and exposes the selector's result as
`.value`. The router comes from the `router` option (a router or a thunk), a
`withRouterSync` scope at construction, or the nearest provider on
`hostConnected`, as the Effect and MobX router controllers find theirs.
`setRouter()` hands it a router later.

### SignalController

The generic primitive: watches any selector over signals while the host is
connected, and calls `requestUpdate()` only when the selected value changes
under `equals` (default `Object.is`).

Both take `initialValue`, `equals` and `onChange` options. Changes arrive in a
microtask after the source changes: a watcher's notify callback may not read
signals, so it schedules the read.

## Lifecycle safety

Watching starts in `hostConnected` and stops in `hostDisconnected`. The
selector runs on every (re)connect, so a component that re-enters the DOM
renders current values.

## `@lit-labs/signals`

[`@lit-labs/signals`](https://www.npmjs.com/package/@lit-labs/signals) builds
on the same `signal-polyfill`, so a `SignalWatcher` element tracks the
`RouterSignals` fields it reads in `render()` without a controller. Both need
one copy of `signal-polyfill` in the bundle; two copies keep two separate
signal graphs.

## Further reading

- [ui-router-signals](/packages/ui-router-signals)
- [TC39 Signals proposal](https://github.com/tc39/proposal-signals)
- [Lit — Reactive Controllers](https://lit.dev/docs/composition/controllers/)
