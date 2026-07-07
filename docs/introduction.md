---
title: Introduction
description: What is Lit UI Router? State-based routing for Lit web components
---

# What is Lit UI Router?

**lit-ui-router** is a client-side routing framework for
[Lit](https://lit.dev) web components. It is an implementation of
[UI-Router](https://ui-router.github.io/), the state-based router that has
powered large AngularJS, Angular, and React applications for over a decade —
built directly on the framework-agnostic
[`@uirouter/core`](https://github.com/ui-router/core).

```ts
import { render, html } from 'lit';
import { hashLocationPlugin } from '@uirouter/core';
import { UIRouterLit } from 'lit-ui-router';

const router = new UIRouterLit();
router.plugin(hashLocationPlugin);

// Simple routes using template functions - no LitElement classes needed!
router.stateRegistry.register([
  { name: 'home', url: '/home', component: () => html`<h1>Home</h1>` },
  { name: 'about', url: '/about', component: () => html`<h1>About</h1>` },
]);

router.start();

render(
  html`<ui-router .uiRouter=${router}>
    <ui-view></ui-view>
  </ui-router>`,
  document.getElementById('root')!,
);
```

## Why state-based routing?

Most routers map **URLs to components**. UI-Router instead models your
application as a **hierarchical tree of states**, where each state may carry a
URL, a component, parameters, and data requirements. The URL is a serialization
of the active state — not the other way around.

This inversion pays off as applications grow:

- **Transitions are transactions.** Navigating from one state to another
  either fully succeeds or is rolled back. A half-loaded page is never shown.
- **Data arrives before the view.** [Resolves](./tutorial/hellosolarsystem#resolve-data)
  fetch data during the transition, so components render with their data
  already available — no loading-state plumbing in every view.
- **Hierarchy is first-class.** Child states render inside parent states via
  nested [`<ui-view>`](./tutorial/hellogalaxy#nested-ui-view) viewports, and
  inherit their parents' parameters and resolved data.
- **Navigation is interceptable.** Transition hooks implement cross-cutting
  concerns like authentication guards, analytics, and redirects in one place.
- **States don't need URLs.** Dialogs, wizards, and error views (like a
  [404 state](./guides/unmatched-urls)) can participate in routing without
  claiming an address.

## What lit-ui-router adds

`@uirouter/core` provides the state machine, URL handling, transitions, and
resolves. `lit-ui-router` layers the Lit integration on top:

- **`UIRouterLit`** — a `UIRouter` subclass that teaches the view system to
  render Lit templates and elements
- **`<ui-router>` and `<ui-view>`** — custom elements providing router context
  and rendering viewports
- **`uiSref` / `uiSrefActive`** — Lit directives for declarative navigation
  links and active-link styling
- **Flexible components** — define a routed view as an inline template
  function, a template with injected props, or a full `LitElement` class
- **`TransitionController`** — a zero-dependency
  [ReactiveController](https://lit.dev/docs/composition/controllers/) that
  keeps any component synchronized with router transitions

## The packages

This repository publishes a small family of packages. The core router is all
you need to start; the companions are optional layers.

| Package                                                                                                      | What it is                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| [`lit-ui-router`](https://www.npmjs.com/package/lit-ui-router)                                               | The router: state machine, `<ui-router>`/`<ui-view>` elements, navigation directives, `TransitionController`. [API →](./api/reference/) |
| [`lit-ui-router-mobx`](https://www.npmjs.com/package/lit-ui-router-mobx)                                     | [MobX](https://mobx.js.org) bindings: an observable `RouterStore` and reaction-based controllers. [Guide →](./guides/mobx)               |
| [`ui-router-navigation-location-plugin`](https://www.npmjs.com/package/ui-router-navigation-location-plugin) | An experimental location plugin built on the modern browser Navigation API. [Guide →](./guides/navigation-plugin)                        |

Because lit-ui-router is a `@uirouter/core` implementation, the wider
UI-Router plugin ecosystem works too. The <a href="/app" target="_self">sample
app</a> uses [`@uirouter/sticky-states`](https://github.com/ui-router/sticky-states),
[`@uirouter/dsr`](https://github.com/ui-router/dsr) (deep state redirect), and
the [`@uirouter/visualizer`](https://github.com/ui-router/visualizer) developer
tool.

## How these docs are organized

- **[Tutorial](./tutorial/helloworld)** — a three-part introduction: states
  and links ([Hello World](./tutorial/helloworld)), resolves and parameters
  ([Hello Solar System](./tutorial/hellosolarsystem)), nested states and views
  ([Hello Galaxy](./tutorial/hellogalaxy)). Each step runs live on StackBlitz.
- **[Guides](./guides/)** — focused, task-oriented pages on URLs and location,
  transitions and guards, and reactivity.
- **[API](./api/)** — an overview plus complete generated references for all
  three packages.
- **Sample apps** — the same non-trivial application written twice, in
  <a href="/app" target="_self">vanilla Lit</a> and
  <a href="/app-mobx" target="_self">MobX</a> idioms, with authentication,
  lazy loading, sticky states, and 404 handling.
  The [source](https://github.com/simshanith/lit-ui-router/tree/main/apps)
  compares the two reactivity styles file-by-file.

## Getting started

Install from npm:

```bash
npm install lit-ui-router
# or
pnpm add lit-ui-router
```

Then start with the [Hello World tutorial](./tutorial/helloworld).
