---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'Lit UI Router'
  text: 'State-based routing for Lit'
  tagline: A <a href="https://ui-router.github.io/" target="_blank">UI-Router</a> implementation for <a href="https://lit.dev" target="_blank">Lit</a> web components
  actions:
    - theme: brand
      text: Get Started
      link: /tutorial/helloworld
    - theme: alt
      text: View Sample App
      link: ./app
      target: _self

features:
  - title: State-based Routing
    details: Organize your app with hierarchical states. Define URLs, components, and data requirements declaratively.
  - title: Nested Views
    details: Build complex layouts with nested ui-views. Child states render inside parent state components.
  - title: Data Resolves
    details: Fetch data before states activate. Components always have the data they need, with automatic loading states.
---
