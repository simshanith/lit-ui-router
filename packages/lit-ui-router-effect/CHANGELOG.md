# Changelog

Prereleases and canaries are not listed here; see [all releases on GitHub](https://github.com/simshanith/lit-ui-router/releases?q=lit-ui-router-effect%40&expanded=true).

## 0.7.1 (2026-11-13)

### Features

* **www:** move the API reference to /reference/\<npm-name>/ ([#2028](https://github.com/simshanith/lit-ui-router/issues/2028)) ([9044ab3](https://github.com/simshanith/lit-ui-router/commit/9044ab32a5fe2b882ae7eb8de4700f184094c663)), references [#1566](https://github.com/simshanith/lit-ui-router/issues/1566)

### Build System

* drop stale overrides, knip ignores and lint disables from the exception lists ([#1909](https://github.com/simshanith/lit-ui-router/issues/1909)) ([52faefd](https://github.com/simshanith/lit-ui-router/commit/52faefd28347d7437db68607d629f5a6f02c8ad7)), references [#721](https://github.com/simshanith/lit-ui-router/issues/721) [#1448](https://github.com/simshanith/lit-ui-router/issues/1448) [#1474](https://github.com/simshanith/lit-ui-router/issues/1474) [#1534](https://github.com/simshanith/lit-ui-router/issues/1534) [#1907](https://github.com/simshanith/lit-ui-router/issues/1907) [#1901](https://github.com/simshanith/lit-ui-router/issues/1901)
* **lint:** type-check opted-in Markdown ts blocks on the TypeScript 7.1 API ([#1663](https://github.com/simshanith/lit-ui-router/issues/1663)) ([1ee0ce3](https://github.com/simshanith/lit-ui-router/commit/1ee0ce3464c1a66d3d4655e10c4ef17eab936566))

[Release page](https://lit-ui-router.dev/releases/lit-ui-router-effect/0.7.1/) · [Diff from 0.7.0](https://lit-ui-router.dev/releases/lit-ui-router-effect/diff/0.7.0...0.7.1/)

## 0.7.0 (2026-11-02)

### Features

* **lit-ui-router-effect:** require ui-router-effect 0.3 ([#1801](https://github.com/simshanith/lit-ui-router/issues/1801)) ([f89f6b3](https://github.com/simshanith/lit-ui-router/commit/f89f6b352c10077b69870fb34568f1343a61eaad))

## 0.6.0 (2026-10-25)

### Features

* **lit-ui-router-effect:** ui-router-effect 0.2 as a peer ([#1598](https://github.com/simshanith/lit-ui-router/issues/1598)) ([2432d40](https://github.com/simshanith/lit-ui-router/commit/2432d40a690c2472e5352d5a1eeb1f830417ade3))
* **ui-router-effect:** type routeRef's snapshot through a RouteTypes interface ([#1590](https://github.com/simshanith/lit-ui-router/issues/1590)) ([fd082b3](https://github.com/simshanith/lit-ui-router/commit/fd082b3cac9de42233a41caa7e2aac418211c14b))

## 0.5.0 (2026-10-22)

### ⚠ BREAKING CHANGES

* **lit-ui-router-effect:** the lit-ui-router peer narrows from ^1.15.0 to ^1.16.0. RouterRefController finds the router
  only through context-request, which `<ui-view>` answers since lit-ui-router 1.16.0 ([#1492](https://github.com/simshanith/lit-ui-router/issues/1492)).

### Features

* **lit-ui-router-effect:** find the router through context-request ([#1492](https://github.com/simshanith/lit-ui-router/issues/1492)) ([a91910a](https://github.com/simshanith/lit-ui-router/commit/a91910a61b626ec8081d4c65e1410c6c80605496)), closes [#1489](https://github.com/simshanith/lit-ui-router/issues/1489), references [#901](https://github.com/simshanith/lit-ui-router/issues/901) [#874](https://github.com/simshanith/lit-ui-router/issues/874)

### Documentation

* link the package README release badges to each package's latest GitHub release ([#1501](https://github.com/simshanith/lit-ui-router/issues/1501)) ([9e96854](https://github.com/simshanith/lit-ui-router/commit/9e96854750595230146252667c85ea7b2fc1714d))

## 0.4.1 (2026-10-15)

### Documentation

* show one npm install command per block and on the home hero ([#1262](https://github.com/simshanith/lit-ui-router/issues/1262)) ([d5c4bae](https://github.com/simshanith/lit-ui-router/commit/d5c4bae96b1918ac3a131b48cd6bb2c43f9bd8f2))
* **www:** fix links to moved @uirouter/core API pages ([#1323](https://github.com/simshanith/lit-ui-router/issues/1323)) ([8f8f55c](https://github.com/simshanith/lit-ui-router/commit/8f8f55c32d75ca909ae94b9904aa3e8ff9f3e8cf))

## 0.4.0 (2026-10-13)

### ⚠ BREAKING CHANGES

* **lit-ui-router-effect:** build the Lit controllers on ui-router-effect ([#1246](https://github.com/simshanith/lit-ui-router/issues/1246))

### Code Refactoring

* **lit-ui-router-effect:** build the Lit controllers on ui-router-effect ([#1246](https://github.com/simshanith/lit-ui-router/issues/1246)) ([b8832be](https://github.com/simshanith/lit-ui-router/commit/b8832be1be883d81eb5500b3512b4199f287bed7)), closes [#1187](https://github.com/simshanith/lit-ui-router/issues/1187) [#1245](https://github.com/simshanith/lit-ui-router/issues/1245), references [#1215](https://github.com/simshanith/lit-ui-router/issues/1215)

### Documentation

* **www:** add Effect and Signals overviews at the bare URLs and name each package page in full ([#1242](https://github.com/simshanith/lit-ui-router/issues/1242)) ([badc8b9](https://github.com/simshanith/lit-ui-router/commit/badc8b97a4025cbcc49aab1203ce30cffed9df42))

## 0.3.0 (2026-10-13)

### Features

* **lit-ui-router-effect:** support effect 4 alongside effect 3 ([#1135](https://github.com/simshanith/lit-ui-router/issues/1135)) ([65b83a8](https://github.com/simshanith/lit-ui-router/commit/65b83a8ace14d7480c192476babe751f6818f745))

### Build System

* inline stateless shared source into adapter packages at emit time ([#1185](https://github.com/simshanith/lit-ui-router/issues/1185)) ([83763a7](https://github.com/simshanith/lit-ui-router/commit/83763a76443a768cc5ae75dbbccc1db519526fa7))

## 0.2.1 (2026-10-10)

### Code Refactoring

* enable anti-slop no-runtime-typeof and decode or name each type check ([#1153](https://github.com/simshanith/lit-ui-router/issues/1153)) ([05accd8](https://github.com/simshanith/lit-ui-router/commit/05accd8644aa01086aa064c83f7d4d4df0a7d44a))
* enable the anti-slop type-assertion rules and retype or justify each cast ([#1152](https://github.com/simshanith/lit-ui-router/issues/1152)) ([643814f](https://github.com/simshanith/lit-ui-router/commit/643814f6ab4e2f976e4bb1746d9a44cb823ac327))
* enable the anti-slop typing rules and tighten the types they flag ([#1151](https://github.com/simshanith/lit-ui-router/issues/1151)) ([a16befb](https://github.com/simshanith/lit-ui-router/commit/a16befbf026033f0085bc0bd40cf671887861040))

## 0.2.0 (2026-10-04)

### Features

* **lit-ui-router-effect:** add setRouter and a router thunk to RouterRefController ([#1083](https://github.com/simshanith/lit-ui-router/issues/1083)) ([18c8c71](https://github.com/simshanith/lit-ui-router/commit/18c8c713fea2aef1166e2483cc441d27c44c4813)), closes [#1076](https://github.com/simshanith/lit-ui-router/issues/1076)

### Bug Fixes

* **lit-ui-router-effect:** follow the placeholder router's upgrade in RouterRefController ([#1100](https://github.com/simshanith/lit-ui-router/issues/1100)) ([ca8f433](https://github.com/simshanith/lit-ui-router/commit/ca8f43302bf398b066262ac884b45d9276390706)), closes [#1075](https://github.com/simshanith/lit-ui-router/issues/1075)

### Build System

* **tools:** add a report-only crap task for CRAP hotspots ([#1056](https://github.com/simshanith/lit-ui-router/issues/1056)) ([d39b706](https://github.com/simshanith/lit-ui-router/commit/d39b7064f8d9d8036fac1257ca319618064b7f73)), references [crap-rs#193](https://github.com/crap-rs/issues/193)
* **turbo:** replace with sidecars with umbrella tasks ([#1038](https://github.com/simshanith/lit-ui-router/issues/1038)) ([aec4ee8](https://github.com/simshanith/lit-ui-router/commit/aec4ee8a8a6a44c8a3c99a7e08abb789343ef8e0))

### Documentation

* **lit-ui-router-effect:** options.runtime provides no services ([#1079](https://github.com/simshanith/lit-ui-router/issues/1079)) ([dcdef1a](https://github.com/simshanith/lit-ui-router/commit/dcdef1a3db5c3648577b5ea411953f78b2d3abba)), closes [#1077](https://github.com/simshanith/lit-ui-router/issues/1077)

## 0.1.3 (2026-09-28)

### ⚠ BREAKING CHANGES

* **lit-ui-router-effect:** the lit-ui-router peer narrows from ^1.7.0 to ^1.15.0. RouterRefController reads the
  scoped router through `getScopedRouter`, which ships from lit-ui-router 1.15.0 ([#994](https://github.com/simshanith/lit-ui-router/issues/994)).

### Bug Fixes

* **lit-ui-router-effect:** read the scoped router when no ui-router can be sought ([#994](https://github.com/simshanith/lit-ui-router/issues/994)) ([7d7489e](https://github.com/simshanith/lit-ui-router/commit/7d7489e449fb01ce92e05e77388a21742a8e4c67))

## 0.1.2 (2026-09-28)

### Bug Fixes

* **lit-ui-router-effect:** interrupt the subscription fiber directly on disconnect ([#997](https://github.com/simshanith/lit-ui-router/issues/997)) ([77da8e9](https://github.com/simshanith/lit-ui-router/commit/77da8e9093f9736a7ba32b843f5c685e7e9dc408)), closes [#996](https://github.com/simshanith/lit-ui-router/issues/996)

## 0.1.1 (2026-09-21)

### Bug Fixes

* **lit-ui-router-effect:** import the router element from lit-ui-router/pure ([#938](https://github.com/simshanith/lit-ui-router/issues/938)) ([df3e557](https://github.com/simshanith/lit-ui-router/commit/df3e5578efd6c2d9b3d3d394b4ff849618fab61b))

## 0.1.0 (2026-09-17)

### Features

* **lit-ui-router-effect:** add the Effect bindings package ([#833](https://github.com/simshanith/lit-ui-router/issues/833)) ([f5f5fd0](https://github.com/simshanith/lit-ui-router/commit/f5f5fd02cd4175b001bce63ad4ccea189c1ff2e7)), references [#721](https://github.com/simshanith/lit-ui-router/issues/721) [#662](https://github.com/simshanith/lit-ui-router/issues/662) [#666](https://github.com/simshanith/lit-ui-router/issues/666)
* **lit-ui-router-effect:** infer RefController's refs as a tuple on TS 5.0 ([#855](https://github.com/simshanith/lit-ui-router/issues/855)) ([2806732](https://github.com/simshanith/lit-ui-router/commit/2806732b0523da560660a2133bfa642d9a93d19a))
* **lit-ui-router-effect:** wire the package into the release pipeline ([#869](https://github.com/simshanith/lit-ui-router/issues/869)) ([c22fd5e](https://github.com/simshanith/lit-ui-router/commit/c22fd5e7944b746378dad6f55f503dde88e1a7ec)), closes [#844](https://github.com/simshanith/lit-ui-router/issues/844), references [#843](https://github.com/simshanith/lit-ui-router/issues/843)

### Documentation

* **plugins:** enable typedoc validation.notDocumented in effect, mobx and navigation-location ([#851](https://github.com/simshanith/lit-ui-router/issues/851)) ([71f2c45](https://github.com/simshanith/lit-ui-router/commit/71f2c455731096c7b0074beecb807bdde9079823)), closes [#834](https://github.com/simshanith/lit-ui-router/issues/834)
