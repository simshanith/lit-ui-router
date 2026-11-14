# Changelog

Prereleases and canaries are not listed here; see [all releases](https://lit-ui-router.dev/releases/ui-router-server/).

## 0.11.0 (2026-11-12)

### ⚠ BREAKING CHANGES

* **ui-router-server:** the Connect, fetch and Hono adapters' canonical Link on a
  status-less shell names the request's path, not the mount base.

### Features

* **ui-router-server:** derive a mount's routes from data-only state declarations ([#2056](https://github.com/simshanith/lit-ui-router/issues/2056)) ([6e811b6](https://github.com/simshanith/lit-ui-router/commit/6e811b68b1251bc7e9a6b23ec5a3718a5218bb14)), closes [#2053](https://github.com/simshanith/lit-ui-router/issues/2053)
* **ui-router-server:** export withBase from the prerender entry ([#2076](https://github.com/simshanith/lit-ui-router/issues/2076)) ([2838e5c](https://github.com/simshanith/lit-ui-router/commit/2838e5c30f17d2ca6ba9ea810b5e2eaf08526821))
* **ui-router-server:** report each prerendered page's status on EmittedPage ([#2061](https://github.com/simshanith/lit-ui-router/issues/2061)) ([1a03fc9](https://github.com/simshanith/lit-ui-router/commit/1a03fc9154875d5e1ef37d3861e8f30622da4fb6))
* **ui-router-server:** report seed adoption and prerendered paths through onSeed and onPath ([#2046](https://github.com/simshanith/lit-ui-router/issues/2046)) ([5f47d44](https://github.com/simshanith/lit-ui-router/commit/5f47d44fad38128d8d8fbdb97293b41adbac8025))

### Bug Fixes

* **ui-router-server:** keep a redirect verdict's Location on this origin ([#2083](https://github.com/simshanith/lit-ui-router/issues/2083)) ([9f4e0da](https://github.com/simshanith/lit-ui-router/commit/9f4e0da80993fbef2cc868add63ba6f57f0933b7)), closes [#2082](https://github.com/simshanith/lit-ui-router/issues/2082)
* **ui-router-server:** name the request's own path in the shell's canonical Link ([#2054](https://github.com/simshanith/lit-ui-router/issues/2054)) ([96a9111](https://github.com/simshanith/lit-ui-router/commit/96a91117c7f91c72b56f25bbd541bdc32283f6e9))
* **ui-router-server:** redirect a request path that begins with // to its collapsed spelling ([#2096](https://github.com/simshanith/lit-ui-router/issues/2096)) ([e94aad7](https://github.com/simshanith/lit-ui-router/commit/e94aad7100087af5476e21a46bd59e61b7672b0f)), closes [#2082](https://github.com/simshanith/lit-ui-router/issues/2082)

<details>
<summary>Also touched this package (1)</summary>

* **tools:** give the tools CLIs one --json and --json-out convention ([#2063](https://github.com/simshanith/lit-ui-router/pull/2063))

</details>

[Release page](https://lit-ui-router.dev/releases/ui-router-server/0.11.0/) · [Diff from 0.10.0](https://lit-ui-router.dev/releases/ui-router-server/diff/0.10.0...0.11.0/)

## 0.10.0 (2026-11-11)

### Features

* **ui-router-server:** carry Vite's base into the adapters, plugin and prerender ([#2017](https://github.com/simshanith/lit-ui-router/issues/2017)) ([740888c](https://github.com/simshanith/lit-ui-router/commit/740888c2b2ba358c4dfa52a122e927df6a604b12)), closes [#2010](https://github.com/simshanith/lit-ui-router/issues/2010)

## 0.9.0 (2026-11-09)

### ⚠ BREAKING CHANGES

* **ui-router-server:** PrerenderOptions.trailingSlash is removed. Drop trailingSlash: 'both'; it was
  the default and the behaviour stays under the 'as-requested' policy. trailingSlash: 'exact' has
  no replacement: a redirect's line is always paired with its other spelling. To canonicalize
  pages, set config.trailingSlash on the mount instead.
* **ui-router-server:** ServerLocationOptions.strictMode is removed; `strictMode: x` becomes
  `urlConfig: { strict: x }`.

### Features

* **ui-router-server:** add a trailing-slash policy that matching and href formatting share ([#1959](https://github.com/simshanith/lit-ui-router/issues/1959)) ([c19674e](https://github.com/simshanith/lit-ui-router/commit/c19674eeb9f460f1e997020de9b5ab9dd923f44a)), closes [#1948](https://github.com/simshanith/lit-ui-router/issues/1948)
* **ui-router-server:** answer a redirectTo at its state's redirectStatusCode, at verdict and settle ([#1919](https://github.com/simshanith/lit-ui-router/issues/1919)) ([ef32683](https://github.com/simshanith/lit-ui-router/commit/ef3268359bc58e1ff5383cc14f67a8c3f3499260)), closes [#1916](https://github.com/simshanith/lit-ui-router/issues/1916)
* **ui-router-server:** nest routes under a search param, and accept dynamic in param declarations ([#1954](https://github.com/simshanith/lit-ui-router/issues/1954)) ([d684aa2](https://github.com/simshanith/lit-ui-router/commit/d684aa2910cb208cc765ddda3d09d2a8d73fe889))
* **ui-router-server:** write client-side redirect pages for hosts without redirect rules ([#1958](https://github.com/simshanith/lit-ui-router/issues/1958)) ([26720fe](https://github.com/simshanith/lit-ui-router/commit/26720fe0f2451fecbad0f11443f52ef098fe19f0)), closes [#1918](https://github.com/simshanith/lit-ui-router/issues/1918)

### Bug Fixes

* **ui-router-server:** flush the prerender worker's output before the build fails on an entry error ([#1939](https://github.com/simshanith/lit-ui-router/issues/1939)) ([2f15eee](https://github.com/simshanith/lit-ui-router/commit/2f15eee6acdd474223df669b04df2bd502c9c960))
* **ui-router-server:** register a copy of each state declaration on routers it builds ([#1942](https://github.com/simshanith/lit-ui-router/issues/1942)) ([7bdd3cf](https://github.com/simshanith/lit-ui-router/commit/7bdd3cf0bd48783ba4e25f2357e52538c6e515f1))

### Code Refactoring

* **ui-router-server:** remove the deprecated strictMode shorthand ([#1957](https://github.com/simshanith/lit-ui-router/issues/1957)) ([68c6670](https://github.com/simshanith/lit-ui-router/commit/68c66706af41f764608a5cc66fda9f6e8a020b8f))

### Build System

* drop stale overrides, knip ignores and lint disables from the exception lists ([#1909](https://github.com/simshanith/lit-ui-router/issues/1909)) ([52faefd](https://github.com/simshanith/lit-ui-router/commit/52faefd28347d7437db68607d629f5a6f02c8ad7)), references [#721](https://github.com/simshanith/lit-ui-router/issues/721) [#1448](https://github.com/simshanith/lit-ui-router/issues/1448) [#1474](https://github.com/simshanith/lit-ui-router/issues/1474) [#1534](https://github.com/simshanith/lit-ui-router/issues/1534) [#1907](https://github.com/simshanith/lit-ui-router/issues/1907) [#1901](https://github.com/simshanith/lit-ui-router/issues/1901)
* **lint:** type-check doc-comment `@example` blocks on the TypeScript 7.1 API ([#1769](https://github.com/simshanith/lit-ui-router/issues/1769)) ([cc4269e](https://github.com/simshanith/lit-ui-router/commit/cc4269eaaac9d93b993d634f9ce017b15efa64b5)), closes [#1756](https://github.com/simshanith/lit-ui-router/issues/1756)
* **lint:** type-check opted-in Markdown ts blocks on the TypeScript 7.1 API ([#1663](https://github.com/simshanith/lit-ui-router/issues/1663)) ([1ee0ce3](https://github.com/simshanith/lit-ui-router/commit/1ee0ce3464c1a66d3d4655e10c4ef17eab936566))

## 0.8.1 (2026-11-03)

### Bug Fixes

* **ui-router-server:** flush the prerender worker's output before it posts the result ([#1857](https://github.com/simshanith/lit-ui-router/issues/1857)) ([162a417](https://github.com/simshanith/lit-ui-router/commit/162a417a3aa846cfc25c999e1b9603eabc8ac22d))

## 0.8.0 (2026-11-03)

### Features

* **ui-router-server:** prerender the built app from serverRouterPlugin after vite build ([#1811](https://github.com/simshanith/lit-ui-router/issues/1811)) ([8cb4d63](https://github.com/simshanith/lit-ui-router/commit/8cb4d63fcd4d9abc113d232879cf197e5c7405ef)), references [#1816](https://github.com/simshanith/lit-ui-router/issues/1816)
* **ui-router-server:** run the prerender entry in a worker with preload modules ([#1823](https://github.com/simshanith/lit-ui-router/issues/1823)) ([c279fb3](https://github.com/simshanith/lit-ui-router/commit/c279fb344182d55c0812ae63e7495280ba5028cf))
* **ui-router-server:** support Vite 7 for the prerender build step ([#1812](https://github.com/simshanith/lit-ui-router/issues/1812)) ([302c744](https://github.com/simshanith/lit-ui-router/commit/302c7445e01a74b04b5a3ce9ad49d8d4c1a96c49))

### Build System

* **turbo:** order ui-router-server tests after its own build:js ([#1719](https://github.com/simshanith/lit-ui-router/issues/1719)) ([a86aa6c](https://github.com/simshanith/lit-ui-router/commit/a86aa6ced5275cb7126d6c44220c83e3e126b410))

### Documentation

* fix doc examples the TypeScript 7.1 checker spikes flag ([#1808](https://github.com/simshanith/lit-ui-router/issues/1808)) ([9bd5fb4](https://github.com/simshanith/lit-ui-router/commit/9bd5fb4270687400d5ae0aca8b9464db371262e8))
* fix five doc-comment examples that don't type-check ([#1776](https://github.com/simshanith/lit-ui-router/issues/1776)) ([0007855](https://github.com/simshanith/lit-ui-router/commit/0007855eaeaa3b4a08298d774474addb0d972026)), references [#1665](https://github.com/simshanith/lit-ui-router/issues/1665) [#1769](https://github.com/simshanith/lit-ui-router/issues/1769)

## 0.7.1 (2026-10-31)

### Bug Fixes

* **ui-router-server:** accept 0 and "" as a transporter's encoding ([#1712](https://github.com/simshanith/lit-ui-router/issues/1712)) ([967443f](https://github.com/simshanith/lit-ui-router/commit/967443fbee4fe282dd9c367f03bf6af0302888ad))

### Documentation

* name response states now that ui-router-server 0.7 ships them ([#1709](https://github.com/simshanith/lit-ui-router/issues/1709)) ([1db6b2d](https://github.com/simshanith/lit-ui-router/commit/1db6b2dc2aef3e2f56c540aefda44dfebd61a741))

## 0.7.0 (2026-10-31)

### Features

* **ui-router-server:** declare response states and prerender their bodies ([#1694](https://github.com/simshanith/lit-ui-router/issues/1694)) ([cc52724](https://github.com/simshanith/lit-ui-router/commit/cc527244014ae177ad9a11e48fdff9a3b204eba8))
* **ui-router-server:** keep a resolve out of the dehydrated payload with shouldDehydrate ([#1690](https://github.com/simshanith/lit-ui-router/issues/1690)) ([a9f4d27](https://github.com/simshanith/lit-ui-router/commit/a9f4d27bcaf07bc94caab3ce5bcb6fbc0b799a40))
* **ui-router-server:** let dehydrate and seed carry custom types through named transporters ([#1703](https://github.com/simshanith/lit-ui-router/issues/1703)) ([0627f9d](https://github.com/simshanith/lit-ui-router/commit/0627f9d9bf2f8c18f5a380e19d9db62a95d8900f))

## 0.6.0 (2026-10-30)

### Features

* **ui-router-server:** add a delegate verdict that hands matching requests to host handlers ([#1438](https://github.com/simshanith/lit-ui-router/issues/1438)) ([1c2cac9](https://github.com/simshanith/lit-ui-router/commit/1c2cac9bf9ec82b6fbc3f17315354d2e1fed1c2b)), references [#1435](https://github.com/simshanith/lit-ui-router/issues/1435) [#1306](https://github.com/simshanith/lit-ui-router/issues/1306) [#1439](https://github.com/simshanith/lit-ui-router/issues/1439)
* **ui-router-server:** move the prerender loop into a ui-router-server/prerender entry ([#1657](https://github.com/simshanith/lit-ui-router/issues/1657)) ([9266018](https://github.com/simshanith/lit-ui-router/commit/92660184d9980e90964f7e785d5efeb5cae43b42)), references [#1586](https://github.com/simshanith/lit-ui-router/issues/1586)

### Bug Fixes

* **ui-router-server:** keep serveShell required and let every mount own its paths ([#1675](https://github.com/simshanith/lit-ui-router/issues/1675)) ([a83b79b](https://github.com/simshanith/lit-ui-router/commit/a83b79b48f242ecd698382b1957d6bd5a9e98e88))
* **ui-router-server:** let delegate-only mounts pass through and keep delegate keys checked ([#1673](https://github.com/simshanith/lit-ui-router/issues/1673)) ([3ab9092](https://github.com/simshanith/lit-ui-router/commit/3ab90929a8d23dda96e259d7396a274c5b05398e)), references [#1435](https://github.com/simshanith/lit-ui-router/issues/1435)

### Performance Improvements

* **ui-router-server:** merge route params into one object per route ([#1666](https://github.com/simshanith/lit-ui-router/issues/1666)) ([26b5b65](https://github.com/simshanith/lit-ui-router/commit/26b5b65be7f5d638999155515194df74bea68460))

### Documentation

* **ui-router-server:** add a when-to-use section ([#1674](https://github.com/simshanith/lit-ui-router/issues/1674)) ([bfef92b](https://github.com/simshanith/lit-ui-router/commit/bfef92b943f2fba0e781e0578ca269420c1270a9))
* **ui-router-server:** link the when-to-use section to the 404 guidance ([#1678](https://github.com/simshanith/lit-ui-router/issues/1678)) ([0175f16](https://github.com/simshanith/lit-ui-router/commit/0175f167f4503f9101985ef5daafa1f9d5169606))

## 0.5.0 (2026-10-29)

### Features

* **ui-router-server:** add settle on a lit-free ssr entry ([#1579](https://github.com/simshanith/lit-ui-router/issues/1579)) ([001045e](https://github.com/simshanith/lit-ui-router/commit/001045e66d8523d3be276d45777da24752a1cc97)), references [#1028](https://github.com/simshanith/lit-ui-router/issues/1028) [#1586](https://github.com/simshanith/lit-ui-router/issues/1586)
* **ui-router-server:** compose matcher urls along parent, as core does ([#1636](https://github.com/simshanith/lit-ui-router/issues/1636)) ([abf6fa1](https://github.com/simshanith/lit-ui-router/commit/abf6fa1233a4cfbc8dfa61745cfc62f2cd26169f)), closes [#1635](https://github.com/simshanith/lit-ui-router/issues/1635)
* **ui-router-server:** dehydrate and seed the resolve payload ([#1580](https://github.com/simshanith/lit-ui-router/issues/1580)) ([1cd9545](https://github.com/simshanith/lit-ui-router/commit/1cd954559604dabdcb4d0a419ac42b07b38f0fba)), references [#1028](https://github.com/simshanith/lit-ui-router/issues/1028) [#1019](https://github.com/simshanith/lit-ui-router/issues/1019) [#1586](https://github.com/simshanith/lit-ui-router/issues/1586)

### Documentation

* link the package README release badges to each package's latest GitHub release ([#1501](https://github.com/simshanith/lit-ui-router/issues/1501)) ([9e96854](https://github.com/simshanith/lit-ui-router/commit/9e96854750595230146252667c85ea7b2fc1714d))

## 0.4.0 (2026-10-16)

### Features

* **ui-router-server:** implement a trie route matcher ([#1285](https://github.com/simshanith/lit-ui-router/issues/1285)) ([b35db79](https://github.com/simshanith/lit-ui-router/commit/b35db797f2f67702c6c826c89b57f61b297ae2a9)), references [#1282](https://github.com/simshanith/lit-ui-router/issues/1282)
* **ui-router-server:** let a mount match with the route trie ([#1412](https://github.com/simshanith/lit-ui-router/issues/1412)) ([1af02cb](https://github.com/simshanith/lit-ui-router/commit/1af02cb3bb5f17260d317fdd890f59580bb496d6)), references [#1285](https://github.com/simshanith/lit-ui-router/issues/1285) [#1282](https://github.com/simshanith/lit-ui-router/issues/1282)
* **ui-router-server:** share a mount's url config with any router ([#1335](https://github.com/simshanith/lit-ui-router/issues/1335)) ([4faf271](https://github.com/simshanith/lit-ui-router/commit/4faf271e2cce8234f084626d733395c8e0bd93f7))
* **ui-router-server:** warn about mounts whose bare base 404s, with diagnoseMounts(router) and per-mount ignoreDiagnostics ([#1383](https://github.com/simshanith/lit-ui-router/issues/1383)) ([1c0b785](https://github.com/simshanith/lit-ui-router/commit/1c0b785308dc39f0fd141f6b53cd4b01b52385f7)), closes [#805](https://github.com/simshanith/lit-ui-router/issues/805), references [#dev-gate](https://github.com/simshanith/lit-ui-router/issues/dev-gate) [#dev-gate](https://github.com/simshanith/lit-ui-router/issues/dev-gate) [#dev-gate](https://github.com/simshanith/lit-ui-router/issues/dev-gate) [#dev-gate](https://github.com/simshanith/lit-ui-router/issues/dev-gate) [#dev-gate](https://github.com/simshanith/lit-ui-router/issues/dev-gate)

### Bug Fixes

* **ui-router-server:** reject strictMode in installServerLocation after states are registered ([#1346](https://github.com/simshanith/lit-ui-router/issues/1346)) ([5360dc3](https://github.com/simshanith/lit-ui-router/commit/5360dc384e74a94d8d89fbc19ec8650413bfcbf0))

## 0.3.1 (2026-10-15)

### Bug Fixes

* **ui-router-server:** apply the mount's defaultSquashPolicy to simulate routers ([#1329](https://github.com/simshanith/lit-ui-router/issues/1329)) ([b87bf04](https://github.com/simshanith/lit-ui-router/commit/b87bf040adcd2afc064e1908cfbbe40c528b1ea2))
* **ui-router-server:** apply the mount's strict and caseInsensitive config to simulate routers ([#1324](https://github.com/simshanith/lit-ui-router/issues/1324)) ([0b8ccf8](https://github.com/simshanith/lit-ui-router/commit/0b8ccf8fe6af966ee10ded55735ce47f0bd5733b)), closes [#1315](https://github.com/simshanith/lit-ui-router/issues/1315)

## 0.3.0 (2026-10-15)

### Features

* **lit-ui-router-effect:** support effect 4 alongside effect 3 ([#1135](https://github.com/simshanith/lit-ui-router/issues/1135)) ([65b83a8](https://github.com/simshanith/lit-ui-router/commit/65b83a8ace14d7480c192476babe751f6818f745))
* **ui-router-server:** prewarm the router pool for simulate mounts ([#1301](https://github.com/simshanith/lit-ui-router/issues/1301)) ([b84303a](https://github.com/simshanith/lit-ui-router/commit/b84303ae033a21d01a63b9c3f15cc910b0e586a9))

### Bug Fixes

* **ui-router-server:** clear the simulate settle timer ([#1287](https://github.com/simshanith/lit-ui-router/issues/1287)) ([21de18a](https://github.com/simshanith/lit-ui-router/commit/21de18adfbf5c9e300fe454379509aa5d6b536a3))

### Code Refactoring

* **ui-router-server:** avoid rebuilding the headless router on every simulate request ([#1288](https://github.com/simshanith/lit-ui-router/issues/1288)) ([4cd9b97](https://github.com/simshanith/lit-ui-router/commit/4cd9b976144779571469f9bac9e879505a5b4eb7))
* **ui-router-server:** match each pathname once in the matcher strategy ([#1283](https://github.com/simshanith/lit-ui-router/issues/1283)) ([1404a01](https://github.com/simshanith/lit-ui-router/commit/1404a01d9d55eaf279446bc0ced1fb5ac72b3e9a)), closes [#1280](https://github.com/simshanith/lit-ui-router/issues/1280)

### Performance Improvements

* **ui-router-server:** benchmark route resolution as the route count grows ([#1284](https://github.com/simshanith/lit-ui-router/issues/1284)) ([9ee5f83](https://github.com/simshanith/lit-ui-router/commit/9ee5f83a5cc9c8de38cf37f3f53a1831c35e463f)), closes [#1278](https://github.com/simshanith/lit-ui-router/issues/1278)

### Documentation

* **ui-router-server:** note that a string squash policy is regexp source ([#1289](https://github.com/simshanith/lit-ui-router/issues/1289)) ([59d6119](https://github.com/simshanith/lit-ui-router/commit/59d61193df5b6737f6c087ea43297ef2400ff252)), references [#1286](https://github.com/simshanith/lit-ui-router/issues/1286)

## 0.2.2 (2026-10-10)

### Bug Fixes

* **server:** resolve built-in param types from own keys only ([#1150](https://github.com/simshanith/lit-ui-router/issues/1150)) ([9fc06ab](https://github.com/simshanith/lit-ui-router/commit/9fc06ab9c91f873f919a35d63e3a9f4c629e7bca))

## 0.2.1 (2026-10-10)

### Code Refactoring

* enable anti-slop no-runtime-typeof and decode or name each type check ([#1153](https://github.com/simshanith/lit-ui-router/issues/1153)) ([05accd8](https://github.com/simshanith/lit-ui-router/commit/05accd8644aa01086aa064c83f7d4d4df0a7d44a))
* enable the anti-slop type-assertion rules and retype or justify each cast ([#1152](https://github.com/simshanith/lit-ui-router/issues/1152)) ([643814f](https://github.com/simshanith/lit-ui-router/commit/643814f6ab4e2f976e4bb1746d9a44cb823ac327))
* enable the anti-slop typing rules and tighten the types they flag ([#1151](https://github.com/simshanith/lit-ui-router/issues/1151)) ([a16befb](https://github.com/simshanith/lit-ui-router/commit/a16befbf026033f0085bc0bd40cf671887861040))

### Build System

* **turbo:** replace with sidecars with umbrella tasks ([#1038](https://github.com/simshanith/lit-ui-router/issues/1038)) ([aec4ee8](https://github.com/simshanith/lit-ui-router/commit/aec4ee8a8a6a44c8a3c99a7e08abb789343ef8e0))

## 0.2.0 (2026-09-14)

### Features

* **lit-ui-router-ssr:** prerender a static site from a mount table's verdicts ([#880](https://github.com/simshanith/lit-ui-router/issues/880)) ([3793133](https://github.com/simshanith/lit-ui-router/commit/379313376d645069e23100a11a654b35d766ce16)), closes [#806](https://github.com/simshanith/lit-ui-router/issues/806)
* **lit-ui-router:** the sref directives render from the scoped router ([#872](https://github.com/simshanith/lit-ui-router/issues/872)) ([d9af90b](https://github.com/simshanith/lit-ui-router/commit/d9af90b3c22b4891e7ef05372d68f456db3204d9)), references [#829](https://github.com/simshanith/lit-ui-router/issues/829) [#838](https://github.com/simshanith/lit-ui-router/issues/838) [#887](https://github.com/simshanith/lit-ui-router/issues/887)
* **ui-router-server:** a location subpath for server hrefs ([#882](https://github.com/simshanith/lit-ui-router/issues/882)) ([2ec35b8](https://github.com/simshanith/lit-ui-router/commit/2ec35b8d57ba2b548749eb65718efdda8fff1cbe)), references [#829](https://github.com/simshanith/lit-ui-router/issues/829)

## 0.1.2 (2026-09-13)

### Build System

* **docs:** move the site to www/lit-ui-router.dev with its wrangler config ([#717](https://github.com/simshanith/lit-ui-router/issues/717)) ([53d3a7c](https://github.com/simshanith/lit-ui-router/commit/53d3a7c30a8fdcddc29de4fc77b50b36fde1678b))
* **release:** range a first stable's changelog from the repo root ([#734](https://github.com/simshanith/lit-ui-router/issues/734)) ([fccb746](https://github.com/simshanith/lit-ui-router/commit/fccb746d50c6125a4774b384c341ede7d8f97ca3)), references [#733](https://github.com/simshanith/lit-ui-router/issues/733) [#302](https://github.com/simshanith/lit-ui-router/issues/302) [#423](https://github.com/simshanith/lit-ui-router/issues/423) [#673](https://github.com/simshanith/lit-ui-router/issues/673)
* **turbo:** schedule tests on the build graph, not on ^test ([#780](https://github.com/simshanith/lit-ui-router/issues/780)) ([62b310f](https://github.com/simshanith/lit-ui-router/commit/62b310f4e219494b3a43c4bff44dd4e4e409da34))
* **workspace:** declare oxlint and oxfmt in every package that runs them ([#586](https://github.com/simshanith/lit-ui-router/issues/586)) ([daa7ff8](https://github.com/simshanith/lit-ui-router/commit/daa7ff8b36c2dd98119a4da4a256ac8327f40db0))

### Documentation

* **typedoc-plugin:** migrate [[X]] links to `{@link}` and drop the symbol tables ([#832](https://github.com/simshanith/lit-ui-router/issues/832)) ([b59e8de](https://github.com/simshanith/lit-ui-router/commit/b59e8dee22b2b8cbb61303004d933f02e54dc651)), references [#827](https://github.com/simshanith/lit-ui-router/issues/827) [#830](https://github.com/simshanith/lit-ui-router/issues/830)
* **ui-router-server:** enable typedoc validation.notDocumented ([#852](https://github.com/simshanith/lit-ui-router/issues/852)) ([2efda8d](https://github.com/simshanith/lit-ui-router/commit/2efda8d191d92abb34c668453f751aff0725b682)), closes [#834](https://github.com/simshanith/lit-ui-router/issues/834)

## 0.1.1 (2026-08-14)

### Bug Fixes

* **ui-router-server:** keep the merged query ahead of a redirect fragment ([#567](https://github.com/simshanith/lit-ui-router/issues/567)) ([83dac32](https://github.com/simshanith/lit-ui-router/commit/83dac32a0b2cb364146ff836d3555a6d92552d64))

### Code Refactoring

* **compat:** read catalogs via the pnpm SDK, split the lit2 lane ([#525](https://github.com/simshanith/lit-ui-router/issues/525)) ([9c17b2b](https://github.com/simshanith/lit-ui-router/commit/9c17b2b128416ee0e58215c71d65b6c5a7325c5f))

### Build System

* **ui-router-server:** opt into runtime globals via tsconfig types ([#540](https://github.com/simshanith/lit-ui-router/issues/540)) ([a440fe6](https://github.com/simshanith/lit-ui-router/commit/a440fe69f90d756c0eaa63ef73c389ea977ad950))

## 0.1.0 (2026-08-01)

* docs(readme): link npm badges to npmx.dev (#494) (b862dc7)
