# Changelog

Prereleases and canaries are not listed here; see [all releases on GitHub](https://github.com/simshanith/lit-ui-router/releases?q=lit-ui-router-ssr%40&expanded=true).

## 0.11.0 (2026-11-13)

### ⚠ BREAKING CHANGES

* **lit-ui-router-ssr:** the lit-ui-router peer narrows from ^1.19.0 to ^1.20.0.
* **lit-ui-router-ssr:** the ui-router-server peer narrows from ^0.10.0 to ^0.11.0.

### Features

* **lit-ui-router-ssr:** default the Vite prerender document to the built shell's <!--app--> marker ([#2058](https://github.com/simshanith/lit-ui-router/issues/2058)) ([a69d0db](https://github.com/simshanith/lit-ui-router/commit/a69d0dbff5067587e6a098181fa370a804c191fe))
* **lit-ui-router-ssr:** export shadowElementRenderers to render LitElement shadow roots in prerender ([#2055](https://github.com/simshanith/lit-ui-router/issues/2055)) ([921aff6](https://github.com/simshanith/lit-ui-router/commit/921aff63b6da240c59169b892905dcebc4072305))
* **lit-ui-router-ssr:** log hydration and prerender through core's trace categories ([#2044](https://github.com/simshanith/lit-ui-router/issues/2044)) ([fd5486f](https://github.com/simshanith/lit-ui-router/commit/fd5486ff5cd04ef266e5436a460d69af15915f06))
* **lit-ui-router-ssr:** narrow the ui-router-server peer to ^0.11.0 and lit-ui-router to ^1.20.0 ([#2111](https://github.com/simshanith/lit-ui-router/issues/2111)) ([603c60b](https://github.com/simshanith/lit-ui-router/commit/603c60b2505240b6ae525dcdbf6007aa5195ffd3)), closes [#2072](https://github.com/simshanith/lit-ui-router/issues/2072)
* **lit-ui-router-ssr:** register HYDRATION and PRERENDER trace categories through a core-shaped shim ([#2045](https://github.com/simshanith/lit-ui-router/issues/2045)) ([f79e17b](https://github.com/simshanith/lit-ui-router/commit/f79e17b955f9b422c388df756016a1850a9043c1)), references [#2044](https://github.com/simshanith/lit-ui-router/issues/2044)
* **lit-ui-router-ssr:** take a page template in prerender in place of the usual renderShell ([#2057](https://github.com/simshanith/lit-ui-router/issues/2057)) ([39760b0](https://github.com/simshanith/lit-ui-router/commit/39760b0e9f0b5de608eead274d8c0e33c85cca77))

<details>
<summary>Also touched this package (2)</summary>

* **ui-router-server:** redirect a request path that begins with // to its collapsed spelling ([#2096](https://github.com/simshanith/lit-ui-router/pull/2096))
* **lit-ui-router:** add uiViewProps beside a deprecated _uiViewProps ([#2071](https://github.com/simshanith/lit-ui-router/pull/2071))

</details>

[Release page](https://lit-ui-router.dev/releases/lit-ui-router-ssr/0.11.0/) · [Diff from 0.10.0](https://lit-ui-router.dev/releases/lit-ui-router-ssr/diff/0.10.0...0.11.0/)

## 0.10.0 (2026-11-11)

### ⚠ BREAKING CHANGES

* **lit-ui-router-ssr:** the ui-router-server peer narrows from ^0.9.0 to ^0.10.0. prerender relies on
  ui-router-server 0.10's `base` support, so upgrade ui-router-server to 0.10 with this release.

### Features

* **lit-ui-router-ssr:** prerender under Vite's base ([#2040](https://github.com/simshanith/lit-ui-router/issues/2040)) ([a325e6b](https://github.com/simshanith/lit-ui-router/commit/a325e6b9c97441d66c0323a812b9bdf3806be4a9)), references [#2017](https://github.com/simshanith/lit-ui-router/issues/2017) [#2037](https://github.com/simshanith/lit-ui-router/issues/2037) [#2010](https://github.com/simshanith/lit-ui-router/issues/2010)

## 0.9.0 (2026-11-10)

### ⚠ BREAKING CHANGES

* **lit-ui-router-ssr:** prerender's trailingSlash option is gone with ui-router-server 0.9, because
  PrerenderOptions extends the server's through Omit<...>. Drop trailingSlash: 'both' (the default;
  output unchanged). trailingSlash: 'exact' has no replacement. To canonicalize pages, set
  config.trailingSlash: { pages, responses } on the mount.
* **lit-ui-router-ssr:** the ui-router-server peer narrows from ^0.8.0 to ^0.9.0. prerender relies on
  ui-router-server 0.9's redirectedTo export and its redirectTo status at verdict and settle ([#1921](https://github.com/simshanith/lit-ui-router/issues/1921)).

### Features

* **lit-ui-router-ssr:** render one page to a string for hosts that own the request ([#1965](https://github.com/simshanith/lit-ui-router/issues/1965)) ([a29a8ec](https://github.com/simshanith/lit-ui-router/commit/a29a8ecfbd1544e3f55dc9e50d6d969ce9e93c8d))
* **lit-ui-router-ssr:** warn when prerender draws a shadow-DOM element as an empty tag ([#1964](https://github.com/simshanith/lit-ui-router/issues/1964)) ([95cb345](https://github.com/simshanith/lit-ui-router/commit/95cb345833356841a01ef17fe8167308c47bb4b3))
* **lit-ui-router-ssr:** write a rules line for a page whose redirectTo fired ([#1921](https://github.com/simshanith/lit-ui-router/issues/1921)) ([c205843](https://github.com/simshanith/lit-ui-router/commit/c20584351040bcb869f5ea6f78d1c1b0af5b1821))

### Bug Fixes

* **lit-ui-router-ssr:** track served views by what they report, so bootstrap sees shadow-root views ([#1943](https://github.com/simshanith/lit-ui-router/issues/1943)) ([a7347ea](https://github.com/simshanith/lit-ui-router/commit/a7347ea5dc5a96121967799d5dc5bb8af2870d28)), closes [#1930](https://github.com/simshanith/lit-ui-router/issues/1930) [#1934](https://github.com/simshanith/lit-ui-router/issues/1934) [#1929](https://github.com/simshanith/lit-ui-router/issues/1929)

### Build System

* drop stale overrides, knip ignores and lint disables from the exception lists ([#1909](https://github.com/simshanith/lit-ui-router/issues/1909)) ([52faefd](https://github.com/simshanith/lit-ui-router/commit/52faefd28347d7437db68607d629f5a6f02c8ad7)), references [#721](https://github.com/simshanith/lit-ui-router/issues/721) [#1448](https://github.com/simshanith/lit-ui-router/issues/1448) [#1474](https://github.com/simshanith/lit-ui-router/issues/1474) [#1534](https://github.com/simshanith/lit-ui-router/issues/1534) [#1907](https://github.com/simshanith/lit-ui-router/issues/1907) [#1901](https://github.com/simshanith/lit-ui-router/issues/1901)
* **lint:** type-check doc-comment `@example` blocks on the TypeScript 7.1 API ([#1769](https://github.com/simshanith/lit-ui-router/issues/1769)) ([cc4269e](https://github.com/simshanith/lit-ui-router/commit/cc4269eaaac9d93b993d634f9ce017b15efa64b5)), closes [#1756](https://github.com/simshanith/lit-ui-router/issues/1756)
* **lint:** type-check opted-in Markdown ts blocks on the TypeScript 7.1 API ([#1663](https://github.com/simshanith/lit-ui-router/issues/1663)) ([1ee0ce3](https://github.com/simshanith/lit-ui-router/commit/1ee0ce3464c1a66d3d4655e10c4ef17eab936566))

### Documentation

* add an Eleventy prerender guide and example ([#1935](https://github.com/simshanith/lit-ui-router/issues/1935)) ([c6433a1](https://github.com/simshanith/lit-ui-router/commit/c6433a1f83a920e5f86a5501a49382405b828968))

## 0.8.1 (2026-11-03)

### Bug Fixes

* **lit-ui-router-ssr:** type definePrerender's entry over this package's prerender result ([#1856](https://github.com/simshanith/lit-ui-router/issues/1856)) ([03df5f6](https://github.com/simshanith/lit-ui-router/commit/03df5f64fa04d482443b888f9e5932ca36e6986e))

### Build System

* **lit-ui-router-ssr:** build this package's own types before its type-aware lint ([#1874](https://github.com/simshanith/lit-ui-router/issues/1874)) ([b26f797](https://github.com/simshanith/lit-ui-router/commit/b26f797b8a927165ae311c0a6cc062d40d94e58b))

## 0.8.0 (2026-11-03)

### ⚠ BREAKING CHANGES

* **lit-ui-router-ssr:** the ui-router-server peer narrows from ^0.7.0 to ^0.8.0 ([#1848](https://github.com/simshanith/lit-ui-router/issues/1848)).

### Features

* **lit-ui-router-ssr:** accept dehydrate options on prerender so the payload hook is optional ([#1819](https://github.com/simshanith/lit-ui-router/issues/1819)) ([87669a1](https://github.com/simshanith/lit-ui-router/commit/87669a1790903fcb33bdadd0f0efae7727b355a9))
* **lit-ui-router-ssr:** report each page's payload size and unserializable resolves from prerender ([#1820](https://github.com/simshanith/lit-ui-router/issues/1820)) ([6363e5a](https://github.com/simshanith/lit-ui-router/commit/6363e5aad39f928cdc83cee586372b135ed4211a))
* **lit-ui-router-ssr:** wrap serverRouterPlugin in a lit-ui-router-ssr/vite subpath that sets up Lit for the prerender script ([#1848](https://github.com/simshanith/lit-ui-router/issues/1848)) ([a9e866a](https://github.com/simshanith/lit-ui-router/commit/a9e866ad6249d9f9d91fadac8bdeb9361848dedb))
* **ui-router-server:** prerender the built app from serverRouterPlugin after vite build ([#1811](https://github.com/simshanith/lit-ui-router/issues/1811)) ([8cb4d63](https://github.com/simshanith/lit-ui-router/commit/8cb4d63fcd4d9abc113d232879cf197e5c7405ef)), references [#1816](https://github.com/simshanith/lit-ui-router/issues/1816)
* **ui-router-server:** run the prerender entry in a worker with preload modules ([#1823](https://github.com/simshanith/lit-ui-router/issues/1823)) ([c279fb3](https://github.com/simshanith/lit-ui-router/commit/c279fb344182d55c0812ae63e7495280ba5028cf))

## 0.7.0 (2026-10-31)

### ⚠ BREAKING CHANGES

* **lit-ui-router-ssr:** the lit-ui-router peer narrows from ^1.16.1 to ^1.19.0. Served views render through
  core's `routedViewTemplate` helper, which lit-ui-router 1.19.0 exports ([#1693](https://github.com/simshanith/lit-ui-router/issues/1693)).
* **lit-ui-router-ssr:** the ui-router-server peer narrows from ^0.6.0 to ^0.7.0. Serving response states uses
  ui-router-server 0.7's response-state API ([#1695](https://github.com/simshanith/lit-ui-router/issues/1695)).

### Features

* **lit-ui-router-ssr:** add a testing subpath that counts retained server nodes ([#1710](https://github.com/simshanith/lit-ui-router/issues/1710)) ([f7d52dd](https://github.com/simshanith/lit-ui-router/commit/f7d52ddd5aeb85f6fcbe6784035226932d4015ce))
* **lit-ui-router-ssr:** adopt the prerendered resolves on boot ([#1692](https://github.com/simshanith/lit-ui-router/issues/1692)) ([94983cd](https://github.com/simshanith/lit-ui-router/commit/94983cdc3394e721dde003188282f6209606ba22)), closes [#1019](https://github.com/simshanith/lit-ui-router/issues/1019)
* **lit-ui-router-ssr:** pass named transporters through prerender and bootstrap ([#1707](https://github.com/simshanith/lit-ui-router/issues/1707)) ([7a2b0b4](https://github.com/simshanith/lit-ui-router/commit/7a2b0b439262298cf6c891e67a6f95c2e0835748))
* **lit-ui-router-ssr:** render served views through core's helper and adopt class views ([#1693](https://github.com/simshanith/lit-ui-router/issues/1693)) ([02fdf5b](https://github.com/simshanith/lit-ui-router/commit/02fdf5b98f11e70a71bcd379366e7fd7c1274ca7))
* **lit-ui-router-ssr:** serve response states after settle ([#1695](https://github.com/simshanith/lit-ui-router/issues/1695)) ([5c65da3](https://github.com/simshanith/lit-ui-router/commit/5c65da3eddecb81d6e36360f24f3bdc26d704571)), references [#1677](https://github.com/simshanith/lit-ui-router/issues/1677)
* **ui-router-server:** declare response states and prerender their bodies ([#1694](https://github.com/simshanith/lit-ui-router/issues/1694)) ([cc52724](https://github.com/simshanith/lit-ui-router/commit/cc527244014ae177ad9a11e48fdff9a3b204eba8))

### Bug Fixes

* **lit-ui-router-ssr:** render a view cold when its url params differ from the drawn ones ([#1699](https://github.com/simshanith/lit-ui-router/issues/1699)) ([77eb2de](https://github.com/simshanith/lit-ui-router/commit/77eb2defba50fb3d22538a9956c145f264ac41bd))

## 0.6.0 (2026-10-30)

### ⚠ BREAKING CHANGES

* **lit-ui-router-ssr:** the ui-router-server peer narrows from ^0.5.0 to ^0.6.0 ([#1681](https://github.com/simshanith/lit-ui-router/issues/1681)).

### Features

* **lit-ui-router-ssr:** add bootstrap() to boot the router and adopt or render the page ([#1654](https://github.com/simshanith/lit-ui-router/issues/1654)) ([19cf146](https://github.com/simshanith/lit-ui-router/commit/19cf146c3df5a37b3e1a164944bb43b549e1ceef))
* **lit-ui-router-ssr:** hydrate consumer light-DOM elements in place ([#1668](https://github.com/simshanith/lit-ui-router/issues/1668)) ([f328cf1](https://github.com/simshanith/lit-ui-router/commit/f328cf15674a09fba92d1e74299b475055e0b3f7)), references [#904](https://github.com/simshanith/lit-ui-router/issues/904) [#904](https://github.com/simshanith/lit-ui-router/issues/904) [#1527](https://github.com/simshanith/lit-ui-router/issues/1527) [#1528](https://github.com/simshanith/lit-ui-router/issues/1528) [#1653](https://github.com/simshanith/lit-ui-router/issues/1653)
* **lit-ui-router:** export the routed view's template helper and adopt served class elements ([#1653](https://github.com/simshanith/lit-ui-router/issues/1653)) ([c8e739d](https://github.com/simshanith/lit-ui-router/commit/c8e739d19ae7ced95f71a88539c25c4f3a45ac01)), references [#1527](https://github.com/simshanith/lit-ui-router/issues/1527) [#1528](https://github.com/simshanith/lit-ui-router/issues/1528)
* **ui-router-server:** add a delegate verdict that hands matching requests to host handlers ([#1438](https://github.com/simshanith/lit-ui-router/issues/1438)) ([1c2cac9](https://github.com/simshanith/lit-ui-router/commit/1c2cac9bf9ec82b6fbc3f17315354d2e1fed1c2b)), references [#1435](https://github.com/simshanith/lit-ui-router/issues/1435) [#1306](https://github.com/simshanith/lit-ui-router/issues/1306) [#1439](https://github.com/simshanith/lit-ui-router/issues/1439)
* **ui-router-server:** move the prerender loop into a ui-router-server/prerender entry ([#1657](https://github.com/simshanith/lit-ui-router/issues/1657)) ([9266018](https://github.com/simshanith/lit-ui-router/commit/92660184d9980e90964f7e785d5efeb5cae43b42)), references [#1586](https://github.com/simshanith/lit-ui-router/issues/1586)

### Bug Fixes

* **lit-ui-router-ssr:** leave a sticky class view empty for the client to render ([#1661](https://github.com/simshanith/lit-ui-router/issues/1661)) ([d2ba0d1](https://github.com/simshanith/lit-ui-router/commit/d2ba0d1bb19e9fce7addb8188e9cd0e0f67e6739))
* **lit-ui-router-ssr:** recognise a sticky class by core's brand, falling back to the result shape ([#1671](https://github.com/simshanith/lit-ui-router/issues/1671)) ([4fb04df](https://github.com/simshanith/lit-ui-router/commit/4fb04df0e356e5be2611d29a9eb63c94e69ae98d))

### Documentation

* **lit-ui-router-ssr:** document the delegate tally and delegated paths in prerender ([#1439](https://github.com/simshanith/lit-ui-router/issues/1439)) ([ae582f8](https://github.com/simshanith/lit-ui-router/commit/ae582f846d9f2944e451e632d181afa70d971b8c))

## 0.5.0 (2026-10-29)

### Features

* **lit-ui-router-ssr:** require ui-router-server 0.5 and re-export settle from ui-router-server/ssr ([#1647](https://github.com/simshanith/lit-ui-router/issues/1647)) ([8ad5880](https://github.com/simshanith/lit-ui-router/commit/8ad5880c4b45658e48103b774b31170493b6d4aa))

### Documentation

* link the package README release badges to each package's latest GitHub release ([#1501](https://github.com/simshanith/lit-ui-router/issues/1501)) ([9e96854](https://github.com/simshanith/lit-ui-router/commit/9e96854750595230146252667c85ea7b2fc1714d))

## 0.4.0 (2026-10-17)

### Features

* **lit-ui-router-ssr:** warn under node unless NODE_ENV is production ([#1409](https://github.com/simshanith/lit-ui-router/issues/1409)) ([0da93d5](https://github.com/simshanith/lit-ui-router/commit/0da93d5dd4621f06f17ab1df627064fec5eb288a)), references [package.json#imports](https://github.com/package.json/issues/imports) [package.json#imports](https://github.com/package.json/issues/imports) [#dev-gate](https://github.com/simshanith/lit-ui-router/issues/dev-gate) [#dev-gate](https://github.com/simshanith/lit-ui-router/issues/dev-gate)
* **ui-router-server:** share a mount's url config with any router ([#1335](https://github.com/simshanith/lit-ui-router/issues/1335)) ([4faf271](https://github.com/simshanith/lit-ui-router/commit/4faf271e2cce8234f084626d733395c8e0bd93f7))
* **ui-router-server:** warn about mounts whose bare base 404s, with diagnoseMounts(router) and per-mount ignoreDiagnostics ([#1383](https://github.com/simshanith/lit-ui-router/issues/1383)) ([1c0b785](https://github.com/simshanith/lit-ui-router/commit/1c0b785308dc39f0fd141f6b53cd4b01b52385f7)), closes [#805](https://github.com/simshanith/lit-ui-router/issues/805), references [#dev-gate](https://github.com/simshanith/lit-ui-router/issues/dev-gate) [#dev-gate](https://github.com/simshanith/lit-ui-router/issues/dev-gate) [#dev-gate](https://github.com/simshanith/lit-ui-router/issues/dev-gate) [#dev-gate](https://github.com/simshanith/lit-ui-router/issues/dev-gate) [#dev-gate](https://github.com/simshanith/lit-ui-router/issues/dev-gate)

### Documentation

* **lit-ui-router-ssr:** group the API reference by entry point ([#1381](https://github.com/simshanith/lit-ui-router/issues/1381)) ([f470168](https://github.com/simshanith/lit-ui-router/commit/f47016845d18667bf1fd0451bdbe56a385a5ff2d))

## 0.3.0 (2026-10-15)

### Bug Fixes

* **lit-ui-router-ssr:** require lit 3, @lit-labs/ssr 4.1 and @lit-labs/ssr-client 1.1.7 peers ([#1376](https://github.com/simshanith/lit-ui-router/issues/1376)) ([1f4cc4d](https://github.com/simshanith/lit-ui-router/commit/1f4cc4d8e1bb870312ca88088dd441bea69e336e))

## 0.2.3 (2026-10-15)

### Bug Fixes

* **lit-ui-router-ssr:** typecheck against the @uirouter/core and @lit-labs/ssr peer floors ([#1362](https://github.com/simshanith/lit-ui-router/issues/1362)) ([62b7803](https://github.com/simshanith/lit-ui-router/commit/62b7803d84f6a6ce7a91f388ac3dca9e56f592de)), closes [#1359](https://github.com/simshanith/lit-ui-router/issues/1359)

## 0.2.2 (2026-10-15)

### Bug Fixes

* **lit-ui-router-ssr:** pass NOWAIT resolves to server-rendered views as promises ([#1322](https://github.com/simshanith/lit-ui-router/issues/1322)) ([6f05b83](https://github.com/simshanith/lit-ui-router/commit/6f05b83b00517e97932f028b40489e5c2a32c7fd)), closes [#1316](https://github.com/simshanith/lit-ui-router/issues/1316)

### Documentation

* show one npm install command per block and on the home hero ([#1262](https://github.com/simshanith/lit-ui-router/issues/1262)) ([d5c4bae](https://github.com/simshanith/lit-ui-router/commit/d5c4bae96b1918ac3a131b48cd6bb2c43f9bd8f2))

## 0.2.1 (2026-10-10)

### Code Refactoring

* enable anti-slop no-runtime-typeof and decode or name each type check ([#1153](https://github.com/simshanith/lit-ui-router/issues/1153)) ([05accd8](https://github.com/simshanith/lit-ui-router/commit/05accd8644aa01086aa064c83f7d4d4df0a7d44a))
* enable the anti-slop type-assertion rules and retype or justify each cast ([#1152](https://github.com/simshanith/lit-ui-router/issues/1152)) ([643814f](https://github.com/simshanith/lit-ui-router/commit/643814f6ab4e2f976e4bb1746d9a44cb823ac327))
* enable the anti-slop typing rules and tighten the types they flag ([#1151](https://github.com/simshanith/lit-ui-router/issues/1151)) ([a16befb](https://github.com/simshanith/lit-ui-router/commit/a16befbf026033f0085bc0bd40cf671887861040))

### Build System

* vendor the anti-slop oxlint plugin as @tools/oxlint-anti-slop ([#1143](https://github.com/simshanith/lit-ui-router/issues/1143)) ([e1b60ed](https://github.com/simshanith/lit-ui-router/commit/e1b60ed326884cf7217eb195e0c82d33b4d738ba))

## 0.2.0 (2026-10-04)

### ⚠ BREAKING CHANGES

* **lit-ui-router-ssr:** the lit-ui-router peer narrows from ^1.16.0 to ^1.16.1. lit-ui-router 1.16.1 ships the
  placeholder-router upgrade fix that served pages need ([#1108](https://github.com/simshanith/lit-ui-router/issues/1108)).

### Features

* **lit-ui-router-ssr:** write a hydration signature the client reads before touching the DOM ([#1070](https://github.com/simshanith/lit-ui-router/issues/1070)) ([4891f02](https://github.com/simshanith/lit-ui-router/commit/4891f02ebca4f61d3c0fe10009ff9224cb6d4ee6)), closes [#908](https://github.com/simshanith/lit-ui-router/issues/908), references [#907](https://github.com/simshanith/lit-ui-router/issues/907)

### Bug Fixes

* **lit-ui-router-ssr:** report a throwing onAdopt through reportError ([#1115](https://github.com/simshanith/lit-ui-router/issues/1115)) ([c0731a9](https://github.com/simshanith/lit-ui-router/commit/c0731a945c670dbf7bbe655075269e63d24f95aa)), references [#1113](https://github.com/simshanith/lit-ui-router/issues/1113)

### Code Refactoring

* **lit-ui-router-ssr:** split prerender into module helpers ([#1062](https://github.com/simshanith/lit-ui-router/issues/1062)) ([6a3c4ea](https://github.com/simshanith/lit-ui-router/commit/6a3c4ea750e9974a51af72174113c64cfa4ba872))

### Build System

* **tools:** add a report-only crap task for CRAP hotspots ([#1056](https://github.com/simshanith/lit-ui-router/issues/1056)) ([d39b706](https://github.com/simshanith/lit-ui-router/commit/d39b7064f8d9d8036fac1257ca319618064b7f73)), references `crap-rs#193`
* **turbo:** replace with sidecars with umbrella tasks ([#1038](https://github.com/simshanith/lit-ui-router/issues/1038)) ([aec4ee8](https://github.com/simshanith/lit-ui-router/commit/aec4ee8a8a6a44c8a3c99a7e08abb789343ef8e0))

## 0.1.1 (2026-09-29)

### Bug Fixes

* **lit-ui-router-ssr:** mark @lit-labs/ssr-client as an optional peer ([#1027](https://github.com/simshanith/lit-ui-router/issues/1027)) ([c61b7e8](https://github.com/simshanith/lit-ui-router/commit/c61b7e819c3967e13f53670700f56004fde44d7c))

## 0.1.0 (2026-09-29)

### Features

* **lit-ui-router-ssr:** a served view reports its hydration outcome as a value ([#1020](https://github.com/simshanith/lit-ui-router/issues/1020)) ([c7ad220](https://github.com/simshanith/lit-ui-router/commit/c7ad22062f10192e5a5135a5085ac098963fc1c6)), references [#829](https://github.com/simshanith/lit-ui-router/issues/829)
* **lit-ui-router-ssr:** add the register entry that defines a served ui-view ([#940](https://github.com/simshanith/lit-ui-router/issues/940)) ([3c0e165](https://github.com/simshanith/lit-ui-router/commit/3c0e165cbf02e9f24a4d23dedbe850c528b3245a))
* **lit-ui-router-ssr:** prerender a static site from a mount table's verdicts ([#880](https://github.com/simshanith/lit-ui-router/issues/880)) ([3793133](https://github.com/simshanith/lit-ui-router/commit/379313376d645069e23100a11a654b35d766ce16)), closes [#806](https://github.com/simshanith/lit-ui-router/issues/806)
* **lit-ui-router-ssr:** settle a server router on a path before rendering ([#1010](https://github.com/simshanith/lit-ui-router/issues/1010)) ([b4dfda6](https://github.com/simshanith/lit-ui-router/commit/b4dfda65a552f71d50330e616003b06aca96910d)), closes [#885](https://github.com/simshanith/lit-ui-router/issues/885)
* **lit-ui-router-ssr:** ui-view renderer and the client hydration subpath ([#902](https://github.com/simshanith/lit-ui-router/issues/902)) ([cb03dc4](https://github.com/simshanith/lit-ui-router/commit/cb03dc404b091be626e1849dbc1675189cb1c17d)), references [#900](https://github.com/simshanith/lit-ui-router/issues/900) [#829](https://github.com/simshanith/lit-ui-router/issues/829) [#898](https://github.com/simshanith/lit-ui-router/issues/898)
* **lit-ui-router-ssr:** wire the package into the release pipeline ([#892](https://github.com/simshanith/lit-ui-router/issues/892)) ([4223ffc](https://github.com/simshanith/lit-ui-router/commit/4223ffc7f35e560e2fd119e3ea2bd98fc8a013eb))

### Bug Fixes

* **lit-ui-router-effect:** read the scoped router when no ui-router can be sought ([#994](https://github.com/simshanith/lit-ui-router/issues/994)) ([7d7489e](https://github.com/simshanith/lit-ui-router/commit/7d7489e449fb01ce92e05e77388a21742a8e4c67))
* **lit-ui-router-ssr:** clear the whole served interior on a mismatch ([#975](https://github.com/simshanith/lit-ui-router/issues/975)) ([5af4f32](https://github.com/simshanith/lit-ui-router/commit/5af4f329b26623465ab8894d5a6c9eb7753a392a))
* **lit-ui-router-ssr:** declare @oxc-project/runtime as a dependency ([#1024](https://github.com/simshanith/lit-ui-router/issues/1024)) ([efe38df](https://github.com/simshanith/lit-ui-router/commit/efe38dfe8715f73fd020c9e3dd75a821be57d2f8))
* **lit-ui-router-ssr:** uiViewSlot() inherits the renderLight flag from ssr-client's class ([#936](https://github.com/simshanith/lit-ui-router/issues/936)) ([dd3d08b](https://github.com/simshanith/lit-ui-router/commit/dd3d08bce73792f52ce3348a4c1434eae07d8d3e))
* **lit-ui-router:** name the class that holds the tag when a register module stands down ([#977](https://github.com/simshanith/lit-ui-router/issues/977)) ([56f9fb3](https://github.com/simshanith/lit-ui-router/commit/56f9fb3f81f023ebc79123a25d6ae521de86e748))
* **ssr:** warn when a prerender mount refuses the trailing slash static hosts add ([#1021](https://github.com/simshanith/lit-ui-router/issues/1021)) ([0446780](https://github.com/simshanith/lit-ui-router/commit/04467804b1a5630c9f269e117c629c587fe20db6)), closes [#807](https://github.com/simshanith/lit-ui-router/issues/807)
* **ssr:** warn when prerender() finds no `<ui-view>` registered ([#1022](https://github.com/simshanith/lit-ui-router/issues/1022)) ([6094bff](https://github.com/simshanith/lit-ui-router/commit/6094bff35c54072909fa9f828ba288e48c3b2668)), closes [#807](https://github.com/simshanith/lit-ui-router/issues/807) [#808](https://github.com/simshanith/lit-ui-router/issues/808)

### Code Refactoring

* **lit-ui-router:** lift the hydration seam out of ui-view into the ssr served view ([#941](https://github.com/simshanith/lit-ui-router/issues/941)) ([9672155](https://github.com/simshanith/lit-ui-router/commit/967215563733206a9d7364973268e67cc9316b58))

### Documentation

* **lit-ui-router-ssr:** a property binding emits nothing on the server ([#1008](https://github.com/simshanith/lit-ui-router/issues/1008)) ([9aa6a3d](https://github.com/simshanith/lit-ui-router/commit/9aa6a3db92f01427945378d43fb8291387128100))
* **lit-ui-router-ssr:** add lit-ui-router/pure recipe ([#971](https://github.com/simshanith/lit-ui-router/issues/971)) ([5a4f9bd](https://github.com/simshanith/lit-ui-router/commit/5a4f9bdd41cb2fdf1b5f3db24f5d11a5554f2f63)), closes [#969](https://github.com/simshanith/lit-ui-router/issues/969)
