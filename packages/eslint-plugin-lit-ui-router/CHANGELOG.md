# Changelog

Prereleases and canaries are not listed here; see [all releases](https://lit-ui-router.dev/releases/eslint-plugin-lit-ui-router/).

## 1.3.1 (2026-11-13)

### Build System

* drop stale overrides, knip ignores and lint disables from the exception lists ([#1909](https://github.com/simshanith/lit-ui-router/issues/1909)) ([52faefd](https://github.com/simshanith/lit-ui-router/commit/52faefd28347d7437db68607d629f5a6f02c8ad7)), references [#721](https://github.com/simshanith/lit-ui-router/issues/721) [#1448](https://github.com/simshanith/lit-ui-router/issues/1448) [#1474](https://github.com/simshanith/lit-ui-router/issues/1474) [#1534](https://github.com/simshanith/lit-ui-router/issues/1534) [#1907](https://github.com/simshanith/lit-ui-router/issues/1907) [#1901](https://github.com/simshanith/lit-ui-router/issues/1901)
* **lint:** type-check doc-comment `@example` blocks on the TypeScript 7.1 API ([#1769](https://github.com/simshanith/lit-ui-router/issues/1769)) ([cc4269e](https://github.com/simshanith/lit-ui-router/commit/cc4269eaaac9d93b993d634f9ce017b15efa64b5)), closes [#1756](https://github.com/simshanith/lit-ui-router/issues/1756)
* **lint:** type-check opted-in Markdown ts blocks on the TypeScript 7.1 API ([#1663](https://github.com/simshanith/lit-ui-router/issues/1663)) ([1ee0ce3](https://github.com/simshanith/lit-ui-router/commit/1ee0ce3464c1a66d3d4655e10c4ef17eab936566))
* move the custom-element lint lane from ESLint to oxlint jsPlugins ([#1662](https://github.com/simshanith/lit-ui-router/issues/1662)) ([1199a70](https://github.com/simshanith/lit-ui-router/commit/1199a70ab2b9896e87066f56e90a151f50206d06))

<details>
<summary>Also touched this package (2)</summary>

* **www:** move the API reference to /reference/\<npm-name>/ ([#2028](https://github.com/simshanith/lit-ui-router/pull/2028))
* **www:** name package pages by npm name ([#2027](https://github.com/simshanith/lit-ui-router/pull/2027))

</details>

[Release page](https://lit-ui-router.dev/releases/eslint-plugin-lit-ui-router/1.3.1/) · [Diff from 1.3.0](https://lit-ui-router.dev/releases/eslint-plugin-lit-ui-router/diff/1.3.0...1.3.1/)

## 1.3.0 (2026-10-22)

### Features

* **eslint-plugin-lit-ui-router:** add settings.litUiRouterSources for wrapper modules ([#1523](https://github.com/simshanith/lit-ui-router/issues/1523)) ([9eebec1](https://github.com/simshanith/lit-ui-router/commit/9eebec1580ebd47c37859b0bac10feba3f137436)), closes [#1520](https://github.com/simshanith/lit-ui-router/issues/1520)

### Documentation

* link the package README release badges to each package's latest GitHub release ([#1501](https://github.com/simshanith/lit-ui-router/issues/1501)) ([9e96854](https://github.com/simshanith/lit-ui-router/commit/9e96854750595230146252667c85ea7b2fc1714d))

## 1.2.1 (2026-10-10)

### Code Refactoring

* enable anti-slop no-runtime-typeof and decode or name each type check ([#1153](https://github.com/simshanith/lit-ui-router/issues/1153)) ([05accd8](https://github.com/simshanith/lit-ui-router/commit/05accd8644aa01086aa064c83f7d4d4df0a7d44a))
* enable the anti-slop type-assertion rules and retype or justify each cast ([#1152](https://github.com/simshanith/lit-ui-router/issues/1152)) ([643814f](https://github.com/simshanith/lit-ui-router/commit/643814f6ab4e2f976e4bb1746d9a44cb823ac327))
* enable the anti-slop typing rules and tighten the types they flag ([#1151](https://github.com/simshanith/lit-ui-router/issues/1151)) ([a16befb](https://github.com/simshanith/lit-ui-router/commit/a16befbf026033f0085bc0bd40cf671887861040))

### Build System

* vendor the anti-slop oxlint plugin as @tools/oxlint-anti-slop ([#1143](https://github.com/simshanith/lit-ui-router/issues/1143)) ([e1b60ed](https://github.com/simshanith/lit-ui-router/commit/e1b60ed326884cf7217eb195e0c82d33b4d738ba))

## 1.2.0 (2026-10-04)

### Features

* **eslint-plugin:** add allowElementParts to anchor-is-valid and sref-active-class-aria-current ([#1068](https://github.com/simshanith/lit-ui-router/issues/1068)) ([6d41d21](https://github.com/simshanith/lit-ui-router/commit/6d41d21ee8a43e5c8b83ada6e1c6193426834d57)), closes [#1065](https://github.com/simshanith/lit-ui-router/issues/1065)

### Bug Fixes

* **lit-ui-router-effect:** read the scoped router when no ui-router can be sought ([#994](https://github.com/simshanith/lit-ui-router/issues/994)) ([7d7489e](https://github.com/simshanith/lit-ui-router/commit/7d7489e449fb01ce92e05e77388a21742a8e4c67))

### Code Refactoring

* **eslint-plugin:** extract constructorFields and mark complexity exceptions ([#1063](https://github.com/simshanith/lit-ui-router/issues/1063)) ([e9d0f7c](https://github.com/simshanith/lit-ui-router/commit/e9d0f7cb8b35ff81d616d20543b4ae25e4f01f70))

### Build System

* **eslint-plugin:** develop on current eslint, prove the 9.0.0 floor in its own lane ([#1002](https://github.com/simshanith/lit-ui-router/issues/1002)) ([29557ef](https://github.com/simshanith/lit-ui-router/commit/29557ef8ed5d23d8f05a74aa213d7a03fdd235a5))
* **lint:** cap complexity at 15, with a hard ceiling at 25 ([#1058](https://github.com/simshanith/lit-ui-router/issues/1058)) ([7654985](https://github.com/simshanith/lit-ui-router/commit/7654985109bb592d9db3ff6e92704b8ec9cc0604))
* **repo-checks:** fail when a controlled package resolves to two versions ([#1036](https://github.com/simshanith/lit-ui-router/issues/1036)) ([2765b11](https://github.com/simshanith/lit-ui-router/commit/2765b1148c74899c433b69c32839cb5ea28717af))
* **tools:** check lint:package-json coverage and drop its TAP output ([#1090](https://github.com/simshanith/lit-ui-router/issues/1090)) ([57a6715](https://github.com/simshanith/lit-ui-router/commit/57a67159264f9b4a1e7f6a8b51e2a17fadf26cbf)), references [#615](https://github.com/simshanith/lit-ui-router/issues/615)
* **turbo:** replace with sidecars with umbrella tasks ([#1038](https://github.com/simshanith/lit-ui-router/issues/1038)) ([aec4ee8](https://github.com/simshanith/lit-ui-router/commit/aec4ee8a8a6a44c8a3c99a7e08abb789343ef8e0))

## 1.1.0 (2026-09-13)

### Features

* **eslint-plugin:** know the sref attribute parts; add sref-active-class-aria-current and sref-status-aria-current ([#828](https://github.com/simshanith/lit-ui-router/issues/828)) ([9e3c97c](https://github.com/simshanith/lit-ui-router/commit/9e3c97c80013d554e80d1e041e04aa9af970e99e)), references [#827](https://github.com/simshanith/lit-ui-router/issues/827) [#830](https://github.com/simshanith/lit-ui-router/issues/830)

## 1.0.1 (2026-09-07)

### Bug Fixes

* **eslint-plugin:** refresh the manifest description, homepage and header ([#737](https://github.com/simshanith/lit-ui-router/issues/737)) ([833dd2e](https://github.com/simshanith/lit-ui-router/commit/833dd2e6bc428cca0260389be12cfc9ddaee2b6e)), references [#726](https://github.com/simshanith/lit-ui-router/issues/726) [#667](https://github.com/simshanith/lit-ui-router/issues/667)

## 1.0.0 (2026-09-07)

### Features

* **eslint-plugin:** graduate anchor-is-valid to packages/eslint-plugin-lit-ui-router ([#662](https://github.com/simshanith/lit-ui-router/issues/662)) ([dcb1334](https://github.com/simshanith/lit-ui-router/commit/dcb1334a3fb2cfe4343bda95494453e3896bf6d6)), references [#659](https://github.com/simshanith/lit-ui-router/issues/659) [#659](https://github.com/simshanith/lit-ui-router/issues/659) [#659](https://github.com/simshanith/lit-ui-router/issues/659) [#659](https://github.com/simshanith/lit-ui-router/issues/659) [#659](https://github.com/simshanith/lit-ui-router/issues/659) [#659](https://github.com/simshanith/lit-ui-router/issues/659) [#659](https://github.com/simshanith/lit-ui-router/issues/659) [#369](https://github.com/simshanith/lit-ui-router/issues/369)
* **eslint-plugin:** settings.linkElements, shared by anchor-is-valid and sref-assign-href ([#698](https://github.com/simshanith/lit-ui-router/issues/698)) ([63c260e](https://github.com/simshanith/lit-ui-router/commit/63c260e33a4b93208d32fda8150d7d19d5741363)), references [#676](https://github.com/simshanith/lit-ui-router/issues/676)
* **eslint-plugin:** sref-assign-href, sref-active-aria-current, directive-position rules ([#689](https://github.com/simshanith/lit-ui-router/issues/689)) ([7d67b61](https://github.com/simshanith/lit-ui-router/commit/7d67b61ea2ebaa969bb96e7af2c86dbf3b8014e7))
* **eslint-plugin:** vendor anchor-is-valid, drop the lit-a11y peer, add the oxlint lane ([#680](https://github.com/simshanith/lit-ui-router/issues/680)) ([684c3f5](https://github.com/simshanith/lit-ui-router/commit/684c3f551644c1e8d0e280dd16c4ba595579ac9a)), references [#676](https://github.com/simshanith/lit-ui-router/issues/676) [#667](https://github.com/simshanith/lit-ui-router/issues/667)
* **eslint-plugin:** wire eslint-plugin-lit-ui-router into the release pipeline ([#666](https://github.com/simshanith/lit-ui-router/issues/666)) ([5a5b9fd](https://github.com/simshanith/lit-ui-router/commit/5a5b9fdb606b7ac104a5439252c28709abf8eddf)), references [#659](https://github.com/simshanith/lit-ui-router/issues/659) [#667](https://github.com/simshanith/lit-ui-router/issues/667) [#667](https://github.com/simshanith/lit-ui-router/issues/667)

### Bug Fixes

* **eslint-plugin:** load package.json without an import attribute ([#726](https://github.com/simshanith/lit-ui-router/issues/726)) ([f1c290c](https://github.com/simshanith/lit-ui-router/commit/f1c290c08e8d5b9c4515165f78abc9b1ba7863c3))
* **eslint-plugin:** pin rule doc urls to the version that reports them ([#702](https://github.com/simshanith/lit-ui-router/issues/702)) ([5e0e069](https://github.com/simshanith/lit-ui-router/commit/5e0e06932924985e684156e0efe43615eb93a0de))
* **eslint-plugin:** ship LICENSE with the vendored lit-a11y notice ([#715](https://github.com/simshanith/lit-ui-router/issues/715)) ([a57078c](https://github.com/simshanith/lit-ui-router/commit/a57078cb69217b1bf55a866d03ecac4dfae8380a))

### Build System

* **release:** range a first stable's changelog from the repo root ([#734](https://github.com/simshanith/lit-ui-router/issues/734)) ([fccb746](https://github.com/simshanith/lit-ui-router/commit/fccb746d50c6125a4774b384c341ede7d8f97ca3)), references [#733](https://github.com/simshanith/lit-ui-router/issues/733) [#302](https://github.com/simshanith/lit-ui-router/issues/302) [#423](https://github.com/simshanith/lit-ui-router/issues/423) [#673](https://github.com/simshanith/lit-ui-router/issues/673)
