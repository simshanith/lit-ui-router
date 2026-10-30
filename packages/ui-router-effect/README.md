# ui-router-effect

[![codecov](https://codecov.io/gh/simshanith/lit-ui-router/graph/badge.svg?component=ui-router-effect)](https://app.codecov.io/gh/simshanith/lit-ui-router?components%5B0%5D=ui-router-effect)

[Effect](https://effect.website) bindings for [UI-Router](https://ui-router.github.io): a framework-agnostic `SubscriptionRef` of the router's current state. It imports only `effect` and `@uirouter/core`.

[`lit-ui-router-effect`](../lit-ui-router-effect/) builds Lit controllers on it and re-exports `routeRef`.

## Installation

```bash
npm install ui-router-effect effect
```

## Features

- **`routeRef(router)`**: a `SubscriptionRef<TypedRouteSnapshot>` of the current state, params and transition. There is one ref, and one `onSuccess` hook, per router, attached lazily on first use. Every value it holds is a settled route.
- **`RouteSnapshot`** and **`snapshotRoute(router, transition?)`**: the value the ref holds. Its `includes()` evaluates `StateService.includes` against the snapshot, not the live router.
- **`RouteTypes`**: an empty interface an app or a registry fills in by module augmentation. Its `snapshot` member types the ref's value, so a snapshot whose `includes(name)` is a type predicate narrows `current` and `params`. Empty, the ref holds a `RouteSnapshot`. `snapshotRoute` stays untyped.

## Usage

```typescript
import { Effect, Stream, SubscriptionRef } from 'effect';
import { routeRef } from 'ui-router-effect';

const names = SubscriptionRef.changes(routeRef(router)).pipe(
  Stream.map((route) => route.current?.name),
  Stream.changes,
);

Effect.runFork(Stream.runForEach(names, (name) => Effect.log(name)));
```

## Dependencies

`@uirouter/core` and `effect` are peer dependencies. `lit` and `lit-ui-router` are not, and the `bundleProbe` claim in `package.json` holds the entry free of them.
