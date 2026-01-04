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
    <a href="https://www.npmjs.com/package/lit-ui-router" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/lit-ui-router" /></a> <a href="https://github.com/simshanith/lit-ui-router/releases/latest" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router" /></a>
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
