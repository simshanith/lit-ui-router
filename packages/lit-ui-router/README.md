# lit-ui-router

<img src="https://lit-ui-router.dev/images/lit-ui-router.svg" alt="Lit UI Router" width="120" height="120" />

[![npm version](https://img.shields.io/npm/v/lit-ui-router.svg)](https://www.npmjs.com/package/lit-ui-router)
[![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router@*)](https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Flit-ui-router.dev)](https://lit-ui-router.dev)
[![codecov](https://codecov.io/gh/simshanith/lit-ui-router/graph/badge.svg?component=lit-ui-router)](https://app.codecov.io/gh/simshanith/lit-ui-router?components%5B0%5D=lit-ui-router)

A [UI-Router](https://ui-router.github.io/) implementation for [Lit](https://lit.dev/).

## Quick Start

```ts
import { UIRouterLit, LitStateDeclaration } from 'lit-ui-router';
import { hashLocationPlugin } from '@uirouter/core';
import { html } from 'lit';

const router = new UIRouterLit();
router.plugin(hashLocationPlugin);

const states: LitStateDeclaration[] = [
  { name: 'home', url: '/', component: () => html`<h1>Home</h1>` },
  { name: 'about', url: '/about', component: () => html`<h1>About</h1>` },
];
states.forEach((state) => router.stateRegistry.register(state));

router.start();
```

## Entry Points

| Import                                     | Effect                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `import { ... } from 'lit-ui-router'`      | Full API. Any value import registers the `<ui-router>`/`<ui-view>` custom elements as a side effect.        |
| `import { ... } from 'lit-ui-router/pure'` | The same full API — element classes included — with no registration and no `HTMLElementTagNameMap` globals. |
| `import 'lit-ui-router/register'`          | Registration only: defines `<ui-router>`/`<ui-view>` and carries their `HTMLElementTagNameMap` entries.     |
| `import 'lit-ui-router/ui-view.register'`  | Single-element registration: defines just that element with its tag-map entry (`ui-router.register` ditto). |
| `import type { ... } from 'lit-ui-router'` | Types are erased at compile time — always free, from any entry.                                             |

The root entry is exactly `pure` + `register`: reach for `lit-ui-router/pure`
when you need the APIs (or the element classes themselves, e.g. for scoped
registries or custom tag names) without touching the global registry, and pair
it with `lit-ui-router/register` — or a single `*.register` entry — to opt
into registration explicitly.

## Component Styles

| Style               | Best For                      | Example                    |
| ------------------- | ----------------------------- | -------------------------- |
| Template function   | Simple views, prototyping     | `` () => html`...` ``      |
| Template with props | Views needing params/resolves | `` (props) => html`...` `` |
| LitElement class    | Complex views with lifecycle  | `MyComponent`              |

## Reacting to Transitions

Any element (routed or not) can stay synchronized with the router using the
`TransitionController` reactive controller. It registers transition hooks when
the host connects, calls `host.requestUpdate()` on matching transitions, and
deregisters everything when the host disconnects — no manual `requestUpdate()`
plumbing or leaked hooks.

```ts
import { TransitionController } from 'lit-ui-router';

class NavHeader extends LitElement {
  private transitions = new TransitionController(this);

  render() {
    // Re-evaluated after every successful transition
    return html`Current state: ${this.transitions.current?.name}`;
  }
}
```

Scope it to specific states or react to parameter changes with a callback:

```ts
class UserDetail extends LitElement {
  private transitions = new TransitionController(this, {
    criteria: { to: 'users.detail' },
    callback: () => this.loadUser(this.transitions.params.userId),
  });
}
```

## Documentation

Visit [lit-ui-router.dev](https://lit-ui-router.dev) for full documentation, tutorials, and API reference.
