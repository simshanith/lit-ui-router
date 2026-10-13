---
title: UI-Router Signals
description: A framework-agnostic TC39 Signals mirror of the router's current state with ui-router-signals
---

# ui-router-signals

<p class="badges">
<a href="https://npmx.dev/package/ui-router-signals" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/ui-router-signals" /></a>
<a href="https://github.com/simshanith/lit-ui-router/releases/?q=ui-router-signals" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-signals@*" /></a>
</p>

[`ui-router-signals`](https://npmx.dev/package/ui-router-signals) mirrors a
`@uirouter/core` router's current state into
[TC39 Signals](https://github.com/tc39/proposal-signals), through
[`signal-polyfill`](https://github.com/proposal-signals/signal-polyfill). It
imports neither Lit nor `lit-ui-router`, so any signal consumer can track
route state. [`lit-ui-router-signals`](/packages/lit-ui-router-signals) builds Lit
controllers on it.

## Installation

```bash
npm install ui-router-signals signal-polyfill
# or
pnpm add ui-router-signals signal-polyfill
```

`@uirouter/core` and `signal-polyfill` are peer dependencies. Every signal
consumer in a bundle needs the same copy of `signal-polyfill`; two copies keep
two separate signal graphs.

## RouterSignals

`RouterSignals.for(router)` returns the router's one instance, attaching a
single `onSuccess` transition hook on first use. It writes one route snapshot
per successful transition, so every value is a settled route. Its fields are
read-only `Signal.Computed`s over that snapshot:

| Field        | Value                                       |
| ------------ | ------------------------------------------- |
| `route`      | the whole snapshot, replaced per transition |
| `current`    | the current state declaration               |
| `params`     | the current parameter values                |
| `transition` | the most recent successful transition       |

`includes()` on a snapshot evaluates `StateService.includes` against that
snapshot, not the live router.

```ts
import { RouterSignals } from 'ui-router-signals';

const signals = RouterSignals.for(router);

signals.current.get()?.name;
```

## watchSelection

`watchSelection(selector, equals, apply)` watches a selector through a
`Signal.Computed` and hands each new value to `apply`: once synchronously, then
in a microtask after any source changes. A watcher's notify callback may not
read signals, so it schedules the read, and several synchronous sets deliver
one change. It returns a function that stops watching.

```ts
import { RouterSignals, watchSelection } from 'ui-router-signals';

const signals = RouterSignals.for(router);

const stop = watchSelection(
  () => signals.current.get()?.name,
  undefined,
  (name) => console.log(name),
);
```

## Further reading

- [TC39 Signals proposal](https://github.com/tc39/proposal-signals)
- [`signal-polyfill`](https://github.com/proposal-signals/signal-polyfill)
