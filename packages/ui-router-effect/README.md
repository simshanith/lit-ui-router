# ui-router-effect

[Effect](https://effect.website) bindings for [UI-Router](https://ui-router.github.io): a framework-agnostic `SubscriptionRef` of the router's current state. It imports only `effect` and `@uirouter/core`.

Not yet published; its first release is `0.1.0`. [`lit-ui-router-effect`](../lit-ui-router-effect/) holds the Lit controllers.

## Features

- **`routeRef(router)`**: a `SubscriptionRef<RouteSnapshot>` of the current state, params and transition. There is one ref, and one `onSuccess` hook, per router, attached lazily on first use. Every value it holds is a settled route.
- **`RouteSnapshot`** and **`snapshotRoute(router, transition?)`**: the value the ref holds. Its `includes()` evaluates `StateService.includes` against the snapshot, not the live router.

`RouteSnapshot` and `snapshotRoute` are a build-time copy of [`packages/shared/route-snapshot`](../shared/route-snapshot/).

## Usage

```typescript
import { Effect, Stream } from 'effect';
import { routeRef } from 'ui-router-effect';

const names = routeRef(router).changes.pipe(
  Stream.map((route) => route.current?.name),
  Stream.changes,
);

Effect.runFork(Stream.runForEach(names, (name) => Effect.log(name)));
```

## Dependencies

`@uirouter/core` and `effect` are peer dependencies. `lit` and `lit-ui-router` are not, and the `bundleProbe` claim in `package.json` holds the entry free of them.
