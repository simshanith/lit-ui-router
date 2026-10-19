---
title: UI-Router MobX
description: A framework-agnostic MobX observable store of the router's current state with ui-router-mobx
---

# ui-router-mobx

<p class="badges">
<a href="https://npmx.dev/package/ui-router-mobx" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/ui-router-mobx" /></a>
<a href="https://github.com/simshanith/lit-ui-router/releases/?q=ui-router-mobx" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-mobx@*" /></a>
</p>

[`ui-router-mobx`](https://npmx.dev/package/ui-router-mobx) provides
[MobX](https://mobx.js.org) bindings for a `@uirouter/core` router: an
observable store of its current state. It imports only `mobx` and
`@uirouter/core`, so any MobX reaction can follow route state without Lit.
[`lit-ui-router-mobx`](/packages/lit-ui-router-mobx) builds its Lit
controllers on it and re-exports `RouterStore`.

## Installation

```bash
npm install ui-router-mobx@rc mobx
```

`@uirouter/core` and `mobx` are peer dependencies. Both MobX majors are
supported (`mobx@^6.0.0 || ^7.0.0`), and the store's API is the same on either.

## RouterStore

[`RouterStore.for(router)`](/api/ui-router-mobx/classes/RouterStore#for)
returns the router's observable store. The first call for a router creates its
one store and registers one `onSuccess` transition hook that updates it. Later
calls return the same store. The store and the hook live as long as the router.

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
| `includes(stateOrName, params?)` | an observable `StateService.includes`, globs like `'a.**'` included |

Each field is replaced per transition, never mutated, so a reaction compares
them by reference.

To manage a store yourself, call
[`attach(router)`](/api/ui-router-mobx/classes/RouterStore#attach) on a
`new RouterStore()`. It returns the hook's deregistration function, and it
throws if the store already mirrors a different router.

## Further reading

- [API reference](/api/ui-router-mobx/)
- [lit-ui-router-mobx](/packages/lit-ui-router-mobx)
- [MobX — reactions](https://mobx.js.org/reactions.html)
- [On the Altitude Atlas](https://atlas.lit-ui-router.dev/bricks/?focus=ui-router-mobx) — this package as
  a brick in sheet 2's model in the round, sized by its authored files and
  seated on what it peers
