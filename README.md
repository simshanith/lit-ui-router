# UI-Router for Lit

<img src="docs/public/images/lit-ui-router.svg" alt="Lit UI Router" width="120" height="120">

[![npm](https://img.shields.io/npm/v/lit-ui-router.svg)](https://www.npmjs.com/package/lit-ui-router)
[![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router@*)](https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[![Website](https://img.shields.io/website?url=https%3A%2F%2Flit-ui-router.dev)](https://lit-ui-router.dev)

[![Main Branch CI](https://github.com/simshanith/lit-ui-router/actions/workflows/build-test.yml/badge.svg?branch=main)](https://github.com/simshanith/lit-ui-router/actions/workflows/build-test.yml?query=branch%3Amain)
[![Tag & push (escape hatch)](https://github.com/simshanith/lit-ui-router/actions/workflows/publish-gh.yml/badge.svg?branch=main&event=workflow_dispatch)](https://github.com/simshanith/lit-ui-router/actions/workflows/publish-gh.yml?query=branch%3Amain+event%3Aworkflow_dispatch)
[![codecov](https://codecov.io/gh/simshanith/lit-ui-router/branch/main/graph/badge.svg)](https://codecov.io/gh/simshanith/lit-ui-router)

#### Published diff status

| Package                                | npm                                                                                                                                                 | Published diff                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lit-ui-router`                        | [![npm](https://img.shields.io/npm/v/lit-ui-router.svg)](https://www.npmjs.com/package/lit-ui-router)                                               | [![lit-ui-router published diff](https://img.shields.io/github/check-runs/simshanith/lit-ui-router/main?nameFilter=published-diff%20%28lit-ui-router%29&label=published-diff)](https://github.com/simshanith/lit-ui-router/actions/workflows/release-signals.yml?query=branch%3Amain)                                               |
| `lit-ui-router-mobx`                   | [![npm](https://img.shields.io/npm/v/lit-ui-router-mobx.svg)](https://www.npmjs.com/package/lit-ui-router-mobx)                                     | [![lit-ui-router-mobx published diff](https://img.shields.io/github/check-runs/simshanith/lit-ui-router/main?nameFilter=published-diff%20%28lit-ui-router-mobx%29&label=published-diff)](https://github.com/simshanith/lit-ui-router/actions/workflows/release-signals.yml?query=branch%3Amain)                                     |
| `ui-router-navigation-location-plugin` | [![npm](https://img.shields.io/npm/v/ui-router-navigation-location-plugin.svg)](https://www.npmjs.com/package/ui-router-navigation-location-plugin) | [![ui-router-navigation-location-plugin published diff](https://img.shields.io/github/check-runs/simshanith/lit-ui-router/main?nameFilter=published-diff%20%28ui-router-navigation-location-plugin%29&label=published-diff)](https://github.com/simshanith/lit-ui-router/actions/workflows/release-signals.yml?query=branch%3Amain) |

| Badge                                                                        | Color     | Meaning                                     |
| ---------------------------------------------------------------------------- | --------- | ------------------------------------------- |
| ![passing](https://img.shields.io/badge/published--diff-passing-brightgreen) | `#44bb00` | The npm release matches `main`              |
| ![passing](https://img.shields.io/badge/published--diff-passing-orange)      | `#ea7233` | Unreleased ship-affecting changes on `main` |

### lit-ui-router: State based routing for Lit (v2+)

---

lit-ui-router is a client-side [Single Page Application](https://en.wikipedia.org/wiki/Single-page_application)
routing framework for [Lit](https://lit.dev/).

Routing frameworks for SPAs update the browser's URL as the user navigates through the app. Conversely, this allows
changes to the browser's URL to drive navigation through the app, thus allowing the user to create a bookmark to a
location deep within the SPA.

UI-Router applications are modeled as a hierarchical tree of states. UI-Router provides a
[_state machine_](https://en.wikipedia.org/wiki/Finite-state_machine) to manage the transitions between those
application states in a transaction-like manner.

## Features

- **Flexible Component Definitions** - Use template functions, LitElement classes, or both
- **State-based Routing** - Hierarchical states with nested views
- **Data Resolution** - Fetch data before rendering with built-in resolve system
- **Navigation Directives** - `uiSref` and `uiSrefActive` for declarative navigation

## Get Started

- [Documentation](https://lit-ui-router.dev) - Full docs, tutorials, and API reference
- [Examples](./examples) - Try live examples on StackBlitz
- [Sample apps](./apps/README.md) - The same non-trivial app in two reactivity idioms (vanilla and MobX), compared side-by-side
- [About UI-Router](https://ui-router.github.io/about) - Core concepts

The UI-Router package is distributed using [npm](https://www.npmjs.com/), the node package manager.

```
npm install lit-ui-router
```

Import `UIRouterLit` into your project, register some states and you're good to go!

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

## Component Styles

lit-ui-router supports multiple ways to define route components:

| Style               | Best For                      | Example                    |
| ------------------- | ----------------------------- | -------------------------- |
| Template function   | Simple views, prototyping     | `` () => html`...` ``      |
| Template with props | Views needing params/resolves | `` (props) => html`...` `` |
| LitElement class    | Complex views with lifecycle  | `MyComponent`              |

### With Route Parameters

```ts
{
  name: 'user',
  url: '/user/:id',
  component: (props) => html`<h1>User ${props?.transition?.params().id}</h1>`
}
```

### With LitElement Classes

For complex components with lifecycle, state, and styles:

```ts
{ name: 'dashboard', url: '/dashboard', component: DashboardElement }
```
