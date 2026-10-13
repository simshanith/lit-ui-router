# ui-router-signals

[![codecov](https://codecov.io/gh/simshanith/lit-ui-router/graph/badge.svg?component=ui-router-signals)](https://app.codecov.io/gh/simshanith/lit-ui-router?components%5B0%5D=ui-router-signals)

[TC39 Signals](https://github.com/tc39/proposal-signals) for [UI-Router](https://ui-router.github.io): a framework-agnostic signal mirror of the router's current state, through [`signal-polyfill`](https://github.com/proposal-signals/signal-polyfill).

The design is tracked in [#1157](https://github.com/simshanith/lit-ui-router/issues/1157). [`lit-ui-router-signals`](../lit-ui-router-signals/) builds Lit controllers on it.

## Features

- **`RouterSignals`**: one `RouteSnapshot` per successful transition, in a `Signal.State`. `route`, `current`, `params` and `transition` are read-only `Signal.Computed`s over it, and the tracked `includes()` answers for that settled snapshot, not the live router. One instance (and one transition hook) per router via `RouterSignals.for(router)`.
- **`watchSelection`**: watches a selector through a `Signal.Computed` and hands each new value to a callback, once synchronously and then in a microtask after any source changes. A watcher's notify callback may not read signals, so it schedules the read; several synchronous sets deliver one change.

## Dependencies

`@uirouter/core` and `signal-polyfill` are peer dependencies. `lit` and `lit-ui-router` are not, and the `bundleProbe` claim in `package.json` holds the entry free of them. Every signal consumer in a bundle needs the same copy of `signal-polyfill`; two copies keep two separate signal graphs.
