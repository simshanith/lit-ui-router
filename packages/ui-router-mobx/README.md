# ui-router-mobx

[![codecov](https://codecov.io/gh/simshanith/lit-ui-router/graph/badge.svg?component=ui-router-mobx)](https://app.codecov.io/gh/simshanith/lit-ui-router?components%5B0%5D=ui-router-mobx)

[MobX](https://mobx.js.org) bindings for [UI-Router](https://ui-router.github.io): a framework-agnostic observable store of the router's current state. It imports only `mobx` and `@uirouter/core`.

Not yet published; its first release is `0.1.0`. [`lit-ui-router-mobx`](../lit-ui-router-mobx/) holds the Lit controllers.

## Features

- **`RouterStore.for(router)`**: the observable store for a router. There is one store, and one `onSuccess` hook, per router, attached lazily on first use.
- **`current`, `params` and `transition`**: the current state declaration, a fresh plain copy of the params, and the most recent successful transition. Each is replaced per transition, never mutated, so reactions compare them by reference.
- **`includes(stateOrName, params?)`**: an observable `StateService.includes`, glob patterns such as `'admin.**'` included.
- **`attach(router)`**: for managing a `new RouterStore()` yourself. It returns the hook's deregistration function and throws if the store already mirrors a different router.

## Usage

Any MobX `reaction`, `autorun` or `computed` that reads the store re-runs when the values it reads change, with no transition hooks of its own:

```typescript
import { reaction } from 'mobx';
import { RouterStore } from 'ui-router-mobx';

const store = RouterStore.for(router);

const dispose = reaction(
  () => store.includes('admin.**'),
  (inAdmin) => console.log(inAdmin ? 'entered admin' : 'left admin'),
);
```

### MobX 6 and 7

Both majors are supported (`mobx@^6.0.0 || ^7.0.0`) and both are exercised in CI. The store's own API is identical on either.

## Dependencies

`@uirouter/core` and `mobx` are peer dependencies. `lit` and `lit-ui-router` are not, and the `bundleProbe` claim in `package.json` holds the entry free of them.
