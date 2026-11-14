# Changelog

Prereleases and canaries are not listed here; see [all releases on GitHub](https://github.com/simshanith/lit-ui-router/releases?q=lit-ui-router%40&expanded=true).

## 1.20.0 (2026-11-12)

### Features

* **lit-ui-router:** add uiViewProps beside a deprecated _uiViewProps ([#2071](https://github.com/simshanith/lit-ui-router/issues/2071)) ([df8b4e2](https://github.com/simshanith/lit-ui-router/commit/df8b4e2ce36e6735005b79e7d7290b1c218f7c7f))
* **lit-ui-router:** expose a view's ActiveUIView to companion packages ([#2047](https://github.com/simshanith/lit-ui-router/issues/2047)) ([dafbd7a](https://github.com/simshanith/lit-ui-router/commit/dafbd7ad0c6a59da0102cc288b8feb932f5fa2a8))

### Build System

* drop stale overrides, knip ignores and lint disables from the exception lists ([#1909](https://github.com/simshanith/lit-ui-router/issues/1909)) ([52faefd](https://github.com/simshanith/lit-ui-router/commit/52faefd28347d7437db68607d629f5a6f02c8ad7)), references [#721](https://github.com/simshanith/lit-ui-router/issues/721) [#1448](https://github.com/simshanith/lit-ui-router/issues/1448) [#1474](https://github.com/simshanith/lit-ui-router/issues/1474) [#1534](https://github.com/simshanith/lit-ui-router/issues/1534) [#1907](https://github.com/simshanith/lit-ui-router/issues/1907) [#1901](https://github.com/simshanith/lit-ui-router/issues/1901)
* **lint:** replace lit-analyzer with a TypeScript 7.1 template checker ([#1650](https://github.com/simshanith/lit-ui-router/issues/1650)) ([f1ec5f6](https://github.com/simshanith/lit-ui-router/commit/f1ec5f601a2ff821a8783f4dade91359c91f1da4)), closes [#700](https://github.com/simshanith/lit-ui-router/issues/700) [#1892](https://github.com/simshanith/lit-ui-router/issues/1892) [#270](https://github.com/simshanith/lit-ui-router/issues/270)
* **lint:** type-check doc-comment `@example` blocks on the TypeScript 7.1 API ([#1769](https://github.com/simshanith/lit-ui-router/issues/1769)) ([cc4269e](https://github.com/simshanith/lit-ui-router/commit/cc4269eaaac9d93b993d634f9ce017b15efa64b5)), closes [#1756](https://github.com/simshanith/lit-ui-router/issues/1756)
* **lint:** type-check opted-in Markdown ts blocks on the TypeScript 7.1 API ([#1663](https://github.com/simshanith/lit-ui-router/issues/1663)) ([1ee0ce3](https://github.com/simshanith/lit-ui-router/commit/1ee0ce3464c1a66d3d4655e10c4ef17eab936566))

### Documentation

* fix doc examples the TypeScript 7.1 checker spikes flag ([#1808](https://github.com/simshanith/lit-ui-router/issues/1808)) ([9bd5fb4](https://github.com/simshanith/lit-ui-router/commit/9bd5fb4270687400d5ae0aca8b9464db371262e8))

<details>
<summary>Also touched this package (2)</summary>

* **www:** add the lit-ui-router package page and generate the reference index ([#2031](https://github.com/simshanith/lit-ui-router/pull/2031))
* **www:** move the API reference to /reference/\<npm-name>/ ([#2028](https://github.com/simshanith/lit-ui-router/pull/2028))

</details>

[Release page](https://lit-ui-router.dev/releases/lit-ui-router/1.20.0/) · [Diff from 1.19.1](https://lit-ui-router.dev/releases/lit-ui-router/diff/1.19.1...1.20.0/)

## 1.19.1 (2026-11-01)

### Bug Fixes

* **lit-ui-router:** default viewRendered() to the transition in flight ([#1743](https://github.com/simshanith/lit-ui-router/issues/1743)) ([66aadc7](https://github.com/simshanith/lit-ui-router/commit/66aadc764432c24b88770c24ec8da1b1b87720e3)), closes [#1727](https://github.com/simshanith/lit-ui-router/issues/1727)
* **lit-ui-router:** forget a removed link in a uiSrefActive container ([#1746](https://github.com/simshanith/lit-ui-router/issues/1746)) ([2f28a0b](https://github.com/simshanith/lit-ui-router/commit/2f28a0b26a9fd9de6f174ac44a164c03c7fe7570))
* **lit-ui-router:** hand a retained routed element the latest transition ([#1739](https://github.com/simshanith/lit-ui-router/issues/1739)) ([51e7405](https://github.com/simshanith/lit-ui-router/commit/51e740522fcba138928f84b9d04c12f59080a48f)), closes [#1725](https://github.com/simshanith/lit-ui-router/issues/1725)
* **lit-ui-router:** move [routed] when a template view's children change without an update ([#1741](https://github.com/simshanith/lit-ui-router/issues/1741)) ([fa1e278](https://github.com/simshanith/lit-ui-router/commit/fa1e2784dcea1f6e1ab4af4cebe90e80ac7d421e))
* **lit-ui-router:** remove the unread _first in ui-sref-active that retains the first directive ([#1740](https://github.com/simshanith/lit-ui-router/issues/1740)) ([dec1e87](https://github.com/simshanith/lit-ui-router/commit/dec1e878544467759c3cbe503953de4395385eb8)), closes [#1730](https://github.com/simshanith/lit-ui-router/issues/1730)
* **lit-ui-router:** type UiSrefActiveParams fields as optional, as uiSrefActive accepts them ([#1737](https://github.com/simshanith/lit-ui-router/issues/1737)) ([1fea14b](https://github.com/simshanith/lit-ui-router/commit/1fea14bf6e41ce556500a873ef76cf1083c9ff35)), closes [#1729](https://github.com/simshanith/lit-ui-router/issues/1729)

### Documentation

* fix five doc-comment examples that don't type-check ([#1776](https://github.com/simshanith/lit-ui-router/issues/1776)) ([0007855](https://github.com/simshanith/lit-ui-router/commit/0007855eaeaa3b4a08298d774474addb0d972026)), references [#1665](https://github.com/simshanith/lit-ui-router/issues/1665) [#1769](https://github.com/simshanith/lit-ui-router/issues/1769)
* **lit-ui-router:** correct when [routed] moves, what it marks, and which swaps are held ([#1738](https://github.com/simshanith/lit-ui-router/issues/1738)) ([8f3fdfb](https://github.com/simshanith/lit-ui-router/commit/8f3fdfbc8c022f4beeaec96255c512b873760d8b))

## 1.19.0 (2026-10-30)

### Features

* **lit-ui-router:** export the routed view's template helper and adopt served class elements ([#1653](https://github.com/simshanith/lit-ui-router/issues/1653)) ([c8e739d](https://github.com/simshanith/lit-ui-router/commit/c8e739d19ae7ced95f71a88539c25c4f3a45ac01)), references [#1527](https://github.com/simshanith/lit-ui-router/issues/1527) [#1528](https://github.com/simshanith/lit-ui-router/issues/1528)

## 1.18.0 (2026-10-29)

### Features

* **lit-ui-router:** add TypedLitStateDeclaration to check state tables without inferring render() ([#1615](https://github.com/simshanith/lit-ui-router/issues/1615)) ([a270950](https://github.com/simshanith/lit-ui-router/commit/a270950a2534a04c9803884de3c2d51cfd852614)), references [#1448](https://github.com/simshanith/lit-ui-router/issues/1448)
* **lit-ui-router:** add viewRendered() to await the routed views' render ([#1507](https://github.com/simshanith/lit-ui-router/issues/1507)) ([b499e2a](https://github.com/simshanith/lit-ui-router/commit/b499e2a5dbc4468e389a37649ff590f3893d2541)), closes [#982](https://github.com/simshanith/lit-ui-router/issues/982)
* **lit-ui-router:** keep a replaced element until its successor renders, and add routedElement ([#1508](https://github.com/simshanith/lit-ui-router/issues/1508)) ([a3582ab](https://github.com/simshanith/lit-ui-router/commit/a3582ab176034e8bf525f94dd1faa2e27cfa0155)), closes [#757](https://github.com/simshanith/lit-ui-router/issues/757), references [#757](https://github.com/simshanith/lit-ui-router/issues/757)

### Documentation

* **www:** fix install lines, stale introduction facts and add a location plugin recommendation ([#1564](https://github.com/simshanith/lit-ui-router/issues/1564)) ([f517c29](https://github.com/simshanith/lit-ui-router/commit/f517c2942f8798e5ecd14d7685757a96ce7ae8d2))

## 1.17.0 (2026-10-22)

### Features

* **lit-ui-router:** deprecate the ui-router-context discovery event ([#1479](https://github.com/simshanith/lit-ui-router/issues/1479)) ([e730f33](https://github.com/simshanith/lit-ui-router/commit/e730f3325e4d4e7fb913332cc26c0001c4d15a83)), references [#874](https://github.com/simshanith/lit-ui-router/issues/874) [#874](https://github.com/simshanith/lit-ui-router/issues/874)
* **lit-ui-router:** export custom-elements.json by name ([#1485](https://github.com/simshanith/lit-ui-router/issues/1485)) ([bca306a](https://github.com/simshanith/lit-ui-router/commit/bca306a3bf78d27844504f512ffd34d732d00b86)), closes [#1484](https://github.com/simshanith/lit-ui-router/issues/1484), references [#878](https://github.com/simshanith/lit-ui-router/issues/878)
* **lit-ui-router:** name the root entry's exports and deprecate the `@internal` plumbing ([#1487](https://github.com/simshanith/lit-ui-router/issues/1487)) ([c3887f6](https://github.com/simshanith/lit-ui-router/commit/c3887f6ad610ef1b53cc2382641e1069492703b1)), references [#874](https://github.com/simshanith/lit-ui-router/issues/874) [#876](https://github.com/simshanith/lit-ui-router/issues/876) [#541](https://github.com/simshanith/lit-ui-router/issues/541) [#873](https://github.com/simshanith/lit-ui-router/issues/873)

### Documentation

* link the package README release badges to each package's latest GitHub release ([#1501](https://github.com/simshanith/lit-ui-router/issues/1501)) ([9e96854](https://github.com/simshanith/lit-ui-router/commit/9e96854750595230146252667c85ea7b2fc1714d))

## 1.16.5 (2026-10-15)

### Bug Fixes

* **lit-ui-router:** pass NOWAIT resolves to routed components as promises ([#1316](https://github.com/simshanith/lit-ui-router/issues/1316)) ([24a7a6f](https://github.com/simshanith/lit-ui-router/commit/24a7a6f7989865e7665ee9e73b04a70cdc8382ee)), references [#1322](https://github.com/simshanith/lit-ui-router/issues/1322)

### Documentation

* show one npm install command per block and on the home hero ([#1262](https://github.com/simshanith/lit-ui-router/issues/1262)) ([d5c4bae](https://github.com/simshanith/lit-ui-router/commit/d5c4bae96b1918ac3a131b48cd6bb2c43f9bd8f2))

## 1.16.4 (2026-10-12)

### Bug Fixes

* **lit-ui-router:** follow the placeholder router's upgrade in the router directives ([#1190](https://github.com/simshanith/lit-ui-router/issues/1190)) ([a703f9d](https://github.com/simshanith/lit-ui-router/commit/a703f9dacab192f9b5fac6c6eceec8bab92b5d27)), closes [#1081](https://github.com/simshanith/lit-ui-router/issues/1081), references [#1082](https://github.com/simshanith/lit-ui-router/issues/1082)

## 1.16.3 (2026-10-10)

### Code Refactoring

* enable anti-slop no-runtime-typeof and decode or name each type check ([#1153](https://github.com/simshanith/lit-ui-router/issues/1153)) ([05accd8](https://github.com/simshanith/lit-ui-router/commit/05accd8644aa01086aa064c83f7d4d4df0a7d44a))
* enable the anti-slop type-assertion rules and retype or justify each cast ([#1152](https://github.com/simshanith/lit-ui-router/issues/1152)) ([643814f](https://github.com/simshanith/lit-ui-router/commit/643814f6ab4e2f976e4bb1746d9a44cb823ac327))
* enable the anti-slop typing rules and tighten the types they flag ([#1151](https://github.com/simshanith/lit-ui-router/issues/1151)) ([a16befb](https://github.com/simshanith/lit-ui-router/commit/a16befbf026033f0085bc0bd40cf671887861040))

### Build System

* vendor the anti-slop oxlint plugin as @tools/oxlint-anti-slop ([#1143](https://github.com/simshanith/lit-ui-router/issues/1143)) ([e1b60ed](https://github.com/simshanith/lit-ui-router/commit/e1b60ed326884cf7217eb195e0c82d33b4d738ba))

## 1.16.2 (2026-10-04)

### Bug Fixes

* **lit-ui-router:** report throwing upgrade subscribers through reportError ([#1113](https://github.com/simshanith/lit-ui-router/issues/1113)) ([6012a02](https://github.com/simshanith/lit-ui-router/commit/6012a02e21d660b3cb4245a10e6783b300773891)), references [#1078](https://github.com/simshanith/lit-ui-router/issues/1078)

## 1.16.1 (2026-10-04)

### Bug Fixes

* **lit-ui-router:** deliver the placeholder router's upgrade to subscribers ([#1082](https://github.com/simshanith/lit-ui-router/issues/1082)) ([641f8b7](https://github.com/simshanith/lit-ui-router/commit/641f8b77d580078b909c010415566e1d5b1f106a)), references [#1078](https://github.com/simshanith/lit-ui-router/issues/1078)

### Build System

* **tools:** add a report-only crap task for CRAP hotspots ([#1056](https://github.com/simshanith/lit-ui-router/issues/1056)) ([d39b706](https://github.com/simshanith/lit-ui-router/commit/d39b7064f8d9d8036fac1257ca319618064b7f73)), references [crap-rs#193](https://github.com/crap-rs/issues/193)
* **turbo:** replace with sidecars with umbrella tasks ([#1038](https://github.com/simshanith/lit-ui-router/issues/1038)) ([aec4ee8](https://github.com/simshanith/lit-ui-router/commit/aec4ee8a8a6a44c8a3c99a7e08abb789343ef8e0))

## 1.16.0 (2026-09-28)

### Features

* **lit-ui-router:** ui-view answers context-request for its parent view ([#918](https://github.com/simshanith/lit-ui-router/issues/918)) ([d22ef7e](https://github.com/simshanith/lit-ui-router/commit/d22ef7ed36ea23eab192661190e102395d8cc3f0))
* **lit-ui-router:** ui-view sleeps under defer-hydration and requests its adopter on the wake ([#901](https://github.com/simshanith/lit-ui-router/issues/901)) ([39b71a0](https://github.com/simshanith/lit-ui-router/commit/39b71a0d9f10d17a39601949daebf1d3050aa3ad)), references [#829](https://github.com/simshanith/lit-ui-router/issues/829) [#898](https://github.com/simshanith/lit-ui-router/issues/898)

### Bug Fixes

* **lit-ui-router:** adopt a late provider's router before ui-view's first render ([#990](https://github.com/simshanith/lit-ui-router/issues/990)) ([393543c](https://github.com/simshanith/lit-ui-router/commit/393543cc9cdfaca55c159c18b1b3f9eab972fcd1))
* **lit-ui-router:** name the class that holds the tag when a register module stands down ([#977](https://github.com/simshanith/lit-ui-router/issues/977)) ([56f9fb3](https://github.com/simshanith/lit-ui-router/commit/56f9fb3f81f023ebc79123a25d6ae521de86e748))

### Code Refactoring

* **lit-ui-router:** lift the hydration seam out of ui-view into the ssr served view ([#941](https://github.com/simshanith/lit-ui-router/issues/941)) ([9672155](https://github.com/simshanith/lit-ui-router/commit/967215563733206a9d7364973268e67cc9316b58))

### Documentation

* **lit-ui-router:** the view renders after the transition, the resolves generic, and initial's query ([#978](https://github.com/simshanith/lit-ui-router/issues/978)) ([834db17](https://github.com/simshanith/lit-ui-router/commit/834db178ff37716cad818829d45c1aa7f8d93390))

## 1.15.0 (2026-09-14)

### Features

* **lit-ui-router-ssr:** prerender a static site from a mount table's verdicts ([#880](https://github.com/simshanith/lit-ui-router/issues/880)) ([3793133](https://github.com/simshanith/lit-ui-router/commit/379313376d645069e23100a11a654b35d766ce16)), closes [#806](https://github.com/simshanith/lit-ui-router/issues/806)
* **lit-ui-router:** answer the context-request community protocol for the router ([#870](https://github.com/simshanith/lit-ui-router/issues/870)) ([5ae1b09](https://github.com/simshanith/lit-ui-router/commit/5ae1b09c8cc51baf31caf657f245edc48a73cfaf)), references [#838](https://github.com/simshanith/lit-ui-router/issues/838) [#829](https://github.com/simshanith/lit-ui-router/issues/829)
* **lit-ui-router:** hand a router to a server render through the context entry ([#883](https://github.com/simshanith/lit-ui-router/issues/883)) ([d76e713](https://github.com/simshanith/lit-ui-router/commit/d76e71339f6cfbdc4afae2ede62a7309b71aa0bf)), references [#829](https://github.com/simshanith/lit-ui-router/issues/829) [#838](https://github.com/simshanith/lit-ui-router/issues/838)
* **lit-ui-router:** the sref directives render from the scoped router ([#872](https://github.com/simshanith/lit-ui-router/issues/872)) ([d9af90b](https://github.com/simshanith/lit-ui-router/commit/d9af90b3c22b4891e7ef05372d68f456db3204d9)), references [#829](https://github.com/simshanith/lit-ui-router/issues/829) [#838](https://github.com/simshanith/lit-ui-router/issues/838) [#887](https://github.com/simshanith/lit-ui-router/issues/887)

## 1.14.1 (2026-09-13)

### Documentation

* **lit-ui-router:** enable typedoc validation.notDocumented ([#850](https://github.com/simshanith/lit-ui-router/issues/850)) ([a29d619](https://github.com/simshanith/lit-ui-router/commit/a29d619f5b8cda4683587c51bea4695226763b23)), closes [#834](https://github.com/simshanith/lit-ui-router/issues/834)

## 1.14.0 (2026-09-13)

### Features

* **lit-ui-router:** add srefHref, srefActiveClass and srefAriaCurrent attribute directives ([#827](https://github.com/simshanith/lit-ui-router/issues/827)) ([26d8c9d](https://github.com/simshanith/lit-ui-router/commit/26d8c9d4673caa49da3d87d1c24bf7a16d80e2d8)), references [#564](https://github.com/simshanith/lit-ui-router/issues/564) [#830](https://github.com/simshanith/lit-ui-router/issues/830)
* **lit-ui-router:** add SrefStatusController for composing active status with classMap ([#830](https://github.com/simshanith/lit-ui-router/issues/830)) ([d8b2cab](https://github.com/simshanith/lit-ui-router/commit/d8b2cab810c09c37df01efe1fe2999e65dd5ba27))

## 1.13.0 (2026-09-12)

### Features

* **lit-ui-router:** render `<ui-view>` under @lit-labs/ssr ([#814](https://github.com/simshanith/lit-ui-router/issues/814)) ([f91675a](https://github.com/simshanith/lit-ui-router/commit/f91675a031f74f9f87423f93b46b673248c3e5e8)), closes [#803](https://github.com/simshanith/lit-ui-router/issues/803), references [#817](https://github.com/simshanith/lit-ui-router/issues/817) [#348](https://github.com/simshanith/lit-ui-router/issues/348) [#564](https://github.com/simshanith/lit-ui-router/issues/564)

### Bug Fixes

* **lit-ui-router:** follow a uiSref that re-targets after a lazy load ([#819](https://github.com/simshanith/lit-ui-router/issues/819)) ([920a2e4](https://github.com/simshanith/lit-ui-router/commit/920a2e4f64ae2e78c2f15d4aed10f7b81bea9291)), references [#588](https://github.com/simshanith/lit-ui-router/issues/588)
* **lit-ui-router:** re-arm uiSref and uiSrefActive on reconnect ([#796](https://github.com/simshanith/lit-ui-router/issues/796)) ([3bd336f](https://github.com/simshanith/lit-ui-router/commit/3bd336fb926e2844ffa619fae0f3ec797dd41502)), references [#755](https://github.com/simshanith/lit-ui-router/issues/755) [#723](https://github.com/simshanith/lit-ui-router/issues/723)
* **lit-ui-router:** route a ui-view whose `<ui-router>` upgraded late ([#821](https://github.com/simshanith/lit-ui-router/issues/821)) ([f0f64c1](https://github.com/simshanith/lit-ui-router/commit/f0f64c1d31f7fb09d1e4f818804c2b438a7fe89f)), references [#814](https://github.com/simshanith/lit-ui-router/issues/814) [#796](https://github.com/simshanith/lit-ui-router/issues/796)

### Build System

* **lit-ui-router:** order the custom-elements manifest before build ([#802](https://github.com/simshanith/lit-ui-router/issues/802)) ([c3ab3cc](https://github.com/simshanith/lit-ui-router/commit/c3ab3cc99d6fd9a35ba53221339f2256a2b1a605)), references [#796](https://github.com/simshanith/lit-ui-router/issues/796)

## 1.12.0 (2026-09-09)

### Features

* **lit-ui-router:** reuse the routed element while the view config is unchanged ([#755](https://github.com/simshanith/lit-ui-router/issues/755)) ([455968f](https://github.com/simshanith/lit-ui-router/commit/455968f8c00a073a4e5ee8e72aa8bf7d3f7e1020)), references [#723](https://github.com/simshanith/lit-ui-router/issues/723) [#723](https://github.com/simshanith/lit-ui-router/issues/723)

### Build System

* **docs:** move the site to www/lit-ui-router.dev with its wrangler config ([#717](https://github.com/simshanith/lit-ui-router/issues/717)) ([53d3a7c](https://github.com/simshanith/lit-ui-router/commit/53d3a7c30a8fdcddc29de4fc77b50b36fde1678b))
* **release:** range a first stable's changelog from the repo root ([#734](https://github.com/simshanith/lit-ui-router/issues/734)) ([fccb746](https://github.com/simshanith/lit-ui-router/commit/fccb746d50c6125a4774b384c341ede7d8f97ca3)), references [#733](https://github.com/simshanith/lit-ui-router/issues/733) [#302](https://github.com/simshanith/lit-ui-router/issues/302) [#423](https://github.com/simshanith/lit-ui-router/issues/423) [#673](https://github.com/simshanith/lit-ui-router/issues/673)

## 1.11.2 (2026-09-05)

### Build System

* bump vitest to v5 and drop the @vitest/browser patch ([#424](https://github.com/simshanith/lit-ui-router/issues/424)) ([01b9b1c](https://github.com/simshanith/lit-ui-router/commit/01b9b1cbc7edc9792fcb48d3682e03d813b231a0)), references [vitest-dev/vitest#9381](https://github.com/vitest-dev/vitest/issues/9381) [vitest-dev/vitest#9381](https://github.com/vitest-dev/vitest/issues/9381) [#258](https://github.com/simshanith/lit-ui-router/issues/258)
* clear `pnpm peers check`; one graph-edges guard over static turbo edges ([#693](https://github.com/simshanith/lit-ui-router/issues/693)) ([13e69b7](https://github.com/simshanith/lit-ui-router/commit/13e69b76314be38e21b4e098bffff842d9f52be3)), references [#375](https://github.com/simshanith/lit-ui-router/issues/375) [#526](https://github.com/simshanith/lit-ui-router/issues/526) [lit-ui-router#test](https://github.com/lit-ui-router/issues/test) [tools/dts-backtest#test](https://github.com/tools/dts-backtest/issues/test) [sample-app-shared#test](https://github.com/sample-app-shared/issues/test) [lit-ui-router#test](https://github.com/lit-ui-router/issues/test) [#695](https://github.com/simshanith/lit-ui-router/issues/695)

## 1.11.1 (2026-09-02)

### Bug Fixes

* **lit-ui-router:** fold the missing-router warning out of the production build ([#687](https://github.com/simshanith/lit-ui-router/issues/687)) ([0411bac](https://github.com/simshanith/lit-ui-router/commit/0411bacffcdfe92bfd08fa49e077cc382a739ca1)), references [#637](https://github.com/simshanith/lit-ui-router/issues/637) [#670](https://github.com/simshanith/lit-ui-router/issues/670)

## 1.11.0 (2026-09-02)

### Features

* **lit-ui-router:** require an href before handing a click to the browser ([#627](https://github.com/simshanith/lit-ui-router/issues/627)) ([148426f](https://github.com/simshanith/lit-ui-router/commit/148426f15b77ae46f877a19b3461b51962fd0615)), closes [#602](https://github.com/simshanith/lit-ui-router/issues/602)
* **lit-ui-router:** warn in lit dev mode when no `<ui-router>` ancestor is found ([#637](https://github.com/simshanith/lit-ui-router/issues/637)) ([94513a9](https://github.com/simshanith/lit-ui-router/commit/94513a928044de8cc7f958944a3c824b13224797)), closes [#599](https://github.com/simshanith/lit-ui-router/issues/599), references [#541](https://github.com/simshanith/lit-ui-router/issues/541)

### Build System

* **lit-ui-router:** dev/prod builds behind the development export condition ([#670](https://github.com/simshanith/lit-ui-router/issues/670)) ([7cccd6a](https://github.com/simshanith/lit-ui-router/commit/7cccd6a970342109136a6771745124dc14c9df4b)), closes [#598](https://github.com/simshanith/lit-ui-router/issues/598)

## 1.10.0 (2026-08-17)

### Features

* **lit-ui-router:** add uiSref assignHref to scope the href to links ([#590](https://github.com/simshanith/lit-ui-router/issues/590)) ([da7b50a](https://github.com/simshanith/lit-ui-router/commit/da7b50a28b3806028b6d5e9fb62d3cbf0c0d6069)), closes [#577](https://github.com/simshanith/lit-ui-router/issues/577), references [#597](https://github.com/simshanith/lit-ui-router/issues/597) [#577](https://github.com/simshanith/lit-ui-router/issues/577)
* **lit-ui-router:** set aria-current on active ui-sref links ([#556](https://github.com/simshanith/lit-ui-router/issues/556)) ([7473c0c](https://github.com/simshanith/lit-ui-router/commit/7473c0c5a12c109c0fc6dbc5f7d8e606eb4b2ea0)), references [#553](https://github.com/simshanith/lit-ui-router/issues/553) [#577](https://github.com/simshanith/lit-ui-router/issues/577)

### Bug Fixes

* clear the two warnings left in a green CI run ([#529](https://github.com/simshanith/lit-ui-router/issues/529)) ([f3ee0de](https://github.com/simshanith/lit-ui-router/commit/f3ee0de54d7bf3d268d79a42d7b83dd17695e31a))
* **lit-ui-router:** correct the uiSref click guards ([#589](https://github.com/simshanith/lit-ui-router/issues/589)) ([7978f17](https://github.com/simshanith/lit-ui-router/commit/7978f1798714370ba4adaaedc646fa0c1a0ba4d0)), closes [#576](https://github.com/simshanith/lit-ui-router/issues/576)
* **lit-ui-router:** dispatch uiSrefTarget on target change, not href change ([#588](https://github.com/simshanith/lit-ui-router/issues/588)) ([2f5ddc4](https://github.com/simshanith/lit-ui-router/commit/2f5ddc4bc919002afdc277a5c78f0cb767355abf)), references [#576](https://github.com/simshanith/lit-ui-router/issues/576) [#577](https://github.com/simshanith/lit-ui-router/issues/577)
* **lit-ui-router:** treat any target but _self as leaving the app ([#596](https://github.com/simshanith/lit-ui-router/issues/596)) ([6e6a555](https://github.com/simshanith/lit-ui-router/commit/6e6a555ffe2d706d7a35e0401b3b1e8543545308)), closes [#592](https://github.com/simshanith/lit-ui-router/issues/592), references [#576](https://github.com/simshanith/lit-ui-router/issues/576) [#576](https://github.com/simshanith/lit-ui-router/issues/576)

### Code Refactoring

* **compat:** read catalogs via the pnpm SDK, split the lit2 lane ([#525](https://github.com/simshanith/lit-ui-router/issues/525)) ([9c17b2b](https://github.com/simshanith/lit-ui-router/commit/9c17b2b128416ee0e58215c71d65b6c5a7325c5f))
* **lit-ui-router:** bind core's untyped forEach at module scope ([#594](https://github.com/simshanith/lit-ui-router/issues/594)) ([50547a6](https://github.com/simshanith/lit-ui-router/commit/50547a670410089e7f1da25a47249540e9e296b9))
* **test:** share lit vitest.setup body via @tools/lit-test-env ([#531](https://github.com/simshanith/lit-ui-router/issues/531)) ([e55fda9](https://github.com/simshanith/lit-ui-router/commit/e55fda91bee7a94457f870e9296ebac4eff49994))

### Build System

* **eslint:** adopt eslint-plugin-lit, -wc and -lit-a11y over src ([#557](https://github.com/simshanith/lit-ui-router/issues/557)) ([ac44e71](https://github.com/simshanith/lit-ui-router/commit/ac44e71ee65e6a40f36f016c6ab03ce29aaa10a3)), references [#586](https://github.com/simshanith/lit-ui-router/issues/586)
* **lint:** gate lit templates with a repo-wide lit-analyzer pass ([#543](https://github.com/simshanith/lit-ui-router/issues/543)) ([6c67a63](https://github.com/simshanith/lit-ui-router/commit/6c67a6329eff8e674dd9e0c83cbb4a7e1f34dd57)), references [#331](https://github.com/simshanith/lit-ui-router/issues/331) [#383](https://github.com/simshanith/lit-ui-router/issues/383)
* **workspace:** declare oxlint and oxfmt in every package that runs them ([#586](https://github.com/simshanith/lit-ui-router/issues/586)) ([daa7ff8](https://github.com/simshanith/lit-ui-router/commit/daa7ff8b36c2dd98119a4da4a256ac8327f40db0))

## 1.9.0 (2026-08-01)

### Features

* **deps:** restore lit 2 peer support with a main-graph compat lane ([#490](https://github.com/simshanith/lit-ui-router/issues/490)) ([e28f9cc](https://github.com/simshanith/lit-ui-router/commit/e28f9ccbf6096af300f4418ecbc04c433c589a21)), references [#142](https://github.com/simshanith/lit-ui-router/issues/142)

## 1.8.0 (2026-07-26)

### Features

* **lit-ui-router:** declare lit and @uirouter/core as peers ([#455](https://github.com/simshanith/lit-ui-router/issues/455)) ([7828ac7](https://github.com/simshanith/lit-ui-router/commit/7828ac7124f61743bc147822187b35a3c3c7370f))

### Build System

* **turbo:** exclude mid-graph mutable dirs from lint/format hashes ([#466](https://github.com/simshanith/lit-ui-router/issues/466)) ([1dd2980](https://github.com/simshanith/lit-ui-router/commit/1dd298063bea092032ca9bdb5308b17f0833e978)), closes [lit-ui-router#build](https://github.com/simshanith/lit-ui-router/issues/build)

## 1.7.2 (2026-07-23)

### Features

* **release:** add check:exports (publint + attw) to the PR graph ([#445](https://github.com/simshanith/lit-ui-router/issues/445)) ([152491e](https://github.com/simshanith/lit-ui-router/commit/152491e1e59fc504d8765a26d1dd7b3752334e04))

### Bug Fixes

* **release:** show Build System section in release notes ([#423](https://github.com/simshanith/lit-ui-router/issues/423)) ([7f6e4fa](https://github.com/simshanith/lit-ui-router/commit/7f6e4fa99f16104d0f3d204d57bf04819cf9571e))

### Build System

* consolidate variant outputs under dist/ — dist/hash, worker/dist ([#417](https://github.com/simshanith/lit-ui-router/issues/417)) ([aa6485e](https://github.com/simshanith/lit-ui-router/commit/aa6485e01408428e1e45a71516a5256b73a9491c))

## 1.7.1 (2026-07-19)

### Features

* **release:** tools/release + mise task pipeline, zizmor audit, published-diff guard ([#331](https://github.com/simshanith/lit-ui-router/issues/331)) ([d7abe18](https://github.com/simshanith/lit-ui-router/commit/d7abe18020308b8c830ce2dc0931011525037c7f)), closes [release#test](https://github.com/simshanith/release/issues/test) [#323](https://github.com/simshanith/lit-ui-router/issues/323) [#302](https://github.com/simshanith/lit-ui-router/issues/302) [#302](https://github.com/simshanith/lit-ui-router/issues/302) [#build](https://github.com/simshanith/lit-ui-router/issues/build) [#334](https://github.com/simshanith/lit-ui-router/issues/334) [#335](https://github.com/simshanith/lit-ui-router/issues/335) [#334](https://github.com/simshanith/lit-ui-router/issues/334)
* **tooling:** eslint-plugin-pnpm replaces check:catalog + oxlint overlap suppression ([#300](https://github.com/simshanith/lit-ui-router/issues/300)) ([77ab3cc](https://github.com/simshanith/lit-ui-router/commit/77ab3ccc9acf06aeb9291324a78752d7cebb5857)), closes [#257](https://github.com/simshanith/lit-ui-router/issues/257)

## 1.7.0 (2026-07-12)

### Features

* **exports:** pure entry plus per-element registration modules ([#287](https://github.com/simshanith/lit-ui-router/issues/287)) ([7edf2eb](https://github.com/simshanith/lit-ui-router/commit/7edf2ebca6ffe1160d152f2663a2758824654be2))
* **lint:** triage and enable the remaining tsgolint type-aware rules ([#277](https://github.com/simshanith/lit-ui-router/issues/277)) ([f5b3331](https://github.com/simshanith/lit-ui-router/commit/f5b333141662ffef4422f94405c869df4d8b25fe)), closes [#285](https://github.com/simshanith/lit-ui-router/issues/285) [#279](https://github.com/simshanith/lit-ui-router/issues/279)
* **release:** conventional-changelog release notes ([#207](https://github.com/simshanith/lit-ui-router/issues/207)) ([6a6e7bc](https://github.com/simshanith/lit-ui-router/commit/6a6e7bcd59478945d7b27f493deeaf341dfa7a19))
* **tooling:** typescript 7.0 with a typescript6-compat catalog for API consumers ([#249](https://github.com/simshanith/lit-ui-router/issues/249)) ([f6bd36a](https://github.com/simshanith/lit-ui-router/commit/f6bd36ac8e8661f01c7688c9364ced7809e04c3a))
* **types:** register custom elements in HTMLElementTagNameMap ([#285](https://github.com/simshanith/lit-ui-router/issues/285)) ([cf44b92](https://github.com/simshanith/lit-ui-router/commit/cf44b928a186c6c3a5c79fc89e0e913d4c05d74f))

### Bug Fixes

* **lit-ui-router:** flag the dist/index.js barrel in sideEffects ([#286](https://github.com/simshanith/lit-ui-router/issues/286)) ([c06c653](https://github.com/simshanith/lit-ui-router/commit/c06c653f9185f6ae81a723ca2cf6b975cd7fb3ea))
* **test:** wire vitest.setup.ts via setupFiles ([#251](https://github.com/simshanith/lit-ui-router/issues/251)) ([04c5bc1](https://github.com/simshanith/lit-ui-router/commit/04c5bc1d27ae05a231ca2ec0d919ab8ffb5002e6)), closes [227/#238](https://github.com/227/lit-ui-router/issues/238) [#236](https://github.com/simshanith/lit-ui-router/issues/236)
* **turbo:** stable app-build hashes via transit deps + cached docs:api ([#278](https://github.com/simshanith/lit-ui-router/issues/278)) ([5c15100](https://github.com/simshanith/lit-ui-router/commit/5c151006c5d5c439c5348b24e09d61f4e98fd4e8)), closes [sample-app-shared#transit](https://github.com/simshanith/sample-app-shared/issues/transit)

## 1.6.0 (2026-07-08)

* feat(core): support argless routed element constructors (#245) (0dae1bb)
* fix(types): accept required-props templates and model Lit views in LitStateDeclaration (#241) (bfb005d)
* fix(dev): deterministic dev server ports, no auto-open (#240) (c05eea6)
* ci(turbo): gate umbrella tsconfigs with a cached typecheck task (#242) (9ad552a)
* refactor(lint): promote no-unsafe-* to error and clear all findings (#243) (9680fe3)
* refactor(tooling): umbrella tsconfigs for first-class spec coverage (#236) (77a2b4c)
* chore(release): strip scripts from published manifests at pack (#237) (7137355)
* feat(ci): optional branch-head CI alongside required merge-head check (#235) (9249904)
* feat(tooling): adopt oxlint-tsgolint type-aware linting (#233) (376be35)
* fix(docs): register states individually in Quick Start snippets (#234) (368157e)
* feat(tooling): migrate prettier to oxfmt (#232) (f9ce7e2)
* feat(tooling): migrate eslint to oxlint (#231) (7bb0c12)
* feat(tooling): vite 8 (stable) (#228) (870cab6)
* chore(ci): reduce build-and-test log noise (#227) (065580e)
* fix(docs): silence esbuild dep-optimizer errors in vitepress dev (#225) (5830cb6)
* fix(e2e): migrate Cypress.env to Cypress.expose, disable allowCypressEnv (#226) (b712b12)
* chore(deps): override vitepress's vite to ^6.4.3 for dependabot alerts (#224) (0a56c62)
* docs: Live Examples page embedding the tutorial apps same-origin (#222) (c99449a)
* chore(deps): bump the vitest group with 3 updates (#221) (5b6e09d)
* feat(examples): hellogalaxy Milky Way explorer + docs for the upgraded examples (#219) (f4dfbb7)
* feat(examples): model the real solar system in hellosolarsystem (#216) (c574f0e)
* docs: introduction, guides expansion, and companion-package coverage (#214) (f59cddb)
* fix(examples): bump to lit-ui-router ^1.5.2 and regenerate lockfiles (#213) (43478a1)
* Release 0.3.2 (#212) (882b301)

## 1.5.2 (2026-07-07)

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

## 1.5.1 (2026-07-07)

* Release 0.3.1 (#175) (d8533e7)
* fix(ci): publish the pnpm-packed tarball, not an npm re-pack (#173) (44e98c1)
* chore(tooling): node 24 + @types/node 24 (#172) (31e2a84)
* ci: push only the tag ref from Tag & push (#171) (f9d5087)
* Release 0.2.0 (#170) (9306d7a)

## 1.5.0 (2026-07-06)

* Release 0.3.0 (#169) (805dcd2)
* feat(packages): add exports maps and sideEffects to published manifests (#167) (064c691)
* chore(tooling): upgrade to ESLint 10 (#166) (a70fba3)
* feat(tooling): dts-backtest consumer-floor guard + TypeScript 6.0 (#165) (c639acd)
* Release 0.1.2 (#164) (f16a691)
* feat(sample-apps): add Navigation API feature detection (#137) (1bc77f2)
* refactor(sample-apps): extract sample-app-shared internal package (#163) (9e630f0)
* chore(examples): bump lit-ui-router to ^1.4.0 (#161) (ebf6ed0)
* ci: serialize Tag & push runs to stop rollback tag deletion (#162) (4df93c0)
* Release 0.2.0 (#160) (1a0d806)

## 1.4.0 (2026-07-06)

* chore: dependency upgrades (July 2026) (#157) (62108b9)
* fix(sample-apps): restore shared dialog design from react/angular sample apps (#158) (31661e7)
* ci: release-it 20 native draft flow for immutable releases (#156) (e1cb7d8)
* ci: add lit-ui-router-mobx to release workflow package lists (#154) (d8afadd)

## 1.2.5 (2026-01-20)

* docs: highlight simple template capability (#140) (9811994)
* docs: adjust helloworld tutorial to use simple component shorthand (#139) (15d4ecc)
* docs: add TURBO.md workflow guide (#136) (d1b7a28)
* docs: fix homepage release link (#138) (10ffe0c)

## 1.2.4 (2026-01-14)

* ci: package_dir requires pnpm; release badges (#126) (0a327ef)
* feat(navigation-location-plugin): prepare package for npm publish (#125) (d75151a)

## 1.2.3 (2026-01-14)

* ci: enable turborepo remote cache in GitHub Actions (#123) (55b955b)
* ci: bd init --branch beads-sync (#122) (e858126)
* docs: turborepo remote cache deploy config (#120) (d82f410)
* feat(turbo): add ^test:coverage dependency to test:coverage task (#121) (34515b9)
* test(navigation-location-plugin): add comprehensive test coverage (#119) (beb1265)
* docs: use img tag for logo in README.md (#118) (60d787c)
* docs: turborepo remote cache (#117) (8b5619d)
* docs(navigation-location-plugin): add comprehensive README (#116) (cd2d5b8)
* chore: bv setup (#115) (b6c8b2e)
* feat(navigation-location-plugin): include router in event info (#114) (bb885b4)

## 1.2.2 (2026-01-13)

* docs: document Cloudflare Workers deployment workflow (#109) (7b40325)

## 1.2.1 (2026-01-13)

* docs: document GitHub CI/CD workflows and release process (#108) (f185734)
* docs: update ContactView to use resolves interface (#104) (72dc5f2)
* ci: generate changelogs with release.it (#110) (8a7eb3b)

## 1.2.0 (2026-01-12)

### What's Changed
* docs: google analytics integration (fixes #89) by @simshanith in https://github.com/simshanith/lit-ui-router/pull/96
* docs: pages to workers; support pushState SPA routing (fixes #90) by @simshanith in https://github.com/simshanith/lit-ui-router/pull/97
* docs: sample app push state google analytics by @simshanith in https://github.com/simshanith/lit-ui-router/pull/98
* docs: stackblitz embed refresh button by @simshanith in https://github.com/simshanith/lit-ui-router/pull/99
* docs: move wrangler to root by @simshanith in https://github.com/simshanith/lit-ui-router/pull/101
* docs: navigation-location-plugin by @simshanith in https://github.com/simshanith/lit-ui-router/pull/100
* ci: beads by @simshanith in https://github.com/simshanith/lit-ui-router/pull/105
* docs: add spa-fallback plugin for /app/* deep linking by @simshanith in https://github.com/simshanith/lit-ui-router/pull/106
* feat: generic type for resolves by @simshanith in https://github.com/simshanith/lit-ui-router/pull/103
* Release 1.2.0 by @simshanith in https://github.com/simshanith/lit-ui-router/pull/107


**Full Changelog**: https://github.com/simshanith/lit-ui-router/compare/lit-ui-router@1.1.2...lit-ui-router@1.2.0

## 1.1.2 (2026-01-10)

### What's Changed
* docs: add Open Graph and Twitter Card meta tags by @simshanith in https://github.com/simshanith/lit-ui-router/pull/80
* docs: png logo for og:image by @simshanith in https://github.com/simshanith/lit-ui-router/pull/81
* docs: add favicon by @simshanith in https://github.com/simshanith/lit-ui-router/pull/82
* docs: hero homepage adjustments by @simshanith in https://github.com/simshanith/lit-ui-router/pull/83
* docs: tweak hero background for contrast by @simshanith in https://github.com/simshanith/lit-ui-router/pull/84
* docs: update logo; translate3D for hardware acceleration by @simshanith in https://github.com/simshanith/lit-ui-router/pull/85
* docs: homepage hero mix-blend-mode by @simshanith in https://github.com/simshanith/lit-ui-router/pull/86
* ci: format check; eslint examples by @simshanith in https://github.com/simshanith/lit-ui-router/pull/87
* docs: add StackBlitzEmbed component with fullscreen and credentialless by @simshanith in https://github.com/simshanith/lit-ui-router/pull/88
* docs: typedoc api reference by @simshanith in https://github.com/simshanith/lit-ui-router/pull/93
* Release 1.1.2 by @simshanith in https://github.com/simshanith/lit-ui-router/pull/95


**Full Changelog**: https://github.com/simshanith/lit-ui-router/compare/lit-ui-router@1.1.1...lit-ui-router@1.1.2

## 1.1.1 (2026-01-04)

### What's Changed
* docs: lit ui router logo by @simshanith in https://github.com/simshanith/lit-ui-router/pull/77
* docs: add lit-ui-router logo to READMEs by @simshanith in https://github.com/simshanith/lit-ui-router/pull/78
* Release 1.1.1 by @simshanith in https://github.com/simshanith/lit-ui-router/pull/79


**Full Changelog**: https://github.com/simshanith/lit-ui-router/compare/lit-ui-router@1.1.0...lit-ui-router@1.1.1

## 1.1.0 (2026-01-04)

### What's Changed
* docs: add UI Router and Lit logos to homepage by @simshanith in https://github.com/simshanith/lit-ui-router/pull/74
* feat: integrate ESLint with typescript-eslint (closes #8) by @simshanith in https://github.com/simshanith/lit-ui-router/pull/75
* Release 1.1.0 by @simshanith in https://github.com/simshanith/lit-ui-router/pull/76


**Full Changelog**: https://github.com/simshanith/lit-ui-router/compare/lit-ui-router@1.0.4...lit-ui-router@1.1.0

## 1.0.4 (2026-01-04)

### What's Changed
* ci: add coverage reporting to build-test workflow by @simshanith in https://github.com/simshanith/lit-ui-router/pull/71
* test(ui-sref-active): add unit test coverage by @simshanith in https://github.com/simshanith/lit-ui-router/pull/73
* Release 1.0.4 by @simshanith in https://github.com/simshanith/lit-ui-router/pull/72


**Full Changelog**: https://github.com/simshanith/lit-ui-router/compare/lit-ui-router@1.0.3...lit-ui-router@1.0.4

## 1.0.3 (2026-01-03)

### What's Changed
* Feat/unit tests by @simshanith in https://github.com/simshanith/lit-ui-router/pull/68
* Release 1.0.3 by @simshanith in https://github.com/simshanith/lit-ui-router/pull/70


**Full Changelog**: https://github.com/simshanith/lit-ui-router/compare/lit-ui-router@1.0.3-alpha.2...lit-ui-router@1.0.3

## 1.0.2 (2026-01-02)

### What's Changed
* docs: add badges by @simshanith in https://github.com/simshanith/lit-ui-router/pull/56
* Release 1.0.2 by @simshanith in https://github.com/simshanith/lit-ui-router/pull/57


**Full Changelog**: https://github.com/simshanith/lit-ui-router/compare/lit-ui-router@1.0.1...lit-ui-router@1.0.2

## 1.0.1 (2026-01-02)

### What's Changed
* docs: add UI-Router and Lit.dev links to homepage tagline by @simshanith in https://github.com/simshanith/lit-ui-router/pull/35
* ci: continue on error by @simshanith in https://github.com/simshanith/lit-ui-router/pull/52
* docs: update examples to lit-ui-router@^1.0.0 by @simshanith in https://github.com/simshanith/lit-ui-router/pull/54
* chore: add package metadata by @simshanith in https://github.com/simshanith/lit-ui-router/pull/55
* Release 1.0.1 by @simshanith in https://github.com/simshanith/lit-ui-router/pull/53


**Full Changelog**: https://github.com/simshanith/lit-ui-router/compare/lit-ui-router@1.0.0...lit-ui-router@1.0.1

## 1.0.0 (2026-01-02)

### What's Changed
* fix: @uirouter/lit typescript errors by @simshanith in https://github.com/simshanith/lit-ui-router/pull/17
* fix: propagate update to child by @simshanith in https://github.com/simshanith/lit-ui-router/pull/21
* docs: add tutorial series for lit-ui-router by @simshanith in https://github.com/simshanith/lit-ui-router/pull/27
* fix: correct module entry point for npm package by @simshanith in https://github.com/simshanith/lit-ui-router/pull/28
* fix: add tsconfig.json to examples for decorator support by @simshanith in https://github.com/simshanith/lit-ui-router/pull/29
* ci: add main branch CI workflow by @simshanith in https://github.com/simshanith/lit-ui-router/pull/30
* docs: add API reference and examples documentation by @simshanith in https://github.com/simshanith/lit-ui-router/pull/32
* fix(sample-app-lit): enable vite typechecker and fix all type errors by @simshanith in https://github.com/simshanith/lit-ui-router/pull/33
* docs: add target=_self to sample app link in hellogalaxy by @simshanith in https://github.com/simshanith/lit-ui-router/pull/34
* docs: stackblitz improvements by @simshanith in https://github.com/simshanith/lit-ui-router/pull/36
* tag & publish workflow by @simshanith in https://github.com/simshanith/lit-ui-router/pull/37
* ci: publish workflow fixes by @simshanith in https://github.com/simshanith/lit-ui-router/pull/38
* ci: workflow permissions by @simshanith in https://github.com/simshanith/lit-ui-router/pull/39
* ci: explicit gh token for release creation by @simshanith in https://github.com/simshanith/lit-ui-router/pull/40
* ci: package name in tags and release branches by @simshanith in https://github.com/simshanith/lit-ui-router/pull/41
* ci: release name by @simshanith in https://github.com/simshanith/lit-ui-router/pull/42
* Shdaniel/publish workflow by @simshanith in https://github.com/simshanith/lit-ui-router/pull/43
* Shdaniel/publish workflow by @simshanith in https://github.com/simshanith/lit-ui-router/pull/44
* ci: bump version GH_TOKEN by @simshanith in https://github.com/simshanith/lit-ui-router/pull/45
* Release 1.0.0 by @github-actions[bot] in https://github.com/simshanith/lit-ui-router/pull/46
* ci: publish environment with personal access token by @simshanith in https://github.com/simshanith/lit-ui-router/pull/47
* ci: npm exec -- turbo by @simshanith in https://github.com/simshanith/lit-ui-router/pull/48
* ci: npm skipChecks by @simshanith in https://github.com/simshanith/lit-ui-router/pull/49
* ci: npm install npm by @simshanith in https://github.com/simshanith/lit-ui-router/pull/50
* ci: lit-ui-router package repository by @simshanith in https://github.com/simshanith/lit-ui-router/pull/51

### New Contributors
* @github-actions[bot] made their first contribution in https://github.com/simshanith/lit-ui-router/pull/46

**Full Changelog**: https://github.com/simshanith/lit-ui-router/compare/v0.2.1-alpha...lit-ui-router@1.0.0
