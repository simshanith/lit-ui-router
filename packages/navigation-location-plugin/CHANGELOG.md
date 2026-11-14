# Changelog

Prereleases and canaries are not listed here; see [all releases](https://lit-ui-router.dev/releases/ui-router-navigation-location-plugin/).

## 1.2.1 (2026-11-13)

### Bug Fixes

* **navigation-location-plugin:** keep a url that begins with // on this origin ([#2103](https://github.com/simshanith/lit-ui-router/issues/2103)) ([fe1fc0a](https://github.com/simshanith/lit-ui-router/commit/fe1fc0a48af4d5ba8b3c7c1cff5775e53a424aa7))

### Build System

* drop stale overrides, knip ignores and lint disables from the exception lists ([#1909](https://github.com/simshanith/lit-ui-router/issues/1909)) ([52faefd](https://github.com/simshanith/lit-ui-router/commit/52faefd28347d7437db68607d629f5a6f02c8ad7)), references [#721](https://github.com/simshanith/lit-ui-router/issues/721) [#1448](https://github.com/simshanith/lit-ui-router/issues/1448) [#1474](https://github.com/simshanith/lit-ui-router/issues/1474) [#1534](https://github.com/simshanith/lit-ui-router/issues/1534) [#1907](https://github.com/simshanith/lit-ui-router/issues/1907) [#1901](https://github.com/simshanith/lit-ui-router/issues/1901)
* **lint:** type-check doc-comment `@example` blocks on the TypeScript 7.1 API ([#1769](https://github.com/simshanith/lit-ui-router/issues/1769)) ([cc4269e](https://github.com/simshanith/lit-ui-router/commit/cc4269eaaac9d93b993d634f9ce017b15efa64b5)), closes [#1756](https://github.com/simshanith/lit-ui-router/issues/1756)
* **lint:** type-check opted-in Markdown ts blocks on the TypeScript 7.1 API ([#1663](https://github.com/simshanith/lit-ui-router/issues/1663)) ([1ee0ce3](https://github.com/simshanith/lit-ui-router/commit/1ee0ce3464c1a66d3d4655e10c4ef17eab936566))

<details>
<summary>Also touched this package (2)</summary>

* **www:** move the API reference to /reference/<npm-name>/ ([#2028](https://github.com/simshanith/lit-ui-router/pull/2028))
* **www:** name package pages by npm name ([#2027](https://github.com/simshanith/lit-ui-router/pull/2027))

</details>

[Release page](https://lit-ui-router.dev/releases/ui-router-navigation-location-plugin/1.2.1/) · [Diff from 1.2.0](https://lit-ui-router.dev/releases/ui-router-navigation-location-plugin/diff/1.2.0...1.2.1/)

## 1.2.0 (2026-10-23)

### Features

* **navigation-location-plugin:** hand interceptTraverse's handler the settled transition ([#1546](https://github.com/simshanith/lit-ui-router/issues/1546)) ([fd494e8](https://github.com/simshanith/lit-ui-router/commit/fd494e8701e5f832b1bae79c9232c668ccfba09b))

### Documentation

* link the package README release badges to each package's latest GitHub release ([#1501](https://github.com/simshanith/lit-ui-router/issues/1501)) ([9e96854](https://github.com/simshanith/lit-ui-router/commit/9e96854750595230146252667c85ea7b2fc1714d))

## 1.1.2 (2026-10-15)

### Documentation

* show one npm install command per block and on the home hero ([#1262](https://github.com/simshanith/lit-ui-router/issues/1262)) ([d5c4bae](https://github.com/simshanith/lit-ui-router/commit/d5c4bae96b1918ac3a131b48cd6bb2c43f9bd8f2))

## 1.1.1 (2026-10-13)

### Documentation

* **navigation-location-plugin:** add an example for navigations the router does not own ([#1204](https://github.com/simshanith/lit-ui-router/issues/1204)) ([2ea87a9](https://github.com/simshanith/lit-ui-router/commit/2ea87a94bde6db15a721917c2398ff067a69e392)), closes [#750](https://github.com/simshanith/lit-ui-router/issues/750)

## 1.1.0 (2026-10-12)

### Features

* **navigation-location-plugin:** add an option to intercept back/forward traversals ([#1181](https://github.com/simshanith/lit-ui-router/issues/1181)) ([2975c86](https://github.com/simshanith/lit-ui-router/commit/2975c866027e4abf7a0b57f0a683c87e54427c5b)), closes [#1155](https://github.com/simshanith/lit-ui-router/issues/1155) [#1166](https://github.com/simshanith/lit-ui-router/issues/1166), references [#1156](https://github.com/simshanith/lit-ui-router/issues/1156)
* **sample-apps:** keep list scroll on detail navigations via the navigation plugin's intercept ([#1173](https://github.com/simshanith/lit-ui-router/issues/1173)) ([37e12e2](https://github.com/simshanith/lit-ui-router/commit/37e12e2dcf82cd6204eb344209f672c7a36cf0ba)), closes [#1165](https://github.com/simshanith/lit-ui-router/issues/1165)

### Bug Fixes

* **navigation-location-plugin:** default focusReset to manual so router navigations keep focus ([#1162](https://github.com/simshanith/lit-ui-router/issues/1162)) ([56353b2](https://github.com/simshanith/lit-ui-router/commit/56353b26b5da18338e53dc8730e88a0f528722ca)), closes [#1155](https://github.com/simshanith/lit-ui-router/issues/1155), references [#1156](https://github.com/simshanith/lit-ui-router/issues/1156)

## 1.0.2 (2026-10-10)

### Code Refactoring

* enable the anti-slop type-assertion rules and retype or justify each cast ([#1152](https://github.com/simshanith/lit-ui-router/issues/1152)) ([643814f](https://github.com/simshanith/lit-ui-router/commit/643814f6ab4e2f976e4bb1746d9a44cb823ac327))
* enable the anti-slop typing rules and tighten the types they flag ([#1151](https://github.com/simshanith/lit-ui-router/issues/1151)) ([a16befb](https://github.com/simshanith/lit-ui-router/commit/a16befbf026033f0085bc0bd40cf671887861040))

### Build System

* **tools:** add a report-only crap task for CRAP hotspots ([#1056](https://github.com/simshanith/lit-ui-router/issues/1056)) ([d39b706](https://github.com/simshanith/lit-ui-router/commit/d39b7064f8d9d8036fac1257ca319618064b7f73)), references [crap-rs#193](https://github.com/crap-rs/issues/193)
* **turbo:** replace with sidecars with umbrella tasks ([#1038](https://github.com/simshanith/lit-ui-router/issues/1038)) ([aec4ee8](https://github.com/simshanith/lit-ui-router/commit/aec4ee8a8a6a44c8a3c99a7e08abb789343ef8e0))

## 1.0.1 (2026-09-27)

### Build System

* **pnpm:** resolve workspace deps through a named workspace catalog ([#981](https://github.com/simshanith/lit-ui-router/issues/981)) ([974bbc4](https://github.com/simshanith/lit-ui-router/commit/974bbc4f92e58ef1cadf0f694abb88d05b7b3b15)), references [#950](https://github.com/simshanith/lit-ui-router/issues/950) [#961](https://github.com/simshanith/lit-ui-router/issues/961) [pnpm/pnpm#15591](https://github.com/pnpm/pnpm/issues/15591)

### Documentation

* **navigation-location-plugin:** type the intercept example with satisfies ([#980](https://github.com/simshanith/lit-ui-router/issues/980)) ([4558db1](https://github.com/simshanith/lit-ui-router/commit/4558db1e9607cd251085c35b6cabd8449ec169c5))

## 1.0.0 (2026-09-26)

### ⚠ BREAKING CHANGES

* **navigation-location-plugin:** `composeNavigateUrl` is no longer exported from the package entry point. It was
  an `@internal` URL helper and has no public replacement ([#965](https://github.com/simshanith/lit-ui-router/issues/965)).

### Features

* **navigation-location-plugin:** intercept the navigations the service itself starts ([#946](https://github.com/simshanith/lit-ui-router/issues/946)) ([ac041b9](https://github.com/simshanith/lit-ui-router/commit/ac041b984e8a9914aee6f0106b0df5a6fe1304c6)), closes [#945](https://github.com/simshanith/lit-ui-router/issues/945)

### Code Refactoring

* **navigation-location-plugin:** settle the public surface for 1.0 ([#965](https://github.com/simshanith/lit-ui-router/issues/965)) ([156cc39](https://github.com/simshanith/lit-ui-router/commit/156cc39f65a6702bad1424d563b556d9d55f6a61)), closes [#778](https://github.com/simshanith/lit-ui-router/issues/778), references [#671](https://github.com/simshanith/lit-ui-router/issues/671) [#778](https://github.com/simshanith/lit-ui-router/issues/778)

### Documentation

* **navigation-location-plugin:** drop the experimental label and state the engine coverage ([#967](https://github.com/simshanith/lit-ui-router/issues/967)) ([92bd5f5](https://github.com/simshanith/lit-ui-router/commit/92bd5f5c99e76a05e08a1055e4d7c87075f62914)), references [#671](https://github.com/simshanith/lit-ui-router/issues/671)
* **navigation-location-plugin:** register servicesPlugin in quick start, state TS requirement ([#968](https://github.com/simshanith/lit-ui-router/issues/968)) ([75ba32a](https://github.com/simshanith/lit-ui-router/commit/75ba32a6a8da487d3b6338fe72e2ac11bbd3a3b3))

## 0.3.2 (2026-09-13)

### Documentation

* **plugins:** enable typedoc validation.notDocumented in effect, mobx and navigation-location ([#851](https://github.com/simshanith/lit-ui-router/issues/851)) ([71f2c45](https://github.com/simshanith/lit-ui-router/commit/71f2c455731096c7b0074beecb807bdde9079823)), closes [#834](https://github.com/simshanith/lit-ui-router/issues/834)
* **typedoc-plugin:** migrate [[X]] links to `{@link}` and drop the symbol tables ([#832](https://github.com/simshanith/lit-ui-router/issues/832)) ([b59e8de](https://github.com/simshanith/lit-ui-router/commit/b59e8dee22b2b8cbb61303004d933f02e54dc651)), references [#827](https://github.com/simshanith/lit-ui-router/issues/827) [#830](https://github.com/simshanith/lit-ui-router/issues/830)

## 0.3.1 (2026-09-09)

### Build System

* bump vitest to v5 and drop the @vitest/browser patch ([#424](https://github.com/simshanith/lit-ui-router/issues/424)) ([01b9b1c](https://github.com/simshanith/lit-ui-router/commit/01b9b1cbc7edc9792fcb48d3682e03d813b231a0)), references [vitest-dev/vitest#9381](https://github.com/vitest-dev/vitest/issues/9381) [vitest-dev/vitest#9381](https://github.com/vitest-dev/vitest/issues/9381) [#258](https://github.com/simshanith/lit-ui-router/issues/258)
* **docs:** move the site to www/lit-ui-router.dev with its wrangler config ([#717](https://github.com/simshanith/lit-ui-router/issues/717)) ([53d3a7c](https://github.com/simshanith/lit-ui-router/commit/53d3a7c30a8fdcddc29de4fc77b50b36fde1678b))
* **release:** range a first stable's changelog from the repo root ([#734](https://github.com/simshanith/lit-ui-router/issues/734)) ([fccb746](https://github.com/simshanith/lit-ui-router/commit/fccb746d50c6125a4774b384c341ede7d8f97ca3)), references [#733](https://github.com/simshanith/lit-ui-router/issues/733) [#302](https://github.com/simshanith/lit-ui-router/issues/302) [#423](https://github.com/simshanith/lit-ui-router/issues/423) [#673](https://github.com/simshanith/lit-ui-router/issues/673)
* **workspace:** declare oxlint and oxfmt in every package that runs them ([#586](https://github.com/simshanith/lit-ui-router/issues/586)) ([daa7ff8](https://github.com/simshanith/lit-ui-router/commit/daa7ff8b36c2dd98119a4da4a256ac8327f40db0))

## 0.3.0 (2026-08-10)

### Features

* **navigation-location-plugin:** support subclassing the Navigation seam ([#536](https://github.com/simshanith/lit-ui-router/issues/536)) ([821fbc7](https://github.com/simshanith/lit-ui-router/commit/821fbc725b5e94db84156e5cdf7063f076ed8b81)), references [#530](https://github.com/simshanith/lit-ui-router/issues/530)

### Code Refactoring

* **navigation-location-plugin:** seam the Navigation API and test it for real ([#530](https://github.com/simshanith/lit-ui-router/issues/530)) ([965ac27](https://github.com/simshanith/lit-ui-router/commit/965ac27689cf522e594bf4bc9ef2cb52d6769865))

## 0.2.4 (2026-08-02)

### Bug Fixes

* **release:** show Build System section in release notes ([#423](https://github.com/simshanith/lit-ui-router/issues/423)) ([7f6e4fa](https://github.com/simshanith/lit-ui-router/commit/7f6e4fa99f16104d0f3d204d57bf04819cf9571e))

### Build System

* consolidate variant outputs under dist/ — dist/hash, worker/dist ([#417](https://github.com/simshanith/lit-ui-router/issues/417)) ([aa6485e](https://github.com/simshanith/lit-ui-router/commit/aa6485e01408428e1e45a71516a5256b73a9491c))

## 0.2.3 (2026-07-19)

### Features

* **release:** tools/release + mise task pipeline, zizmor audit, published-diff guard ([#331](https://github.com/simshanith/lit-ui-router/issues/331)) ([d7abe18](https://github.com/simshanith/lit-ui-router/commit/d7abe18020308b8c830ce2dc0931011525037c7f)), closes [release#test](https://github.com/simshanith/release/issues/test) [#323](https://github.com/simshanith/lit-ui-router/issues/323) [#302](https://github.com/simshanith/lit-ui-router/issues/302) [#302](https://github.com/simshanith/lit-ui-router/issues/302) [#build](https://github.com/simshanith/lit-ui-router/issues/build) [#334](https://github.com/simshanith/lit-ui-router/issues/334) [#335](https://github.com/simshanith/lit-ui-router/issues/335) [#334](https://github.com/simshanith/lit-ui-router/issues/334)

## 0.2.2 (2026-07-12)

### Features

* **lint:** triage and enable the remaining tsgolint type-aware rules ([#277](https://github.com/simshanith/lit-ui-router/issues/277)) ([f5b3331](https://github.com/simshanith/lit-ui-router/commit/f5b333141662ffef4422f94405c869df4d8b25fe)), closes [#285](https://github.com/simshanith/lit-ui-router/issues/285) [#279](https://github.com/simshanith/lit-ui-router/issues/279)
* **release:** conventional-changelog release notes ([#207](https://github.com/simshanith/lit-ui-router/issues/207)) ([6a6e7bc](https://github.com/simshanith/lit-ui-router/commit/6a6e7bcd59478945d7b27f493deeaf341dfa7a19))
* **tooling:** adopt oxlint-tsgolint type-aware linting ([#233](https://github.com/simshanith/lit-ui-router/issues/233)) ([376be35](https://github.com/simshanith/lit-ui-router/commit/376be35c23fb690f910d8ae6e92ab8d594710715))
* **tooling:** migrate eslint to oxlint ([#231](https://github.com/simshanith/lit-ui-router/issues/231)) ([7bb0c12](https://github.com/simshanith/lit-ui-router/commit/7bb0c128370d0d5b0c0ad5e4882ced515769e9b5))
* **tooling:** migrate prettier to oxfmt ([#232](https://github.com/simshanith/lit-ui-router/issues/232)) ([f9ce7e2](https://github.com/simshanith/lit-ui-router/commit/f9ce7e202f385060d791c7a98472e4297d320386))
* **tooling:** typescript 7.0 with a typescript6-compat catalog for API consumers ([#249](https://github.com/simshanith/lit-ui-router/issues/249)) ([f6bd36a](https://github.com/simshanith/lit-ui-router/commit/f6bd36ac8e8661f01c7688c9364ced7809e04c3a))

### Bug Fixes

* **turbo:** stable app-build hashes via transit deps + cached docs:api ([#278](https://github.com/simshanith/lit-ui-router/issues/278)) ([5c15100](https://github.com/simshanith/lit-ui-router/commit/5c151006c5d5c439c5348b24e09d61f4e98fd4e8)), closes [sample-app-shared#transit](https://github.com/simshanith/sample-app-shared/issues/transit)

## 0.2.1 (2026-07-07)

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
* Release 0.3.1 (#175) (d8533e7)
* fix(ci): publish the pnpm-packed tarball, not an npm re-pack (#173) (44e98c1)
* chore(tooling): node 24 + @types/node 24 (#172) (31e2a84)
* ci: push only the tag ref from Tag & push (#171) (f9d5087)

## 0.2.0 (2026-07-06)

* Release 1.5.0 (#168) (eed692c)
* Release 0.3.0 (#169) (805dcd2)
* feat(packages): add exports maps and sideEffects to published manifests (#167) (064c691)
* chore(tooling): upgrade to ESLint 10 (#166) (a70fba3)
* feat(tooling): dts-backtest consumer-floor guard + TypeScript 6.0 (#165) (c639acd)

## 0.1.2 (2026-07-06)

* feat(sample-apps): add Navigation API feature detection (#137) (1bc77f2)
* refactor(sample-apps): extract sample-app-shared internal package (#163) (9e630f0)
* chore(examples): bump lit-ui-router to ^1.4.0 (#161) (ebf6ed0)
* ci: serialize Tag & push runs to stop rollback tag deletion (#162) (4df93c0)
* Release 0.2.0 (#160) (1a0d806)
* Release 1.4.0 (#159) (c771703)
* chore: dependency upgrades (July 2026) (#157) (62108b9)
* fix(sample-apps): restore shared dialog design from react/angular sample apps (#158) (31661e7)
* ci: release-it 20 native draft flow for immutable releases (#156) (e1cb7d8)
* ci: add lit-ui-router-mobx to release workflow package lists (#154) (d8afadd)
* Release 1.3.0 (#155) (864d5c2)
* feat: lit-ui-router-mobx package + MobX sample app variant (#148) (0a5933d)
* feat: TransitionController — reactive controller for UI-Router transitions (#147) (b067a14)
* ci: bump checkout to v5, codecov-action to v7 for node24 runtime (#152) (611d30d)
* ci: add dry-run support to release workflows (#150) (3b389c3)
* ci: provision node/pnpm/turbo via mise-action (#149) (9bf4257)
* docs: switch CONTRIBUTING.md to mise (#146) (57a5240)
* ci: enforce catalog for dependencies shared by 2+ packages (#145) (cf880dd)
* ci: hoist + catalog shared workspace tooling (#144) (da8494d)
* docs: cross-origin-isolated StackBlitz embed (#143) (7a82524)
* chore: upgrade pnpm and npm dependencies (#142) (71afcb4)
* Release 1.2.5 (#141) (83ce29c)
* docs: highlight simple template capability (#140) (9811994)
* docs: adjust helloworld tutorial to use simple component shorthand (#139) (15d4ecc)
* docs: add TURBO.md workflow guide (#136) (d1b7a28)
* docs: fix homepage release link (#138) (10ffe0c)

## 0.1.1 (2026-01-16)

* chore: remove AGENTS.md (#134) (bae8904)
* chore: uninstall beads (#133) (a1a00e1)
* ci: release version in commit with changelog (#132) (d895301)
* bd daemon sync: 2026-01-13 23:56:03 (be39419)
* chore: unstealth beads (#128) (9794502)
* fix(navigation-location-plugin): code quality improvements (#130) (ad3f2c9)

## 0.1.0 (2026-01-14)

* feat(navigation-location-plugin): prepare package for npm publish (#125) (d75151a)
