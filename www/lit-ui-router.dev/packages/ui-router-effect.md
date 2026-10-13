---
title: UI-Router Effect
description: A framework-agnostic Effect SubscriptionRef of the router's current state with ui-router-effect
---

# ui-router-effect

<p class="badges">
<a href="https://npmx.dev/package/ui-router-effect" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/ui-router-effect" /></a>
<a href="https://github.com/simshanith/lit-ui-router/releases/?q=ui-router-effect" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-effect@*" /></a>
</p>

[`ui-router-effect`](https://npmx.dev/package/ui-router-effect) provides
[Effect](https://effect.website) bindings for a `@uirouter/core` router: a
[`SubscriptionRef`](https://effect.website/docs/state-management/subscriptionref/)
of its current state. It imports only `effect` and `@uirouter/core`, so any
Effect program can follow route state without Lit. The
[Lit controllers](/packages/effect) live in `lit-ui-router-effect`.

## Installation

```bash
npm install ui-router-effect@rc effect
# or
pnpm add ui-router-effect@rc effect
```

`@uirouter/core` and `effect` are peer dependencies. Both Effect majors are
supported (`effect@^3.22.0 || ^4.0.2`).

## routeRef

`routeRef(router)` returns a `SubscriptionRef` of the router's current route.
There is one ref, and one `onSuccess` transition hook, per router, attached
lazily on first use, so every value it holds is a settled route.

```ts
import { Effect, Stream } from 'effect';
import { routeRef } from 'ui-router-effect';

const names = routeRef(router).changes.pipe(
  Stream.map((route) => route.current?.name),
  Stream.changes,
);

Effect.runFork(Stream.runForEach(names, (name) => Effect.log(name)));
```

## RouteSnapshot

The ref holds a `RouteSnapshot`: the current state declaration, params and
transition. `snapshotRoute(router, transition?)` builds one directly. Its
`includes()` evaluates `StateService.includes` against the snapshot, not the
live router.

## Further reading

- [lit-ui-router-effect](/packages/effect)
- [Effect — SubscriptionRef](https://effect.website/docs/state-management/subscriptionref/)
