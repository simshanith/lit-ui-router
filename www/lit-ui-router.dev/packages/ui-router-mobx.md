---
title: ui-router-mobx
description: A framework-agnostic MobX observable store of the router's current state with ui-router-mobx
---

# ui-router-mobx

<p class="badges">
<a href="https://npmx.dev/package/ui-router-mobx" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/ui-router-mobx" /></a>
<a href="https://lit-ui-router.dev/gh/releases/ui-router-mobx/latest" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-mobx@*" /></a>
</p>

[`ui-router-mobx`](https://npmx.dev/package/ui-router-mobx) provides
[MobX](https://mobx.js.org) bindings for a `@uirouter/core` router: an
observable store of its current state. It imports only `mobx` and
`@uirouter/core`, so any MobX reaction can follow route state without Lit.
[`lit-ui-router-mobx`](/packages/lit-ui-router-mobx) builds its Lit
controllers on it and re-exports `RouterStore`.

## Installation

```bash
npm install ui-router-mobx mobx
```

`@uirouter/core` and `mobx` are peer dependencies. Both MobX majors are
supported (`mobx@^6.0.0 || ^7.0.0`), and the store's API is the same on either.

## RouterStore

[`RouterStore.for(router)`](/api/ui-router-mobx/classes/RouterStore#for)
returns the router's observable store. The first call for a router creates its
one store and registers its transition hooks: `onSuccess` updates the settled
fields, and `onStart` feeds `pending`. Later calls return the same store. The
store and the hooks live as long as the router.

Any MobX `reaction`, `autorun` or `computed` that reads the store re-runs when
the values it reads change:

```ts
import { reaction } from 'mobx';
import { RouterStore } from 'ui-router-mobx';

const store = RouterStore.for(router);

const dispose = reaction(
  () => store.includes('admin.**'),
  (inAdmin) => console.log(inAdmin ? 'entered admin' : 'left admin'),
);
```

| Member                           | Value                                                               |
| -------------------------------- | ------------------------------------------------------------------- |
| `current`                        | the current state declaration                                       |
| `params`                         | the current parameter values, a fresh object per transition         |
| `transition`                     | the most recent successful transition                               |
| `pending`                        | the newest transition still in flight, `undefined` when none is     |
| `includes(stateOrName, params?)` | an observable `StateService.includes`, globs like `'a.**'` included |

Each field is replaced per transition, never mutated, so a reaction compares
them by reference.

`pending` is set when a transition starts. The transition's promise clears it
when that transition settles, whether it succeeds, errors or is aborted. A
superseded transition never clears its successor, and a transition already
running on first use counts as pending. Both writes run in MobX actions, so
`enforceActions` sees no unguarded writes. `transition` still means the most
recent successful one, and failures still reach `onError` hooks, not a field.

```ts
const dispose = reaction(
  () => store.pending !== undefined,
  (busy) => document.body.toggleAttribute('aria-busy', busy),
);
```

To manage a store yourself, call
[`attach(router)`](/api/ui-router-mobx/classes/RouterStore#attach) on a
`new RouterStore()`. It returns the hooks' deregistration function, and it
throws if the store already mirrors a different router.

## Typed stores

[`RouteTypes`](/api/ui-router-mobx/interfaces/RouteTypes) is empty, and the
store's `current` is a `StateDeclaration`, its `params` are `RawParams`,
and `includes` takes any `StateOrName`. Filling it in by module augmentation
types the store:

- `snapshot`: a route snapshot type. Its `current` and `params` type the
  store's fields, and its `includes` parameter types the targets
  `includes` takes, such as globs and state objects.
- `snapshots`: keyed by state name, the snapshot narrowed to that state's
  subtree. `includes(name)` with one of its names is a type predicate that
  narrows the store's `current` and `params`.

```ts
declare module 'ui-router-mobx' {
  interface RouteTypes {
    snapshot: AppRouteSnapshot;
    snapshots: { 'contacts.contact': ContactSnapshot };
  }
}
```

## Further reading

- [API reference](/api/ui-router-mobx/)
- [lit-ui-router-mobx](/packages/lit-ui-router-mobx)
- [MobX — reactions](https://mobx.js.org/reactions.html)
- [On the Altitude Atlas](https://atlas.lit-ui-router.dev/bricks/?focus=ui-router-mobx) — this package as
  a brick in sheet 2's model in the round, sized by its authored files and
  seated on what it peers
