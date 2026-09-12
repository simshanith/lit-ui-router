---
title: Effect Bindings
description: A SubscriptionRef of the route and ref-following controllers with lit-ui-router-effect
---

# lit-ui-router-effect

<p class="badges">
<a href="https://npmx.dev/package/lit-ui-router-effect" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/lit-ui-router-effect" /></a>
<a href="https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router-effect" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router-effect@*" /></a>
</p>

[`lit-ui-router-effect`](https://npmx.dev/package/lit-ui-router-effect)
provides [Effect](https://effect.website) bindings for lit-ui-router: a
[`SubscriptionRef`](https://effect.website/docs/state-management/subscriptionref/)
of the router's state and ref-following
[ReactiveControllers](https://lit.dev/docs/composition/controllers/) that keep
components in sync with it.

It is a thin wrapper on top of `lit-ui-router` — it registers no custom
elements and adds no routing behavior. If your application already keeps its
state in Effect refs, these bindings let route state participate in the same
system, with automatic `requestUpdate()` and no manual refresh plumbing.

::: tip Not using Effect?
You don't need this package to react to route changes. The core package's
zero-dependency
[`TransitionController`](/api/reference/controllers/TransitionController)
covers the same ground with transition hooks instead of refs.
:::

## Installation

::: code-group

```bash [npm]
npm install lit-ui-router-effect effect
```

```bash [pnpm]
pnpm add lit-ui-router-effect effect
```

```bash [yarn]
yarn add lit-ui-router-effect effect
```

:::

`lit-ui-router`, `lit`, `effect`, and `@uirouter/core` are peer dependencies.

## Quick start

```typescript
import { html, LitElement } from 'lit';
import { Data, Equal } from 'effect';
import { RouterRefController } from 'lit-ui-router-effect';

class AppNav extends LitElement {
  // Re-renders only when a section's visibility actually flips —
  // not on every transition. Data.struct gives the selection value
  // equality, so Equal.equals compares it structurally.
  private active = new RouterRefController(
    this,
    (route) =>
      Data.struct({
        inbox: route.includes('inbox.**'),
        contacts: route.includes('contacts.**'),
      }),
    { equals: Equal.equals },
  );

  render() {
    return html`...${this.active.value.inbox ? 'Inbox is open' : ''}...`;
  }
}
```

No router configuration is required: the controller discovers the router from
the enclosing `<ui-router>` element on `hostConnected`, and
[`routeRef(router)`](/api/lit-ui-router-effect/functions/routeRef) lazily
attaches the ref's single transition hook on first use.

## The route ref

[`routeRef(router)`](/api/lit-ui-router-effect/functions/routeRef) returns the
`SubscriptionRef<RouteSnapshot>` for a router — memoized, one per router
instance. Its value is a
[`RouteSnapshot`](/api/lit-ui-router-effect/interfaces/RouteSnapshot): the
current state, params, and transition, replaced as a whole on every successful
transition.

`includes()` is part of the snapshot too. It evaluates `StateService.includes`
against the snapshot's state and params rather than reading the live router,
so a selector asking during a later transition gets the settled answer, not
the in-flight one — the same question at the same snapshot always gets the
same answer.

## Controllers

[`RouterRefController`](/api/lit-ui-router-effect/classes/RouterRefController)
follows the route ref of the host's `<ui-router>` context.
[`RefController`](/api/lit-ui-router-effect/classes/RefController) is the
generic primitive underneath it: the same selector and options over any tuple
of `SubscriptionRef`s, with the selector receiving their values positionally.

```typescript
import { Data, Equal } from 'effect';
import { RefController } from 'lit-ui-router-effect';

class NavHeader extends LitElement {
  private auth = new RefController(
    this,
    [Session.user$, Session.loggedIn$],
    (user, loggedIn) => Data.struct({ user, loggedIn }),
    { equals: Equal.equals },
  );
}
```

Both share one lifecycle: a single fiber per controller, forked in
`hostConnected` and interrupted in `hostDisconnected`, with the value re-read
synchronously on every (re)connect so a sticky routed component that re-enters
the DOM renders current state. `onChange` fires on each (re)connect and on
each change; `equals` (default `Object.is`) decides what counts as a change.

Refs given directly are read once more at construction, so `.value` is live
before the host ever connects — a host rendered on the server sees the same
value a browser would. Refs resolved on connect (the router's, discovered from
the DOM) carry `initialValue` until then; pass `router` explicitly to read the
route at construction instead.

### Runtime

The subscription fiber is forked on Effect's default runtime unless
`options.runtime` names another. A
[`ManagedRuntime`](https://effect.website/docs/runtime/#managedruntime)
satisfies the option directly, so an app with real layers keeps every fiber on
the runtime it already owns.

## Development and production builds

`dist/development/index.js` is published alongside `dist/index.js` and picked
by the `development` export condition; production builds get the default. See
the [Development & Production Builds guide](/guides/development-builds).

The development build adds one warning: a `RouterRefController` whose host has
no `<ui-router>` ancestor warns once, naming that host, and follows nothing.
Wrap the subtree in `<ui-router>`, or pass `options.router`.

## Sample app

The [Effect sample app](/app-effect){target="_self"} is the reference
integration: app state in `SubscriptionRef`s, components following them
through these controllers, side by side with the vanilla and MobX flavors of
the same app.

## API reference

The full [lit-ui-router-effect API](/api/lit-ui-router-effect/) is generated
from the source.
