# UI-Router for Lit

[![Main Branch CI](https://github.com/simshanith/lit-ui-router/actions/workflows/build-test.yml/badge.svg?branch=main)](https://github.com/simshanith/lit-ui-router/actions/workflows/build-test.yml?query=branch%3Amain)
[![npm](https://img.shields.io/npm/v/lit-ui-router.svg)](https://www.npmjs.com/package/lit-ui-router)
[![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router)](https://github.com/simshanith/lit-ui-router/releases/latest)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Flit-ui-router.dev)](https://lit-ui-router.dev)
[![codecov](https://codecov.io/gh/simshanith/lit-ui-router/branch/main/graph/badge.svg)](https://codecov.io/gh/simshanith/lit-ui-router)


### lit-ui-router: State based routing for Lit (v2+)

---

lit-ui-router is a client-side [Single Page Application](https://en.wikipedia.org/wiki/Single-page_application)
routing framework for [lit](https://lit.dev/).

Routing frameworks for SPAs update the browser's URL as the user navigates through the app. Conversely, this allows
changes to the browser's URL to drive navigation through the app, thus allowing the user to create a bookmark to a
location deep within the SPA.

UI-Router applications are modeled as a hierarchical tree of states. UI-Router provides a
[_state machine_](https://en.wikipedia.org/wiki/Finite-state_machine) to manage the transitions between those
application states in a transaction-like manner.

## Get Started

- [About UI-Router](https://ui-router.github.io/about)
- [Examples](./examples) - Try live examples on StackBlitz

The UI-Router package is distributed using [npm](https://www.npmjs.com/), the node package manager.

```
yarn add lit-ui-router
```

Import `UIRouterLit` into your project, register some states and you're good to go!

```js
import { render, html } from 'lit';
import { hashLocationPlugin } from '@uirouter/core';
import { UIRouterLit } from 'lit-ui-router';
import Home from './components/Home';

// define your states
const states = [
  {
    name: 'home',
    url: '/home',
    component: Home,
  },
];

const uiRouter = new UIRouterLit();
uiRouter.plugin(hashLocationPlugin);
states.forEach((state) => uiRouter.stateRegistry.register(state));

render(
  html`<ui-router .uiRouter=${uiRouter}>
    <ui-view></ui-view>
  </ui-router>`,
  document.getElementById('root'),
);
```
