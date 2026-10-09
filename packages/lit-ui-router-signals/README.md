# lit-ui-router-signals

[TC39 Signals](https://github.com/tc39/proposal-signals) bindings for [lit-ui-router](https://lit-ui-router.dev): a signal mirror of the router and watcher-based Lit ReactiveControllers.

A private sketch, not yet published; the design and the path into core are tracked in [#1157](https://github.com/simshanith/lit-ui-router/issues/1157). [`apps/sample-app-lit-signals`](../../apps/sample-app-lit-signals/) uses it.

It registers no custom elements and adds no routing behavior. It is the [`lit-ui-router-mobx`](../lit-ui-router-mobx/) shape on the proposal's API, through [`signal-polyfill`](https://github.com/proposal-signals/signal-polyfill):

| lit-ui-router-signals    | lit-ui-router-mobx         |
| ------------------------ | -------------------------- |
| `RouterSignals`          | `RouterStore`              |
| `SignalController`       | `ReactionController`       |
| `RouterSignalController` | `RouterReactionController` |

## Features

- **`RouterSignals`**: `current`, `params` and `transition` as read-only `Signal.Computed`s over one `Signal.State` written per transition, plus a tracked `includes()`. One instance (and one transition hook) per router via `RouterSignals.for(router)`.
- **`RouterSignalController`**: watches the `RouterSignals` of the router its nearest provider supplies, found over `context-request` with the `ui-router-context` event as fallback.
- **`SignalController`**: the generic primitive. A `Signal.subtle.Watcher` over a selector's `Signal.Computed` while the host is connected; `requestUpdate()` only when the selected value changes under `equals`.
- **Lifecycle-safe**: watching starts in `hostConnected` and stops in `hostDisconnected`. The selector runs on every (re)connect, so sticky components never render stale values.

Changes arrive in a microtask after the source `set()`: a watcher's notify callback may not read signals, so it schedules the read.

## `@lit-labs/signals`

`@lit-labs/signals` builds on the same `signal-polyfill`, so a `SignalWatcher` element tracks `RouterSignals` fields read in `render()` with no controller:

```typescript
import { SignalWatcher } from '@lit-labs/signals';
import { RouterSignals } from 'lit-ui-router-signals';

class Crumb extends SignalWatcher(LitElement) {
  render() {
    return html`${RouterSignals.for(router).current.get()?.name}`;
  }
}
```

Both need one copy of `signal-polyfill` in the bundle; two copies keep two separate signal graphs.

## Dependencies

It uses `lit-ui-router/context` (from `lit-ui-router@1.15.0`), `lit`, `@uirouter/core`, and `signal-polyfill@^0.2.2`. They are devDependencies while the package is private; publishing turns them into peers.
