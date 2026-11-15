# Changelog

Prereleases and canaries are not listed here; see [all releases](https://lit-ui-router.dev/releases/lit-ui-router-mobx/).

## 1.5.1 (2026-11-13)

### Features

* **www:** move the API reference to /reference/\<npm-name>/ ([#2028](https://github.com/simshanith/lit-ui-router/issues/2028)) ([9044ab3](https://github.com/simshanith/lit-ui-router/commit/9044ab32a5fe2b882ae7eb8de4700f184094c663)), references [#1566](https://github.com/simshanith/lit-ui-router/issues/1566)

### Build System

* drop stale overrides, knip ignores and lint disables from the exception lists ([#1909](https://github.com/simshanith/lit-ui-router/issues/1909)) ([52faefd](https://github.com/simshanith/lit-ui-router/commit/52faefd28347d7437db68607d629f5a6f02c8ad7)), references [#721](https://github.com/simshanith/lit-ui-router/issues/721) [#1448](https://github.com/simshanith/lit-ui-router/issues/1448) [#1474](https://github.com/simshanith/lit-ui-router/issues/1474) [#1534](https://github.com/simshanith/lit-ui-router/issues/1534) [#1907](https://github.com/simshanith/lit-ui-router/issues/1907) [#1901](https://github.com/simshanith/lit-ui-router/issues/1901)
* **lint:** type-check opted-in Markdown ts blocks on the TypeScript 7.1 API ([#1663](https://github.com/simshanith/lit-ui-router/issues/1663)) ([1ee0ce3](https://github.com/simshanith/lit-ui-router/commit/1ee0ce3464c1a66d3d4655e10c4ef17eab936566))

[Release page](https://lit-ui-router.dev/releases/lit-ui-router-mobx/1.5.1/) · [Diff from 1.5.0](https://lit-ui-router.dev/releases/lit-ui-router-mobx/diff/1.5.0...1.5.1/)

## 1.5.0 (2026-11-02)

### Features

* **lit-ui-router-mobx:** require ui-router-mobx 0.3 ([#1802](https://github.com/simshanith/lit-ui-router/issues/1802)) ([7745244](https://github.com/simshanith/lit-ui-router/commit/77452443cab7120ddfaff1125f23b0e8cf56e40a))

## 1.4.0 (2026-10-25)

### Features

* **lit-ui-router-mobx:** ui-router-mobx 0.2 as a peer ([#1600](https://github.com/simshanith/lit-ui-router/issues/1600)) ([d1710bb](https://github.com/simshanith/lit-ui-router/commit/d1710bbd1cc9644ab4186640640a81f8de58a5a2))
* **ui-router-mobx:** type RouterStore's state and params through a RouteTypes interface ([#1589](https://github.com/simshanith/lit-ui-router/issues/1589)) ([95d0ffc](https://github.com/simshanith/lit-ui-router/commit/95d0ffc4aafac50285231103615976fb28b99c3d))

## 1.3.0 (2026-10-22)

### ⚠ BREAKING CHANGES

* **lit-ui-router-mobx:** the lit-ui-router peer narrows from ^1.15.0 to ^1.16.0. RouterReactionController finds the router
  only through context-request, which `<ui-view>` answers since lit-ui-router 1.16.0 ([#1493](https://github.com/simshanith/lit-ui-router/issues/1493)).

### Features

* **lit-ui-router-mobx:** find the router through context-request ([#1493](https://github.com/simshanith/lit-ui-router/issues/1493)) ([dfbd192](https://github.com/simshanith/lit-ui-router/commit/dfbd192e1e3adae448f605f79f28155d585fd86d)), closes [#1490](https://github.com/simshanith/lit-ui-router/issues/1490), references [#901](https://github.com/simshanith/lit-ui-router/issues/901) [#874](https://github.com/simshanith/lit-ui-router/issues/874)

### Documentation

* link the package README release badges to each package's latest GitHub release ([#1501](https://github.com/simshanith/lit-ui-router/issues/1501)) ([9e96854](https://github.com/simshanith/lit-ui-router/commit/9e96854750595230146252667c85ea7b2fc1714d))

## 1.2.0 (2026-10-15)

### Features

* **lit-ui-router-mobx:** build the Lit controllers on ui-router-mobx ([#1348](https://github.com/simshanith/lit-ui-router/issues/1348)) ([560730c](https://github.com/simshanith/lit-ui-router/commit/560730c28c4927ebc60b6c22e4731883f2a8d1ba))

### Documentation

* **www:** add a MobX overview at the bare URL and name the Lit page in full ([#1349](https://github.com/simshanith/lit-ui-router/issues/1349)) ([189a1c4](https://github.com/simshanith/lit-ui-router/commit/189a1c41f384e568c86922f90bdf2a6da1051290))
* **www:** fix links to moved @uirouter/core API pages ([#1323](https://github.com/simshanith/lit-ui-router/issues/1323)) ([8f8f55c](https://github.com/simshanith/lit-ui-router/commit/8f8f55c32d75ca909ae94b9904aa3e8ff9f3e8cf))

## 1.1.2 (2026-10-15)

### Documentation

* **lit-ui-router-mobx:** document using RouterStore without Lit ([#1261](https://github.com/simshanith/lit-ui-router/issues/1261)) ([deaf9d2](https://github.com/simshanith/lit-ui-router/commit/deaf9d29994c419d9a0f3dd62eb7a6c2159d7478))
* show one npm install command per block and on the home hero ([#1262](https://github.com/simshanith/lit-ui-router/issues/1262)) ([d5c4bae](https://github.com/simshanith/lit-ui-router/commit/d5c4bae96b1918ac3a131b48cd6bb2c43f9bd8f2))

## 1.1.1 (2026-10-10)

### Code Refactoring

* enable anti-slop no-runtime-typeof and decode or name each type check ([#1153](https://github.com/simshanith/lit-ui-router/issues/1153)) ([05accd8](https://github.com/simshanith/lit-ui-router/commit/05accd8644aa01086aa064c83f7d4d4df0a7d44a))
* enable the anti-slop type-assertion rules and retype or justify each cast ([#1152](https://github.com/simshanith/lit-ui-router/issues/1152)) ([643814f](https://github.com/simshanith/lit-ui-router/commit/643814f6ab4e2f976e4bb1746d9a44cb823ac327))

## 1.1.0 (2026-10-04)

### ⚠ BREAKING CHANGES

* **lit-ui-router-mobx:** the lit-ui-router peer narrows from ^1.7.0 to ^1.15.0. RouterReactionController asks for
  the router through `lit-ui-router/context`, which first ships in lit-ui-router 1.15.0 ([#1099](https://github.com/simshanith/lit-ui-router/issues/1099)).

### Bug Fixes

* **lit-ui-router-effect:** read the scoped router when no ui-router can be sought ([#994](https://github.com/simshanith/lit-ui-router/issues/994)) ([7d7489e](https://github.com/simshanith/lit-ui-router/commit/7d7489e449fb01ce92e05e77388a21742a8e4c67))
* **lit-ui-router-mobx:** follow the placeholder router's upgrade in RouterReactionController ([#1099](https://github.com/simshanith/lit-ui-router/issues/1099)) ([b7377f0](https://github.com/simshanith/lit-ui-router/commit/b7377f02ed623b9dff0ec95bb7b4dd77aad8c61e)), closes [#1080](https://github.com/simshanith/lit-ui-router/issues/1080)

### Build System

* **tools:** add a report-only crap task for CRAP hotspots ([#1056](https://github.com/simshanith/lit-ui-router/issues/1056)) ([d39b706](https://github.com/simshanith/lit-ui-router/commit/d39b7064f8d9d8036fac1257ca319618064b7f73)), references `crap-rs#193`
* **turbo:** replace with sidecars with umbrella tasks ([#1038](https://github.com/simshanith/lit-ui-router/issues/1038)) ([aec4ee8](https://github.com/simshanith/lit-ui-router/commit/aec4ee8a8a6a44c8a3c99a7e08abb789343ef8e0))

### Documentation

* **lit-ui-router-mobx:** describe router discovery and the lit-ui-router 2.0 coupling ([#1110](https://github.com/simshanith/lit-ui-router/issues/1110)) ([2e623de](https://github.com/simshanith/lit-ui-router/commit/2e623de9682085dee88a5e8e8c545c4cbc4d7c70)), closes [#899](https://github.com/simshanith/lit-ui-router/issues/899) [#714](https://github.com/simshanith/lit-ui-router/issues/714)

## 1.0.2 (2026-09-21)

### Bug Fixes

* **lit-ui-router-mobx:** import the router element from lit-ui-router/pure ([#939](https://github.com/simshanith/lit-ui-router/issues/939)) ([58adf4a](https://github.com/simshanith/lit-ui-router/commit/58adf4aa922620676a50fec9427ecb35b3a917eb))

## 1.0.1 (2026-09-13)

### Build System

* **docs:** move the site to www/lit-ui-router.dev with its wrangler config ([#717](https://github.com/simshanith/lit-ui-router/issues/717)) ([53d3a7c](https://github.com/simshanith/lit-ui-router/commit/53d3a7c30a8fdcddc29de4fc77b50b36fde1678b))
* **release:** range a first stable's changelog from the repo root ([#734](https://github.com/simshanith/lit-ui-router/issues/734)) ([fccb746](https://github.com/simshanith/lit-ui-router/commit/fccb746d50c6125a4774b384c341ede7d8f97ca3)), references [#733](https://github.com/simshanith/lit-ui-router/issues/733) [#302](https://github.com/simshanith/lit-ui-router/issues/302) [#423](https://github.com/simshanith/lit-ui-router/issues/423) [#673](https://github.com/simshanith/lit-ui-router/issues/673)

### Documentation

* **plugins:** enable typedoc validation.notDocumented in effect, mobx and navigation-location ([#851](https://github.com/simshanith/lit-ui-router/issues/851)) ([71f2c45](https://github.com/simshanith/lit-ui-router/commit/71f2c455731096c7b0074beecb807bdde9079823)), closes [#834](https://github.com/simshanith/lit-ui-router/issues/834)
* **typedoc-plugin:** migrate [[X]] links to `{@link}` and drop the symbol tables ([#832](https://github.com/simshanith/lit-ui-router/issues/832)) ([b59e8de](https://github.com/simshanith/lit-ui-router/commit/b59e8dee22b2b8cbb61303004d933f02e54dc651)), references [#827](https://github.com/simshanith/lit-ui-router/issues/827) [#830](https://github.com/simshanith/lit-ui-router/issues/830)

## 1.0.0 (2026-09-04)

### Features

* **lit-ui-router-mobx:** add initialValue for pre-connect .value ([#706](https://github.com/simshanith/lit-ui-router/issues/706)) ([dde62d8](https://github.com/simshanith/lit-ui-router/commit/dde62d86d934054a2cac52aa5f4ecf638e672b22)), references [#564](https://github.com/simshanith/lit-ui-router/issues/564) [#672](https://github.com/simshanith/lit-ui-router/issues/672) [#564](https://github.com/simshanith/lit-ui-router/issues/564)
* **lit-ui-router-mobx:** adopt the dev/prod split and the dev-mode missing-router warning ([#692](https://github.com/simshanith/lit-ui-router/issues/692)) ([9eda5e2](https://github.com/simshanith/lit-ui-router/commit/9eda5e24fa25c276f584883e09afc42f98b858ce)), references [#659](https://github.com/simshanith/lit-ui-router/issues/659) [#672](https://github.com/simshanith/lit-ui-router/issues/672)

### Bug Fixes

* **lit-ui-router-mobx:** make RouterStore.attach idempotent and detachable ([#705](https://github.com/simshanith/lit-ui-router/issues/705)) ([4ebabc0](https://github.com/simshanith/lit-ui-router/commit/4ebabc0b31be00bdd802720549f7480361974c76)), references [#672](https://github.com/simshanith/lit-ui-router/issues/672)

### Build System

* **workspace:** declare oxlint and oxfmt in every package that runs them ([#586](https://github.com/simshanith/lit-ui-router/issues/586)) ([daa7ff8](https://github.com/simshanith/lit-ui-router/commit/daa7ff8b36c2dd98119a4da4a256ac8327f40db0))

## 0.5.0 (2026-08-10)

### Features

* **deps:** support mobx 6 and 7 via a widened peer range ([#521](https://github.com/simshanith/lit-ui-router/issues/521)) ([9a367e5](https://github.com/simshanith/lit-ui-router/commit/9a367e53706581d4a92133fc2202def8c9328d05))

### Bug Fixes

* clear the two warnings left in a green CI run ([#529](https://github.com/simshanith/lit-ui-router/issues/529)) ([f3ee0de](https://github.com/simshanith/lit-ui-router/commit/f3ee0de54d7bf3d268d79a42d7b83dd17695e31a))

### Code Refactoring

* **compat:** read catalogs via the pnpm SDK, split the lit2 lane ([#525](https://github.com/simshanith/lit-ui-router/issues/525)) ([9c17b2b](https://github.com/simshanith/lit-ui-router/commit/9c17b2b128416ee0e58215c71d65b6c5a7325c5f))
* **test:** share lit vitest.setup body via @tools/lit-test-env ([#531](https://github.com/simshanith/lit-ui-router/issues/531)) ([e55fda9](https://github.com/simshanith/lit-ui-router/commit/e55fda91bee7a94457f870e9296ebac4eff49994))

## 0.4.0 (2026-08-02)

### Features

* **deps:** restore lit 2 peer support with a main-graph compat lane ([#490](https://github.com/simshanith/lit-ui-router/issues/490)) ([e28f9cc](https://github.com/simshanith/lit-ui-router/commit/e28f9ccbf6096af300f4418ecbc04c433c589a21)), references [#142](https://github.com/simshanith/lit-ui-router/issues/142)

### Bug Fixes

* **release:** show Build System section in release notes ([#423](https://github.com/simshanith/lit-ui-router/issues/423)) ([7f6e4fa](https://github.com/simshanith/lit-ui-router/commit/7f6e4fa99f16104d0f3d204d57bf04819cf9571e))

### Build System

* consolidate variant outputs under dist/ — dist/hash, worker/dist ([#417](https://github.com/simshanith/lit-ui-router/issues/417)) ([aa6485e](https://github.com/simshanith/lit-ui-router/commit/aa6485e01408428e1e45a71516a5256b73a9491c))

## 0.3.5 (2026-07-19)

### Build System
* **lit-ui-router-mobx:** adopt two-pass oxc-emit build ([#395](https://github.com/simshanith/lit-ui-router/issues/395)) ([4668ac4](https://github.com/simshanith/lit-ui-router/commit/4668ac481b3d8e53c9c3523b439d9006e88d7d13)), closes [#369](https://github.com/simshanith/lit-ui-router/issues/369)

## 0.3.4 (2026-07-19)

### Features

* **release:** tools/release + mise task pipeline, zizmor audit, published-diff guard ([#331](https://github.com/simshanith/lit-ui-router/issues/331)) ([d7abe18](https://github.com/simshanith/lit-ui-router/commit/d7abe18020308b8c830ce2dc0931011525037c7f)), closes [release#test](https://github.com/simshanith/release/issues/test) [#323](https://github.com/simshanith/lit-ui-router/issues/323) [#302](https://github.com/simshanith/lit-ui-router/issues/302) [#302](https://github.com/simshanith/lit-ui-router/issues/302) [#build](https://github.com/simshanith/lit-ui-router/issues/build) [#334](https://github.com/simshanith/lit-ui-router/issues/334) [#335](https://github.com/simshanith/lit-ui-router/issues/335) [#334](https://github.com/simshanith/lit-ui-router/issues/334)

## 0.3.3 (2026-07-12)

### Features
* **lint:** triage and enable the remaining tsgolint type-aware rules ([#277](https://github.com/simshanith/lit-ui-router/issues/277)) ([f5b3331](https://github.com/simshanith/lit-ui-router/commit/f5b333141662ffef4422f94405c869df4d8b25fe)), closes [#285](https://github.com/simshanith/lit-ui-router/issues/285) [#279](https://github.com/simshanith/lit-ui-router/issues/279)
* **release:** conventional-changelog release notes ([#207](https://github.com/simshanith/lit-ui-router/issues/207)) ([6a6e7bc](https://github.com/simshanith/lit-ui-router/commit/6a6e7bcd59478945d7b27f493deeaf341dfa7a19))
* **tooling:** adopt oxlint-tsgolint type-aware linting ([#233](https://github.com/simshanith/lit-ui-router/issues/233)) ([376be35](https://github.com/simshanith/lit-ui-router/commit/376be35c23fb690f910d8ae6e92ab8d594710715))
* **tooling:** migrate eslint to oxlint ([#231](https://github.com/simshanith/lit-ui-router/issues/231)) ([7bb0c12](https://github.com/simshanith/lit-ui-router/commit/7bb0c128370d0d5b0c0ad5e4882ced515769e9b5))
* **tooling:** migrate prettier to oxfmt ([#232](https://github.com/simshanith/lit-ui-router/issues/232)) ([f9ce7e2](https://github.com/simshanith/lit-ui-router/commit/f9ce7e202f385060d791c7a98472e4297d320386))
* **tooling:** typescript 7.0 with a typescript6-compat catalog for API consumers ([#249](https://github.com/simshanith/lit-ui-router/issues/249)) ([f6bd36a](https://github.com/simshanith/lit-ui-router/commit/f6bd36ac8e8661f01c7688c9364ced7809e04c3a))
* **tooling:** vite 8 (stable) ([#228](https://github.com/simshanith/lit-ui-router/issues/228)) ([870cab6](https://github.com/simshanith/lit-ui-router/commit/870cab64b50908c7ead578a4e80dfdc1b1a8e4ad)), closes [#178](https://github.com/simshanith/lit-ui-router/issues/178)
* **types:** register custom elements in HTMLElementTagNameMap ([#285](https://github.com/simshanith/lit-ui-router/issues/285)) ([cf44b92](https://github.com/simshanith/lit-ui-router/commit/cf44b928a186c6c3a5c79fc89e0e913d4c05d74f))
### Bug Fixes
* **test:** wire vitest.setup.ts via setupFiles ([#251](https://github.com/simshanith/lit-ui-router/issues/251)) ([04c5bc1](https://github.com/simshanith/lit-ui-router/commit/04c5bc1d27ae05a231ca2ec0d919ab8ffb5002e6)), closes [227/#238](https://github.com/227/lit-ui-router/issues/238) [#236](https://github.com/simshanith/lit-ui-router/issues/236)
* **turbo:** stable app-build hashes via transit deps + cached docs:api ([#278](https://github.com/simshanith/lit-ui-router/issues/278)) ([5c15100](https://github.com/simshanith/lit-ui-router/commit/5c151006c5d5c439c5348b24e09d61f4e98fd4e8)), closes [sample-app-shared#transit](https://github.com/simshanith/sample-app-shared/issues/transit)

## 0.3.2 (2026-07-07)

* Release 1.5.2 (#211) (adc757b)
* Release 0.2.1 (#210) (9510c9a)
* fix(ci): restore manifest after devdeps strip so release-it sees a clean tree (#209) (63f8f8d)
* fix(ci): strip devDependencies from published manifests (#208) (621b664)
* fix(sample-apps): static-copy v4 — resolve visualizer images, bump to ^4.1.1 (#206) (5b65bdf)
* chore(examples): lit ^3.3.3 + typescript ^6.0.3, regenerate lockfiles (#205) (a0b10cf)
* chore(deps): examples get security updates only (#200) (aadb464)
* fix(sample-app): route unmatched URLs to a 404 state via urlService.rules.otherwise (#184) (e97bf23)
* chore(deps): ignore @types/node and vite majors in dependabot (#199) (e619dc2)
* fix(test): backport upstream isEmbedded tester guard into @vitest/browser patch (#186) (18629a8)
* chore(deps): bump actions/attest-build-provenance from 3 to 4 (#188) (a124a83)
* chore(deps): bump actions/checkout from 5 to 7 (#187) (8ae73ca)
* chore(deps): bump the examples-security group across 3 directories with 4 updates (#194) (b0c2bd0)
* chore(deps): bump typedoc in the minor-and-patch group (#189) (69dab52)
* ci(codecov): bundle analysis for sample app builds (#183) (b4ff8f0)
* chore(ci): add dependabot config (#180) (7ba959c)
* chore(tooling): upgrade to pnpm 11 (#177) (972ba45)
* fix(examples): bump to lit-ui-router ^1.5.1 and regenerate lockfiles (#176) (af22b25)
* Release 1.5.1 (#174) (5c878d5)

## 0.3.1 (2026-07-07)

* fix(ci): publish the pnpm-packed tarball, not an npm re-pack (#173) (44e98c1)
* chore(tooling): node 24 + @types/node 24 (#172) (31e2a84)
* ci: push only the tag ref from Tag & push (#171) (f9d5087)
* Release 0.2.0 (#170) (9306d7a)
* Release 1.5.0 (#168) (eed692c)

## 0.3.0 (2026-07-06)

* feat(packages): add exports maps and sideEffects to published manifests (#167) (064c691)
* chore(tooling): upgrade to ESLint 10 (#166) (a70fba3)
* feat(tooling): dts-backtest consumer-floor guard + TypeScript 6.0 (#165) (c639acd)
* Release 0.1.2 (#164) (f16a691)
* feat(sample-apps): add Navigation API feature detection (#137) (1bc77f2)
* refactor(sample-apps): extract sample-app-shared internal package (#163) (9e630f0)
* chore(examples): bump lit-ui-router to ^1.4.0 (#161) (ebf6ed0)
* ci: serialize Tag & push runs to stop rollback tag deletion (#162) (4df93c0)

## 0.2.0 (2026-07-06)

* Release 1.4.0 (#159) (c771703)
* chore: dependency upgrades (July 2026) (#157) (62108b9)
* fix(sample-apps): restore shared dialog design from react/angular sample apps (#158) (31661e7)
* ci: release-it 20 native draft flow for immutable releases (#156) (e1cb7d8)

## 0.1.0 (2026-07-05)

First release of **lit-ui-router-mobx** — MobX bindings for [lit-ui-router](https://github.com/simshanith/lit-ui-router): an observable router store and reaction-based Lit ReactiveControllers.

* `RouterStore` — observable mirror of router state (`.for(router)` factory)
* `ReactionController` — MobX `reaction` bound to the Lit host lifecycle
* `RouterReactionController` — router discovery via `ui-router-context` + reactions

Docs: https://lit-ui-router.dev/api/lit-ui-router-mobx/

Requires `lit-ui-router@^1.3.0` (public `UIRouterLitElement.seekRouter`).
