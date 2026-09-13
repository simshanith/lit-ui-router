---
title: Effect Bindings
description: A SubscriptionRef of the route and ref-following Lit controllers with lit-ui-router-effect
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
components in sync with it — and with any other `SubscriptionRef` the
application holds.

It is a thin wrapper on top of `lit-ui-router` — it registers no custom
elements and adds no routing behavior. If your application already keeps its
state in Effect refs, these bindings let route state participate in the same
system, with automatic `requestUpdate()` and no manual refresh plumbing.

::: warning Release candidate
The package publishes on a `0.1.0-rc` line while the
[atlas](https://github.com/simshanith/lit-ui-router/issues/843) adopts it as
its second consumer. The API below is live and covered by tests; the surface
freezes at `0.1.0` once that adoption has exercised it.
:::

::: tip Not using Effect?
You don't need this package to react to route changes. The core package's
zero-dependency
[`TransitionController`](/api/reference/controllers/TransitionController)
covers the same ground with transition hooks instead of refs.
:::

## Installation

```bash
npm install lit-ui-router-effect effect
# or
pnpm add lit-ui-router-effect effect
```

`lit-ui-router`, `lit`, `effect`, and `@uirouter/core` are peer dependencies.

## Quick start

```ts
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
the enclosing `<ui-router>` element when the host connects, and the route ref
lazily attaches its single transition hook on first use.

## The pieces

### routeRef

[`routeRef(router)`](/api/lit-ui-router-effect/functions/routeRef) is the
`SubscriptionRef<RouteSnapshot>` for a router — memoized, one per router
instance. The first call registers one `transitionService.onSuccess` hook that
replaces the value per successful transition.

A [`RouteSnapshot`](/api/lit-ui-router-effect/interfaces/RouteSnapshot) is a
value taken once per successful transition. Every member answers for that
moment, so a selector asking during a later transition gets the settled
answer, not the in-flight one.

| Member                      | Description                                                                  |
| --------------------------- | ---------------------------------------------------------------------------- |
| `current`                   | The current `StateDeclaration` (`globals.current`)                           |
| `params`                    | The current `RawParams` (`globals.params`), a fresh object per transition    |
| `transition`                | The transition that produced the snapshot                                    |
| `includes(stateOrName, p?)` | `StateService.includes` evaluated against the snapshot (globs like `'a.**'`) |

### RouterRefController

[`RouterRefController`](/api/lit-ui-router-effect/classes/RouterRefController)
follows the route ref of the host's `<ui-router>` context:

```ts
new RouterRefController(host, selector, options?)
```

- `selector: (route: RouteSnapshot) => T` — the selected expression; the
  result is exposed as `.value`
- `options.router` — explicit router instance, skipping context discovery;
  the route is then read at construction, so `.value` is live before the host
  connects
- `options.onChange` — effect invoked when the selected value changes (and
  once on every (re)connect); useful for resetting component state from route
  params
- `options.equals` — comparer for precise, value-based change detection
  (`Equal.equals` for `Data` values, or any `(a, b) => boolean`); defaults to
  `Object.is`
- `options.initialValue` — the value `.value` carries before the router is
  discovered: before `hostConnected`, and while a host has no router context
- `options.runtime` — the runtime the subscription fiber is forked on;
  defaults to Effect's default runtime, and a `ManagedRuntime` satisfies it
  directly

### RefController

[`RefController`](/api/lit-ui-router-effect/classes/RefController) is the
generic primitive behind `RouterRefController` — the same selector/options
contract over **any** `SubscriptionRef`s, not just the router's:

```ts
import { Data, Equal } from 'effect';
import { RefController } from 'lit-ui-router-effect';

class NavHeader extends LitElement {
  private auth = new RefController(
    this,
    [Session.user$, Session.loggedIn$],
    (user, loggedIn) => Data.struct({ user, loggedIn }),
    { equals: Equal.equals },
  );

  render() {
    const { user, loggedIn } = this.auth.value;
    // ...
  }
}
```

The refs are a tuple and the selector receives their values positionally. Pass
a thunk instead (`() => [ref]`) for refs that depend on the host's place in
the DOM; it is resolved on every `hostConnected`, and `.value` carries
`options.initialValue` until then.

## Lifecycle safety

Each controller runs one fiber — `Stream.runForEach` over the refs' `changes`
— forked in `hostConnected` and interrupted in `hostDisconnected`, so it lives
exactly as long as the host is in the document. The value is also re-read
synchronously on every (re)connect, so components that re-enter the DOM — for
example under
[sticky states](https://github.com/ui-router/sticky-states) — never render
stale values.

Refs given directly are read once more at construction, so `.value` is live
before the host ever connects: a host rendered on the server sees the same
value a browser would.

## Development and production builds

Like `lit-ui-router`, this package ships two builds and bundlers pick between
them through the `development` export condition — see
[Development & Production Builds](/guides/development-builds) for the mechanism
and the full warning inventory across packages.

One warning exists here. A `RouterRefController` whose host has no
`<ui-router>` ancestor logs a one-time console warning naming that host, and
then follows nothing: `.value` stays at `options.initialValue` and the host is
never asked to update, so the component renders once with its initial value and
never again. Wrap the subtree in `<ui-router>`, or pass the router yourself with
`options.router` for a host that lives outside the router's DOM.

## Why selectors instead of render auto-tracking?

The controllers here are the composition-friendly alternative to a base class
that reads refs during `render()`:

- No base class required — controllers attach to any `LitElement` (or any
  `ReactiveControllerHost`)
- Dependencies are explicit: the refs tuple names exactly which state drives
  the host
- `equals: Equal.equals` avoids re-renders when a recomputed `Data` value is
  structurally unchanged
- The fiber's lifetime is bound to the host's connection lifecycle
  automatically

## Resolves stay on view props

The route ref mirrors `current`, `params` and `transition` — not resolves.
Resolved data reaches a routed component exactly as it does without these
bindings: as [`UIViewInjectedProps`](/api/reference/types/UIViewInjectedProps)
on `_uiViewProps`, scoped to that component's own view.

There is no resolve accessor on the snapshot, and
`route.transition.injector().get(token)` is not a substitute: that is the
transition's _root_ injector, not the view's resolve context, so it resolves
a different token set than the component's own view sees.

The split the Effect sample app follows:

- resolved data → `_uiViewProps.resolves`
- active state, and anything that outlives a single activation → a
  `SubscriptionRef`, selected by ref controllers

## See it in a real app

The <a href="/app-effect" target="_self">Effect sample app</a> is a complete
application built on these controllers. It is behaviorally identical to the
<a href="/app" target="_self">vanilla sample app</a> (which uses
`TransitionController`) and the
<a href="/app-mobx" target="_self">MobX sample app</a>, so the
[three codebases](https://github.com/simshanith/lit-ui-router/tree/main/apps)
can be compared file-by-file to see exactly what the Effect idiom changes.

## Further reading

- [API reference](/api/lit-ui-router-effect/)
- [Effect — SubscriptionRef](https://effect.website/docs/state-management/subscriptionref/)
- [Lit — Reactive Controllers](https://lit.dev/docs/composition/controllers/)
