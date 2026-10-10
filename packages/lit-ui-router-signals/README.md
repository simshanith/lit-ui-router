# lit-ui-router-signals

[TC39 Signals](https://github.com/tc39/proposal-signals) bindings for [lit-ui-router](https://lit-ui-router.dev): watcher-based Lit ReactiveControllers over the framework-agnostic [`ui-router-signals`](../ui-router-signals/).

A private sketch, not yet published; the design is tracked in [#1157](https://github.com/simshanith/lit-ui-router/issues/1157). [`apps/sample-app-lit-signals`](../../apps/sample-app-lit-signals/) uses it.

It registers no custom elements and adds no routing behavior. It takes the companion-adapter shape of [`lit-ui-router-mobx`](../lit-ui-router-mobx/) and [`lit-ui-router-effect`](../lit-ui-router-effect/) onto the proposal's API, through [`signal-polyfill`](https://github.com/proposal-signals/signal-polyfill):

| signals                               | lit-ui-router-mobx         | lit-ui-router-effect  |
| ------------------------------------- | -------------------------- | --------------------- |
| `RouterSignals` (`ui-router-signals`) | `RouterStore`              | `routeRef`            |
| `SignalController`                    | `ReactionController`       | `RefController`       |
| `RouterSignalController`              | `RouterReactionController` | `RouterRefController` |

## Features

- **`RouterSignalController`**: watches the `RouterSignals` of a router given explicitly (or by a thunk resolved on each connect), scoped by `withRouterSync` for a server render, or supplied by the nearest provider over `context-request` with the `ui-router-context` event as fallback. An explicit or scoped router is read at construction, so a host rendered on the server sees the same `.value` a browser would. `setRouter()` hands it a router later.
- **`SignalController`**: the generic primitive. A `watchSelection` over a selector while the host is connected; `requestUpdate()` only when the selected value changes under `equals`.
- **Lifecycle-safe**: watching starts in `hostConnected` and stops in `hostDisconnected`. The selector runs on every (re)connect, so sticky components never render stale values.

Changes arrive in a microtask after the source `set()`: a watcher's notify callback may not read signals, so it schedules the read.

## `@lit-labs/signals`

`@lit-labs/signals` builds on the same `signal-polyfill`, so a `SignalWatcher` element tracks `RouterSignals` fields read in `render()` with no controller:

```typescript
import { SignalWatcher } from '@lit-labs/signals';
import { RouterSignals } from 'ui-router-signals';

class Crumb extends SignalWatcher(LitElement) {
  render() {
    return html`${RouterSignals.for(router).current.get()?.name}`;
  }
}
```

Both need one copy of `signal-polyfill` in the bundle; two copies keep two separate signal graphs.

## Dependencies

It uses `ui-router-signals`, `lit-ui-router/context`, `lit`, `@uirouter/core`, and `signal-polyfill@^0.2.2`. They are devDependencies while the package is private; publishing turns them into peers.
