# Changelog

Prereleases and canaries are not listed here; see [all releases on GitHub](https://github.com/simshanith/lit-ui-router/releases?q=ui-router-registry%40&expanded=true).

## 0.4.1 (2026-11-13)

### Build System

* drop stale overrides, knip ignores and lint disables from the exception lists ([#1909](https://github.com/simshanith/lit-ui-router/issues/1909)) ([52faefd](https://github.com/simshanith/lit-ui-router/commit/52faefd28347d7437db68607d629f5a6f02c8ad7)), references [#721](https://github.com/simshanith/lit-ui-router/issues/721) [#1448](https://github.com/simshanith/lit-ui-router/issues/1448) [#1474](https://github.com/simshanith/lit-ui-router/issues/1474) [#1534](https://github.com/simshanith/lit-ui-router/issues/1534) [#1907](https://github.com/simshanith/lit-ui-router/issues/1907) [#1901](https://github.com/simshanith/lit-ui-router/issues/1901)
* **lint:** type-check opted-in Markdown ts blocks on the TypeScript 7.1 API ([#1663](https://github.com/simshanith/lit-ui-router/issues/1663)) ([1ee0ce3](https://github.com/simshanith/lit-ui-router/commit/1ee0ce3464c1a66d3d4655e10c4ef17eab936566))

### Documentation

* **ui-router-registry:** stop naming the optional peers' range in prose ([#1826](https://github.com/simshanith/lit-ui-router/issues/1826)) ([0855342](https://github.com/simshanith/lit-ui-router/commit/0855342d60613e49c9e2d9d51f3726f7f46d0c03))

<details>
<summary>Also touched this package (2)</summary>

* **lit-ui-router:** add uiViewProps beside a deprecated _uiViewProps ([#2071](https://github.com/simshanith/lit-ui-router/pull/2071))
* **www:** move the API reference to /reference/\<npm-name>/ ([#2028](https://github.com/simshanith/lit-ui-router/pull/2028))

</details>

[Release page](https://lit-ui-router.dev/releases/ui-router-registry/0.4.1/) · [Diff from 0.4.0](https://lit-ui-router.dev/releases/ui-router-registry/diff/0.4.0...0.4.1/)

## 0.4.0 (2026-11-02)

### Features

* **lit-ui-router-effect:** require ui-router-effect 0.3 ([#1801](https://github.com/simshanith/lit-ui-router/issues/1801)) ([f89f6b3](https://github.com/simshanith/lit-ui-router/commit/f89f6b352c10077b69870fb34568f1343a61eaad))
* **lit-ui-router-mobx:** require ui-router-mobx 0.3 ([#1802](https://github.com/simshanith/lit-ui-router/issues/1802)) ([7745244](https://github.com/simshanith/lit-ui-router/commit/77452443cab7120ddfaff1125f23b0e8cf56e40a))
* **lit-ui-router-signals:** require ui-router-signals 0.3 ([#1800](https://github.com/simshanith/lit-ui-router/issues/1800)) ([ea4ef1d](https://github.com/simshanith/lit-ui-router/commit/ea4ef1d5df9adb6a9c4d6499f722d80f52bfd63c))

## 0.3.0 (2026-10-29)

### Features

* **lit-ui-router:** add TypedLitStateDeclaration to check state tables without inferring render() ([#1615](https://github.com/simshanith/lit-ui-router/issues/1615)) ([a270950](https://github.com/simshanith/lit-ui-router/commit/a270950a2534a04c9803884de3c2d51cfd852614)), references [#1448](https://github.com/simshanith/lit-ui-router/issues/1448)
* **ui-router-registry:** export a check for states that collide across modules ([#1627](https://github.com/simshanith/lit-ui-router/issues/1627)) ([88b6ce3](https://github.com/simshanith/lit-ui-router/commit/88b6ce31414b2d2fcd7cf05c1d79b070998c235c))
* **ui-router-registry:** make TypedStateService assignable to StateService ([#1624](https://github.com/simshanith/lit-ui-router/issues/1624)) ([869fae2](https://github.com/simshanith/lit-ui-router/commit/869fae23de2bfc3e73acee7829a0f1c98ea2dcfb)), references [#1525](https://github.com/simshanith/lit-ui-router/issues/1525)
* **ui-router-registry:** register states per module through a name-keyed interface ([#1626](https://github.com/simshanith/lit-ui-router/issues/1626)) ([df5646c](https://github.com/simshanith/lit-ui-router/commit/df5646c82d382f661a660624979f79fe8676fd65))

## 0.2.0 (2026-10-26)

### Features

* **lit-ui-router-effect:** ui-router-effect 0.2 as a peer ([#1598](https://github.com/simshanith/lit-ui-router/issues/1598)) ([2432d40](https://github.com/simshanith/lit-ui-router/commit/2432d40a690c2472e5352d5a1eeb1f830417ade3))
* **lit-ui-router-mobx:** ui-router-mobx 0.2 as a peer ([#1600](https://github.com/simshanith/lit-ui-router/issues/1600)) ([d1710bb](https://github.com/simshanith/lit-ui-router/commit/d1710bbd1cc9644ab4186640640a81f8de58a5a2))
* **lit-ui-router-signals:** ui-router-signals 0.2 as a peer ([#1599](https://github.com/simshanith/lit-ui-router/issues/1599)) ([9b74380](https://github.com/simshanith/lit-ui-router/commit/9b74380a616fdc5fa30f4ed95e36b56066e85dfc))
* **ui-router-registry:** fill the signals, effect and mobx RouteTypes from subpaths ([#1606](https://github.com/simshanith/lit-ui-router/issues/1606)) ([da19a60](https://github.com/simshanith/lit-ui-router/commit/da19a60f44588f334e3a0bd8933b82f562fbfae8)), references [#1605](https://github.com/simshanith/lit-ui-router/issues/1605)
* **ui-router-registry:** type TypedStateService's reload over registered names ([#1607](https://github.com/simshanith/lit-ui-router/issues/1607)) ([317e2f5](https://github.com/simshanith/lit-ui-router/commit/317e2f5869fbc689983a4fff8d657e7359adc4ee))

## 0.1.1 (2026-10-24)

### Bug Fixes

* **ui-router-registry:** accept the bare self ref '.' in TypedStateService ([#1591](https://github.com/simshanith/lit-ui-router/issues/1591)) ([ee48fde](https://github.com/simshanith/lit-ui-router/commit/ee48fdec9211478daa0ab76e35c5767929f2f079)), closes [#1582](https://github.com/simshanith/lit-ui-router/issues/1582)
* **ui-router-registry:** type a value: null default as null on url and typed params ([#1592](https://github.com/simshanith/lit-ui-router/issues/1592)) ([124d970](https://github.com/simshanith/lit-ui-router/commit/124d9704a2d948dd56e432959bb5c21e79c033e6)), closes [#1583](https://github.com/simshanith/lit-ui-router/issues/1583)

## 0.1.0 (2026-10-24)

### Features

* **ui-router-registry:** add typed state names and params for @uirouter/core ([#1441](https://github.com/simshanith/lit-ui-router/issues/1441)) ([5b82c4d](https://github.com/simshanith/lit-ui-router/commit/5b82c4d02bf2bd73a0e881d0c6690258e63989ac)), references [#1306](https://github.com/simshanith/lit-ui-router/issues/1306) [#1306](https://github.com/simshanith/lit-ui-router/issues/1306)
* **ui-router-registry:** wire the package into the release pipeline ([#1446](https://github.com/simshanith/lit-ui-router/issues/1446)) ([629930a](https://github.com/simshanith/lit-ui-router/commit/629930a229b91a1c115fd1463db916d395d03710))

### Documentation

* **ui-router-registry:** drop the rc tag from the install line ([#1575](https://github.com/simshanith/lit-ui-router/issues/1575)) ([7e14c04](https://github.com/simshanith/lit-ui-router/commit/7e14c04a2c57587f63744511492b3ec5a98e7861))
