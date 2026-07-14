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

## See it in a real app

The <a href="/app" target="_self">vanilla sample app</a> is built on this
pattern — its
[`App`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-lit-vanilla/src/app/main/App.ts),
nav header, and message compose view each use a `TransitionController`. The
behaviorally identical <a href="/app-mobx" target="_self">MobX sample app</a>
solves the same problems with the observable store and reaction controllers
from [`lit-ui-router-mobx`](/packages/), one of the
[companion packages](/packages/) — if your app already uses MobX, prefer
[those bindings](/guides/mobx); the
[two codebases](https://github.com/simshanith/lit-ui-router/tree/main/apps)
compare the idioms file-by-file.
