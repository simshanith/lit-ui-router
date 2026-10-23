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
import { UIRouterLit, LitStateDeclaration } from 'lit-ui-router';

const router = new UIRouterLit();
router.plugin(hashLocationPlugin);

// Simple routes using template functions - no LitElement classes needed!
const states: LitStateDeclaration[] = [
  { name: 'home', url: '/home', component: () => html`<h1>Home</h1>` },
  { name: 'about', url: '/about', component: () => html`<h1>About</h1>` },
];
states.forEach((state) => router.stateRegistry.register(state));

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
  nested [`<ui-view>`](./tutorial/hellogalaxy#nested-ui-view-with-fallback-content) viewports, and
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

| Package                                                                                                 | What it is                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`lit-ui-router`](https://npmx.dev/package/lit-ui-router)                                               | The router: state machine, `<ui-router>`/`<ui-view>` elements, navigation directives, `TransitionController`. [API →](./api/reference/)                                        |
| [`lit-ui-router-mobx`](https://npmx.dev/package/lit-ui-router-mobx)                                     | [MobX](https://mobx.js.org) bindings: an observable `RouterStore` and reaction-based controllers. [Guide →](./packages/lit-ui-router-mobx)                                     |
| [`lit-ui-router-effect`](https://npmx.dev/package/lit-ui-router-effect)                                 | [Effect](https://effect.website) bindings: a `SubscriptionRef` of the route and ref-following controllers. [Guide →](./packages/lit-ui-router-effect)                          |
| [`lit-ui-router-signals`](https://npmx.dev/package/lit-ui-router-signals)                               | [TC39 Signals](https://github.com/tc39/proposal-signals) bindings: watcher-based controllers over `ui-router-signals`. [Guide →](./packages/lit-ui-router-signals)             |
| [`ui-router-navigation-location-plugin`](https://npmx.dev/package/ui-router-navigation-location-plugin) | A location plugin built on the modern browser Navigation API. [Guide →](./packages/navigation-plugin)                                                                          |
| [`ui-router-server`](https://npmx.dev/package/ui-router-server)                                         | Server-side routing verdicts at the edge — honest 404/302/200 for static SPAs (in development). [Guide →](./packages/server)                                                   |
| [`lit-ui-router-ssr`](https://npmx.dev/package/lit-ui-router-ssr)                                       | Static prerendering: a `ui-router-server` mount table in, an emitted site out. [Guide →](./packages/ssr)                                                                       |
| [`ui-router-signals`](https://npmx.dev/package/ui-router-signals)                                       | [TC39 Signals](https://github.com/tc39/proposal-signals) for UI-Router: a framework-agnostic mirror of the router's state. [Guide →](./packages/ui-router-signals)             |
| [`ui-router-effect`](https://npmx.dev/package/ui-router-effect)                                         | [Effect](https://effect.website) for UI-Router: a framework-agnostic `SubscriptionRef` of the router's state. [Guide →](./packages/ui-router-effect)                           |
| [`ui-router-mobx`](https://npmx.dev/package/ui-router-mobx)                                             | [MobX](https://mobx.js.org) for UI-Router: a framework-agnostic observable store of the router's state. [Guide →](./packages/ui-router-mobx)                                   |
| [`eslint-plugin-lit-ui-router`](https://npmx.dev/package/eslint-plugin-lit-ui-router)                   | ESLint rules that understand the router's directives — hrefless anchors, inert `href`s, `aria-current` conflicts and misplaced directives. [Guide →](./packages/eslint-plugin) |

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

### Start a project

The Hello World starter is a Vite + TypeScript app. Copy it with
[tiged](https://github.com/tiged/tiged):

```bash
npx tiged simshanith/lit-ui-router/examples/helloworld my-app
```

Then run `npm install` and `npm run dev` in `my-app`. The source is
[`examples/helloworld`](https://github.com/simshanith/lit-ui-router/tree/main/examples/helloworld)
on GitHub, and it runs in the browser on
[StackBlitz](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/helloworld?file=src%2Fmain.ts).

### Add to an existing project

Install the router with its peers, `lit` and `@uirouter/core`:

```bash
npm install lit-ui-router lit @uirouter/core
```

The app renders into a host element, `<div id="root">` in the starter's
[`index.html`](https://github.com/simshanith/lit-ui-router/blob/main/examples/helloworld/index.html).
Vite's `lit-ts` template (`npm create vite@latest my-app -- --template lit-ts`)
already sets the decorator options the tutorial uses. It also sets
`verbatimModuleSyntax`, so import types such as `LitStateDeclaration` with
`import type` or an inline `type` modifier.

Then start with the [Hello World tutorial](./tutorial/helloworld).
