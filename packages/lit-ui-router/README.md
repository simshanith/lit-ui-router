# lit-ui-router

<img src="https://lit-ui-router.dev/images/lit-ui-router.svg" alt="Lit UI Router" width="120" height="120" />

[![npm version](https://img.shields.io/npm/v/lit-ui-router.svg)](https://www.npmjs.com/package/lit-ui-router)
[![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router@*)](https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Flit-ui-router.dev)](https://lit-ui-router.dev)
[![codecov](https://codecov.io/gh/simshanith/lit-ui-router/graph/badge.svg?component=lit-ui-router)](https://app.codecov.io/gh/simshanith/lit-ui-router?components%5B0%5D=lit-ui-router)

A [UI-Router](https://ui-router.github.io/) implementation for [Lit](https://lit.dev/).

## Quick Start

```ts
import { UIRouterLit } from 'lit-ui-router';
import { hashLocationPlugin } from '@uirouter/core';
import { html } from 'lit';

const router = new UIRouterLit();
router.plugin(hashLocationPlugin);

router.stateRegistry.register([
  { name: 'home', url: '/', component: () => html`<h1>Home</h1>` },
  { name: 'about', url: '/about', component: () => html`<h1>About</h1>` },
]);

router.start();
```

## Component Styles

| Style               | Best For                      | Example                  |
| ------------------- | ----------------------------- | ------------------------ |
| Template function   | Simple views, prototyping     | `() => html\`...\``      |
| Template with props | Views needing params/resolves | `(props) => html\`...\`` |
| LitElement class    | Complex views with lifecycle  | `MyComponent`            |

## Documentation

Visit [lit-ui-router.dev](https://lit-ui-router.dev) for full documentation, tutorials, and API reference.
