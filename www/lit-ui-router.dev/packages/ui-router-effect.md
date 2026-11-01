---
title: ui-router-effect
description: A framework-agnostic Effect SubscriptionRef of the router's current state with ui-router-effect
---

# ui-router-effect

<p class="badges">
<a href="https://npmx.dev/package/ui-router-effect" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/ui-router-effect" /></a>
<a href="https://lit-ui-router.dev/gh/releases/ui-router-effect/latest" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-effect@*" /></a>
</p>

[`ui-router-effect`](https://npmx.dev/package/ui-router-effect) provides
[Effect](https://effect.website) bindings for a `@uirouter/core` router: a
[`SubscriptionRef`](https://effect.website/docs/state-management/subscriptionref/)
of its current state. It imports only `effect` and `@uirouter/core`, so any
Effect program can follow route state without Lit.
[`lit-ui-router-effect`](/packages/lit-ui-router-effect) builds its Lit
controllers on it and re-exports `routeRef`.

## Installation

```bash
npm install ui-router-effect effect
```

`@uirouter/core` and `effect` are peer dependencies.

### Effect 3 and 4

Both majors are supported (`effect@^3.22.0 || ^4.0.2`). `routeRef` is the
same on either; the examples below are written for Effect 4. Two differences
show up around it:

- Effect 4 reads a ref's stream with `SubscriptionRef.changes(ref)`; on
  Effect 3 it is the ref's own `ref.changes` property.
- Effect 4's `Equal.equals` compares plain objects structurally. Effect 3
  compares them by reference, so wrap a selected object in `Data.struct(...)`
  for `Equal.equals` to see two equal selections as unchanged.

## routeRef

[`routeRef(router)`](/api/ui-router-effect/functions/routeRef) returns a
`SubscriptionRef` of the router's current route.
The first call for a router creates its one ref and registers one `onSuccess`
transition hook that sets it, so every value it holds is a settled route.
Later calls return the same ref. The ref and the hook live as long as the
router; nothing removes the hook.

Reading the ref once gives the route at that moment:

```ts
import { Effect, SubscriptionRef } from 'effect';
import { routeRef } from 'ui-router-effect';

const program = Effect.gen(function* () {
  const route = yield* SubscriptionRef.get(routeRef(router));
  yield* Effect.log(route.current?.name);
});

Effect.runFork(program);
```

Its changes stream starts with the current route and emits once per
successful transition. `Stream.changes` drops repeats of a primitive:

```ts
import { Effect, Stream, SubscriptionRef } from 'effect';
import { routeRef } from 'ui-router-effect';

const names = SubscriptionRef.changes(routeRef(router)).pipe(
  Stream.map((route) => route.current?.name),
  Stream.changes,
);

Effect.runFork(Stream.runForEach(names, (name) => Effect.log(name)));
```

A selection that builds an object needs `Stream.changesWith(Equal.equals)` to
drop repeats:

```ts
import { Effect, Equal, Stream, SubscriptionRef } from 'effect';
import { routeRef } from 'ui-router-effect';

const active = SubscriptionRef.changes(routeRef(router)).pipe(
  Stream.map((route) => ({
    inbox: route.includes('inbox.**'),
    contacts: route.includes('contacts.**'),
  })),
  Stream.changesWith(Equal.equals),
);

Effect.runFork(Stream.runForEach(active, (sections) => Effect.log(sections)));
```

## pendingRef

[`pendingRef(router)`](/api/ui-router-effect/functions/pendingRef) returns a
`SubscriptionRef` of the newest transition still in flight, and `undefined`
when none is. Like `routeRef`, the first call for a router creates its one ref
and registers one hook, here `onStart`; later calls return the same ref. The
transition's promise clears the value when that transition settles, whether it
succeeds, errors or is aborted. A superseded transition never clears its
successor, and a transition already running on first use counts as pending.
It is a separate ref, not a `RouteSnapshot` field, since every snapshot is a
settled route. Failures still reach `onError` hooks, not a ref.

```ts
import { Effect, Stream, SubscriptionRef } from 'effect';
import { pendingRef } from 'ui-router-effect';

const busy = SubscriptionRef.changes(pendingRef(router)).pipe(
  Stream.map((transition) => transition !== undefined),
  Stream.changes,
);

Effect.runFork(Stream.runForEach(busy, (isBusy) => Effect.log(isBusy)));
```

## RouteSnapshot

The ref holds a
[`RouteSnapshot`](/api/ui-router-effect/interfaces/RouteSnapshot), taken once
per successful transition.
[`snapshotRoute(router, transition?)`](/api/ui-router-effect/functions/snapshotRoute)
builds one directly. Every field answers
for the moment it was taken:

| Field                            | Value                                                                      |
| -------------------------------- | -------------------------------------------------------------------------- |
| `current`                        | the current state declaration                                              |
| `params`                         | the current parameter values, a fresh object per transition                |
| `transition`                     | the transition that produced the snapshot; `undefined` before the first    |
| `includes(stateOrName, params?)` | `StateService.includes` against the snapshot, globs like `'a.**'` included |

`includes()` evaluates against the snapshot, not the live router, so a
selector asking during a later transition gets the settled answer.

## Typed snapshots

[`RouteTypes`](/api/ui-router-effect/interfaces/RouteTypes) is empty, and
`routeRef` holds a `RouteSnapshot`. Filling in its `snapshot` member by module
augmentation types the ref's value: a snapshot whose `includes(name)` is a
type predicate narrows `current` and `params` to that state.
`snapshotRoute(router, transition?)` keeps returning the untyped
`RouteSnapshot`.

```ts
declare module 'ui-router-effect' {
  interface RouteTypes {
    snapshot: AppRouteSnapshot;
  }
}
```

## Further reading

- [API reference](/api/ui-router-effect/)
- [lit-ui-router-effect](/packages/lit-ui-router-effect)
- [Effect — SubscriptionRef](https://effect.website/docs/state-management/subscriptionref/)
- [On the Altitude Atlas](https://atlas.lit-ui-router.dev/bricks/?focus=ui-router-effect) — this package as
  a brick in sheet 2's model in the round, sized by its authored files and
  seated on what it peers
