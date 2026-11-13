# Changelog

Prereleases and canaries are not listed here; see [all releases on GitHub](https://github.com/simshanith/lit-ui-router/releases?q=lit-ui-router-signals%40&expanded=true).

## 0.4.0 (2026-11-02)

### Features

* **lit-ui-router-signals:** require ui-router-signals 0.3 ([#1800](https://github.com/simshanith/lit-ui-router/issues/1800)) ([ea4ef1d](https://github.com/simshanith/lit-ui-router/commit/ea4ef1d5df9adb6a9c4d6499f722d80f52bfd63c))

## 0.3.0 (2026-10-25)

### Features

* **lit-ui-router-signals:** ui-router-signals 0.2 as a peer ([#1599](https://github.com/simshanith/lit-ui-router/issues/1599)) ([9b74380](https://github.com/simshanith/lit-ui-router/commit/9b74380a616fdc5fa30f4ed95e36b56066e85dfc))
* **ui-router-signals:** type RouterSignals' route through a RouteTypes interface ([#1588](https://github.com/simshanith/lit-ui-router/issues/1588)) ([0d9ea48](https://github.com/simshanith/lit-ui-router/commit/0d9ea48a19839b88cd42e89b280c564e869aa70e))

## 0.2.0 (2026-10-22)

### ⚠ BREAKING CHANGES

* **lit-ui-router-signals:** the lit-ui-router peer narrows from ^1.15.0 to ^1.16.0. RouterSignalController finds the router
  only through context-request, which `<ui-view>` answers since lit-ui-router 1.16.0 ([#1491](https://github.com/simshanith/lit-ui-router/issues/1491)).

### Features

* **lit-ui-router-signals:** find the router through context-request ([#1491](https://github.com/simshanith/lit-ui-router/issues/1491)) ([10b5f2d](https://github.com/simshanith/lit-ui-router/commit/10b5f2d9cc4e5b9e7b10be42f90a51e792a25522)), closes [#1488](https://github.com/simshanith/lit-ui-router/issues/1488), references [#901](https://github.com/simshanith/lit-ui-router/issues/901) [#874](https://github.com/simshanith/lit-ui-router/issues/874)

## 0.1.1 (2026-10-15)

### Documentation

* **lit-ui-router-signals:** match the README comparison table to the www page ([#1351](https://github.com/simshanith/lit-ui-router/issues/1351)) ([c37b933](https://github.com/simshanith/lit-ui-router/commit/c37b9337d0fedd17adc87fc9791ddc06fc4739e2))
* show one npm install command per block and on the home hero ([#1262](https://github.com/simshanith/lit-ui-router/issues/1262)) ([d5c4bae](https://github.com/simshanith/lit-ui-router/commit/d5c4bae96b1918ac3a131b48cd6bb2c43f9bd8f2))
* **www:** add API reference pages for the signals and ui-router-effect packages ([#1265](https://github.com/simshanith/lit-ui-router/issues/1265)) ([1cf07fd](https://github.com/simshanith/lit-ui-router/commit/1cf07fddc1269b2e8ce1cb05b2f24ffa7b14cb32))

## 0.1.0 (2026-10-13)

### Features

* **lit-ui-router-signals:** wire the package into the release pipeline ([#1215](https://github.com/simshanith/lit-ui-router/issues/1215)) ([2a751f8](https://github.com/simshanith/lit-ui-router/commit/2a751f8eb3134dc12ec1330c3b6b60fe11ced319))
* **signals:** sketch framework-agnostic ui-router-signals, Lit controllers and a sample app spike ([#1159](https://github.com/simshanith/lit-ui-router/issues/1159)) ([147a03e](https://github.com/simshanith/lit-ui-router/commit/147a03e9c407cf182c1b3f1945c3d24c2dc3a30a)), references [#1157](https://github.com/simshanith/lit-ui-router/issues/1157) [#1157](https://github.com/simshanith/lit-ui-router/issues/1157)

### Documentation

* **www:** add Effect and Signals overviews at the bare URLs and name each package page in full ([#1242](https://github.com/simshanith/lit-ui-router/issues/1242)) ([badc8b9](https://github.com/simshanith/lit-ui-router/commit/badc8b97a4025cbcc49aab1203ce30cffed9df42))
