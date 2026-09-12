---
title: Reactive Components
description: Keep any component in sync with the router using TransitionController
---

# Reactive Components

`<ui-view>` re-renders **routed** components automatically. But most apps
also have components _outside_ the viewport that depend on router state — a
nav header highlighting the active section, a breadcrumb trail, a user menu
that appears after login. Lit doesn't know these components care about the
router, so by default they render once and go stale.

[`TransitionController`](/api/reference/controllers/TransitionController) is
the core package's answer: a zero-dependency Lit
[ReactiveController](https://lit.dev/docs/composition/controllers/) that
calls `host.requestUpdate()` whenever a matching transition event fires.

## Basic usage

```ts
import { html, LitElement } from 'lit';
import { TransitionController } from 'lit-ui-router';

class NavHeader extends LitElement {
  private transitions = new TransitionController(this);

  render() {
    // Re-evaluated after every successful transition
    return html`
      <span>Current state: ${this.transitions.current?.name}</span>
      ${this.transitions.includes('admin.**') ? html`<admin-toolbar></admin-toolbar>` : null}
    `;
  }
}
```

No wiring is needed: on `hostConnected` the controller discovers the router
from the nearest `<ui-router>` (or `<ui-view>`) ancestor via the
`ui-router-context` event, registers its transition hooks, and deregisters
them all on `hostDisconnected` — nothing leaks when elements come and go
from the DOM.

## Reading router state

The controller exposes the essentials directly:

| Member                | What it returns                                                    |
| --------------------- | ------------------------------------------------------------------ |
| `current`             | The current `StateDeclaration` (`globals.current`)                 |
| `params`              | The current parameter values (`globals.params`)                    |
| `transition`          | The most recent observed `Transition`                              |
| `includes(state, p?)` | `StateService.includes` — supports glob patterns like `'admin.**'` |
| `router` / `globals`  | The discovered `UIRouter` instance and its globals                 |

## Scoping with criteria and callbacks

By default the controller observes every successful transition. Options
narrow that down and let you run logic before the re-render:

```ts
class UserDetail extends LitElement {
  private transitions = new TransitionController(this, {
    criteria: { to: 'users.detail' },
    callback: () => this.loadUser(this.transitions.params.userId),
  });
}
```

- `criteria` — a
  [HookMatchCriteria](https://ui-router.github.io/core/docs/latest/interfaces/transition.hookmatchcriteria.html)
  limiting which transitions notify the host (`to`, `from`, glob patterns,
  predicate functions)
- `callback` — invoked before `requestUpdate()` with the transition and the
  reason (`'onSuccess'`, `'hostConnected'`, …)
- `events` — which lifecycle events to observe; defaults to `['onSuccess']`,
  and accepts any of `'onBefore' | 'onStart' | 'onSuccess' | 'onError'`
- `router` — an explicit router instance, skipping context discovery

For `'onBefore'` and `'onStart'` events, the callback's return value is
passed back to UI-Router as a
[HookResult](https://ui-router.github.io/core/docs/latest/modules/transition.html#hookresult)
— so a controller can even cancel or redirect pending transitions.

## Reconnect safety

On every (re)connect the controller synchronizes once with the router's
current state before any new transition fires. Components that enter the DOM
_after_ navigation completed — or that are detached and re-attached, as with
[sticky states](https://github.com/ui-router/sticky-states) — render fresh
values immediately instead of waiting for the next transition.

## Active-link status

A nav link needs more than "the router moved": it needs to know whether _its_
state is the current one.
[`SrefStatusController`](/api/reference/controllers/SrefStatusController)
exposes exactly that — `active`, `exact`, `entering`, `exiting` — and leaves
the rendering to you:

```ts
import { html, LitElement } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { srefHref, SrefStatusController } from 'lit-ui-router';

class NavLink extends LitElement {
  private users = new SrefStatusController(this, { state: 'users' });

  render() {
    return html`<a
      href=${srefHref('users')}
      class=${classMap({ 'nav-link': true, active: this.users.active, disabled: this.locked })}
      aria-current=${this.users.ariaCurrent()}
      >Users</a
    >`;
  }
}
```

This is the composition path [`srefActiveClass`](/api/reference/directives/srefActiveClass)
cannot offer: a `class` attribute holds one toggling directive, so the
directive and `classMap` cannot share it. Reach for the directive when the
link's classes are all the component needs; reach for the controller when the
status is one input among several.

The controller takes the same target as the directives — `state`, `params`,
`options`, or no `state` at all to watch the `srefHref` links the host
renders — plus:

- `retarget({ state, params, options })` — point it at another state, for a
  host that takes the state as a property
- `ariaCurrent(value?)` — the `aria-current` token for the current status, or
  `nothing`; `value` accepts a token or `{ exact, active }`
- `router` — an explicit router instance, skipping context discovery. Passing
  it also computes the status in the constructor, so it is there for the very
  first render and needs no DOM at all.

Only a change in one of the four flags requests a host update, so transitions
that leave the link alone cost nothing.

## See it live

The same problem, solved with the
[MobX bindings](/packages/mobx): `<app-root>` sits outside every
`<ui-view>`, so it never receives fresh view props, and reaction controllers
keep its breadcrumb and visit counter in sync. Swap
`RouterReactionController` for `TransitionController` and the shape is
identical — a controller on the host, a value read in `render()`.

In both idioms the controllers only read. The example's one write to app
state — recording an arrival — sits in an `onSuccess` hook, because an effect
caused by navigating belongs to the navigation, not to a component watching
it.

This is the minimal version — the solar-system tutorial with a store layered
in where the router stops helping, small enough to read in one sitting. For
the full comparison, the two sample apps below build the same application
twice, once with each idiom.

<LiveExample name="hellosolarsystem-mobx" />

## See it in a real app

The <a href="/app" target="_self">vanilla sample app</a> is built on this
pattern — its
[`App`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-lit-vanilla/src/app/main/App.ts),
nav header, and message compose view each use a `TransitionController`. The
behaviorally identical <a href="/app-mobx" target="_self">MobX sample app</a>
solves the same problems with the observable store and reaction controllers
from [`lit-ui-router-mobx`](/packages/), one of the
[companion packages](/packages/) — if your app already uses MobX, prefer
[those bindings](/packages/mobx); the
[two codebases](https://github.com/simshanith/lit-ui-router/tree/main/apps)
compare the idioms file-by-file.
