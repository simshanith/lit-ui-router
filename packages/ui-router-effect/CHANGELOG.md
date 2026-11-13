# Changelog

Prereleases and canaries are not listed here; see [all releases on GitHub](https://github.com/simshanith/lit-ui-router/releases?q=ui-router-effect%40&expanded=true).

## 0.3.0 (2026-11-01)

### Features

* **ui-router-effect:** expose the last failed transition's rejection as a SubscriptionRef ([#1794](https://github.com/simshanith/lit-ui-router/issues/1794)) ([0a3eb1e](https://github.com/simshanith/lit-ui-router/commit/0a3eb1e43b95a6a7ea54ffe7fb0d0fe4b8501ac1))
* **ui-router-effect:** expose the pending transition as a SubscriptionRef ([#1786](https://github.com/simshanith/lit-ui-router/issues/1786)) ([8e9da60](https://github.com/simshanith/lit-ui-router/commit/8e9da607b6730d01b0e62ee76de40d901a0485c3))
* **ui-router-signals:** expose the last failed transition's rejection as a signal ([#1793](https://github.com/simshanith/lit-ui-router/issues/1793)) ([c302090](https://github.com/simshanith/lit-ui-router/commit/c3020907fbb587bbf2cf925505a08d5d670e098d))

### Documentation

* fix the ui-router-effect README's changes stream and declare NavLink's locked property ([#1665](https://github.com/simshanith/lit-ui-router/issues/1665)) ([21b660c](https://github.com/simshanith/lit-ui-router/commit/21b660cdc1c9ae29c4b63e0f015fb922ca1d54b6)), references [#1663](https://github.com/simshanith/lit-ui-router/issues/1663)

## 0.2.0 (2026-10-25)

### Features

* **ui-router-effect:** type routeRef's snapshot through a RouteTypes interface ([#1590](https://github.com/simshanith/lit-ui-router/issues/1590)) ([fd082b3](https://github.com/simshanith/lit-ui-router/commit/fd082b3cac9de42233a41caa7e2aac418211c14b))

## 0.1.2 (2026-10-15)

### Documentation

* show one npm install command per block and on the home hero ([#1262](https://github.com/simshanith/lit-ui-router/issues/1262)) ([d5c4bae](https://github.com/simshanith/lit-ui-router/commit/d5c4bae96b1918ac3a131b48cd6bb2c43f9bd8f2))
* **www:** add API reference pages for the signals and ui-router-effect packages ([#1265](https://github.com/simshanith/lit-ui-router/issues/1265)) ([1cf07fd](https://github.com/simshanith/lit-ui-router/commit/1cf07fddc1269b2e8ce1cb05b2f24ffa7b14cb32))

## 0.1.1 (2026-10-13)

Documentation-only release: the README now says that lit-ui-router-effect builds its Lit controllers on ui-router-effect and re-exports `routeRef`. No code or types changed.

### Code Refactoring

* **lit-ui-router-effect:** build the Lit controllers on ui-router-effect ([#1246](https://github.com/simshanith/lit-ui-router/issues/1246)) ([b8832be](https://github.com/simshanith/lit-ui-router/commit/b8832be1be883d81eb5500b3512b4199f287bed7)), closes [#1187](https://github.com/simshanith/lit-ui-router/issues/1187) [#1245](https://github.com/simshanith/lit-ui-router/issues/1245), references [#1215](https://github.com/simshanith/lit-ui-router/issues/1215)

## 0.1.0 (2026-10-13)

### Features

* **ui-router-effect:** add Effect bindings for @uirouter/core without Lit ([#1189](https://github.com/simshanith/lit-ui-router/issues/1189)) ([9c9ce92](https://github.com/simshanith/lit-ui-router/commit/9c9ce925b8a3d5f3b6bcbbcd915fc94e4c754157))
* **ui-router-effect:** wire the package into the release pipeline ([#1216](https://github.com/simshanith/lit-ui-router/issues/1216)) ([f08ab78](https://github.com/simshanith/lit-ui-router/commit/f08ab78d421b92aca63af10cdfbc4ef6313051ce)), references [#1189](https://github.com/simshanith/lit-ui-router/issues/1189) [#1185](https://github.com/simshanith/lit-ui-router/issues/1185)

### Documentation

* badge ui-router-effect's and ui-router-signals' coverage ([#1248](https://github.com/simshanith/lit-ui-router/issues/1248)) ([870b6c8](https://github.com/simshanith/lit-ui-router/commit/870b6c868595ff8b2084b96a4bcbea3aebed09f7))
