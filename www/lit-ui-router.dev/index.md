---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'Lit UI Router'
  text: 'State-based routing for Lit'
  image:
    src: /images/lit-ui-router.svg
    alt: Lit UI Router
  tagline: >-
    A <a href="https://ui-router.github.io/" target="_blank" class="library"><img src="/images/ui-router.svg" width="24" height="24" alt="">UI-Router</a> implementation for <a href="https://lit.dev" target="_blank" class="library"><img src="/images/lit-flame.svg" width="24" height="24" alt="">Lit</a> web components
  actions:
    - theme: brand
      text: Get Started
      link: /introduction
    - theme: alt
      text: View Sample App
      link: ./app
      target: _self

positioning: >-
  Start minimal with simple, plain Lit templates and scale cleanly to non-trivial apps without switching routers. Built on <code>@uirouter/core</code>, the same engine behind UI-Router for Angular and React.

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
    details: By default, transitions wait for data before activating a state. Components render with data ready, and a failed fetch stops navigation.
---
