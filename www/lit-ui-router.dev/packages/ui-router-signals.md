---
title: ui-router-signals
description: A framework-agnostic TC39 Signals mirror of the router's current state with ui-router-signals
---

# ui-router-signals

<p class="badges">
<a href="https://npmx.dev/package/ui-router-signals" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/ui-router-signals" /></a>
<a href="https://lit-ui-router.dev/gh/releases/ui-router-signals/latest" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-signals@*" /></a>
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
```

`@uirouter/core` and `signal-polyfill` are peer dependencies. Every signal
consumer in a bundle needs the same copy of `signal-polyfill`; two copies keep
two separate signal graphs.

## RouterSignals

[`RouterSignals.for(router)`](/api/ui-router-signals/classes/RouterSignals#for)
returns the router's one instance, attaching its
transition hooks on first use. An `onSuccess` hook writes one route snapshot
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

## Pending transition

`pending`, another read-only `Signal.Computed`, holds the newest transition
still in flight, and `undefined` when none is. It sits beside `route`, not
inside it, since every snapshot is a settled route. An `onStart` hook sets it,
and the transition's promise clears it when that transition settles, whether it
succeeds, errors or is aborted. A superseded transition never clears its
successor, and a transition already running on first use counts as pending.
Failures still reach `onError` hooks, not a field.

```ts
const stop = watchSelection(
  () => signals.pending.get() !== undefined,
  undefined,
  (busy) => document.body.toggleAttribute('aria-busy', busy),
);
```

## Typed snapshots

[`RouteTypes`](/api/ui-router-signals/interfaces/RouteTypes) is empty, and
`route` holds a `RouteSnapshot`. Filling in its `snapshot` member by module
augmentation types `route`: a snapshot whose `includes(name)` is a type
predicate narrows `current` and `params` to that state. The `current`,
`params` and `transition` fields keep their untyped shapes.

```ts
declare module 'ui-router-signals' {
  interface RouteTypes {
    snapshot: AppRouteSnapshot;
  }
}
```

## watchSelection

[`watchSelection(selector, equals, apply)`](/api/ui-router-signals/functions/watchSelection)
watches a selector through a
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

- [API reference](/api/ui-router-signals/)
- [TC39 Signals proposal](https://github.com/tc39/proposal-signals)
- [`signal-polyfill`](https://github.com/proposal-signals/signal-polyfill)
- [On the Altitude Atlas](https://atlas.lit-ui-router.dev/bricks/?focus=ui-router-signals) — this package as
  a brick in sheet 2's model in the round, sized by its authored files and
  seated on what it peers
