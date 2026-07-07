---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'Lit UI Router'
  text: 'State-based routing for Lit'
  image:
    src: /images/lit-ui-router.svg
    alt: Lit UI Router
  tagline: |
    A <a href="https://ui-router.github.io/" target="_blank" class="library"><img src="/images/ui-router.svg" width="24" height="24" alt="UI Router">UI-Router</a> implementation for <a href="https://lit.dev" target="_blank" class="library"><img src="/images/lit-flame.svg" width="24" height="24" alt="Lit">Lit</a> web components
    <a href="https://www.npmjs.com/package/lit-ui-router" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/lit-ui-router" /></a> <a href="https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router@*" /></a>
  actions:
    - theme: brand
      text: Get Started
      link: /introduction
    - theme: alt
      text: View Sample App
      link: ./app
      target: _self

features:
  - title: State-based Routing
    icon:
      src: /images/lit-lightning.svg
      alt: ⚡
      width: 40
      height: 40
    details: Organize your app with hierarchical states. Define URLs, components, and data requirements declaratively.
  - title: Nested Views
    icon:
      src: /images/lit-standards.svg
      alt: 📋
      width: 40
      height: 40
    details: Build complex layouts with nested ui-views. Child states render inside parent state components.
  - title: Data Resolves
    icon:
      src: /images/lit-future.svg
      alt: ✨
      width: 40
      height: 40
    details: Fetch data before states activate. Components always have the data they need, with automatic loading states.
---

## Routing in a nutshell

States declare a name, a URL, and a Lit component — an inline template
function or a full `LitElement` class:

```ts
import { render, html } from 'lit';
import { hashLocationPlugin } from '@uirouter/core';
import { UIRouterLit } from 'lit-ui-router';

const router = new UIRouterLit();
router.plugin(hashLocationPlugin);

router.stateRegistry.register([
  { name: 'home', url: '/home', component: () => html`<h1>Home</h1>` },
  {
    name: 'user',
    url: '/user/:id',
    component: (props) => html`<h1>User ${props?.transition?.params().id}</h1>`,
  },
]);

router.start();

render(
  html`<ui-router .uiRouter=${router}>
    <ui-view></ui-view>
  </ui-router>`,
  document.getElementById('root')!,
);
```

New to UI-Router? Start with the [Introduction](/introduction), then build
your first app with the three-part [tutorial](/tutorial/helloworld) — every
step runs live on StackBlitz.

## The packages

| Package                                                            | What it adds                                                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| [`lit-ui-router`](/api/reference/)                                 | The router: states, transitions, resolves, `<ui-router>`/`<ui-view>`, navigation directives     |
| [`lit-ui-router-mobx`](/guide/mobx)                                | [MobX](https://mobx.js.org) bindings: an observable router store and reaction-based controllers |
| [`ui-router-navigation-location-plugin`](/guide/navigation-plugin) | Experimental location plugin built on the modern browser Navigation API                         |

And because it's a [`@uirouter/core`](https://ui-router.github.io/) implementation, ecosystem plugins like
[sticky states](https://github.com/ui-router/sticky-states),
[deep state redirect](https://github.com/ui-router/dsr), and the
[visualizer](https://github.com/ui-router/visualizer) work too — see them all
in action in the <a href="/app" target="_self">sample app</a>.
