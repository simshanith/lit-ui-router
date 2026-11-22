# Changelog

Prereleases and canaries are not listed here; see [all releases](https://lit-ui-router.dev/releases/lit-ui-router-effect/).

## 0.7.2 (2026-11-22)

* fix(eslint-plugin-lit-ui-router): stop reporting sref-active-aria-current on non-link elements (#2352) (70a8d92b)
* fix(eslint-plugin-lit-ui-router): stop directive-position flagging static-html literal tags (#2351) (0e628298)
* fix(eslint-plugin-lit-ui-router): drop import autofixes when the name is bound at the fix site (#2349) (4bc1caa3)
* fix(eslint-plugin-lit-ui-router): insert aria-current after class text with an entity or CRLF (#2354) (01a68f09)
* fix(ui-router-registry): type array params as arrays (#2358) (1ae8af33)
* fix(lit-ui-router): resolve a template shared by two states against the state now filling the view (#2350) (23003bb6)
* fix(lit-ui-router): keep a re-attached ui-view's routed class element instead of rebuilding it (#2348) (89a7c108)
* fix(lit-ui-router): resolve a relative sref in a ui-view's fallback content against the parent state (#2333) (102dc9ab)
* fix(ui-router-registry): read url params the way core's UrlMatcher does (#2361) (d8fad4b8)
* fix(lit-ui-router-ssr): prerender each page with its own resolves when only a dynamic param changes (#2356) (454e43fa)
* test(ui-router-devtools): wait for the Map's rendering update before reading its layout (#2381) (61bcb657)
* chore(deps): bump the vitest group across 1 directory with 4 updates (#2366) (4957b0ae)
* docs(lit-ui-router): make the viewRendered() focus and View Transition examples safe to copy (#2330) (7a3284d1)
* docs(www): point the examples index at the sample app overview (#2345) (be815319)
* chore(deps): bump pullfrog/pullfrog from 0.1.130 to 0.1.139 in the actions-minor-and-patch group (#2365) (04319021)
* chore(deps): bump the minor-and-patch group with 25 updates (#2369) (89bf487c)
* refactor(ui-router-otel): move transition attributes under uirouter.transition.* (#2353) (b0ab89b1)
* build(postcss-lit-html): move the syntax to tools/ as internal tooling (#2363) (b937ec27)
* docs(www): arrange the home page flame texture in offset columns (#2347) (f363abd3)
* docs(www): tessellate the Lit flame behind the home page section (#2346) (006dd379)
* docs(www): show a features tour slideshow and its state on the home page (#2322) (5986741e)
* test(ui-router-devtools): measure the Map after its boxes settle in the inspector close spec (#2329) (a460e475)
* fix(examples): mark the active link with a filled pill keyed off aria-current (#2324) (3c5ebfe2)
* feat(ui-router-devtools): show the active state's view path under the Map (#2202) (25cf86ba)
* feat(ui-router-devtools): add a view map of the router's ui-views (#2201) (7ea50393)
* feat(www): list docs lines per package in the version menu (#2317) (e5645df8)
* feat(ci): link the branch alias as a PR's preview deployment, the commit preview under /commit (#2327) (7d901d5c)
* docs(www): add Coming from UI-Router migration guide (#2296) (06615e2f)
* ci: pass the Pullfrog model as the PULLFROG_MODEL env var (#2323) (2647bcad)
* ci: check npmx.dev package links against the npm registry (#2319) (e6f7bd56)
* feat(www): redirect /main/ to the docs root (#2316) (3ae86d3a)
* docs: add plain-language opening sentences to package pages and READMEs (#2315) (7e298d11)
* docs(www): label package pages by npm name in the sidebar (#2303) (349c329a)
* docs(www): add Links and Navigation guide (#2292) (3355802a)
* docs(www): separate the prerender and per-request inputs in the SSR package row (#2314) (943c26b0)
* docs(www): say who the router is for on the home page (#2307) (3cf43391)
* docs(www): correct the home page's resolves card and the site description (#2285) (c51369fe)
* refactor(release): run task scripts as executables, not through node (#2304) (9405f7a0)
* docs(www): give Examples its own sidebar section and Docs menu entry (#2300) (5e6abca5)
* docs(www): trim contributor shorthand and normalize package pages (#2299) (6916d400)
* docs(examples): correct the redirect history comment for hash URLs (#2310) (9ef6cb49)
* docs(examples): read routed props from uiViewProps without a constructor (#2301) (dc554c30)
* docs(www): add local starter commands and post-tutorial guide links (#2286) (eb72ea1f)
* docs(www): say Typing resolves names are adapted from the Altitude Atlas (#2313) (82459e70)
* docs(www): rewrite sample app overview with feature map and source links (#2297) (765c7a3d)
* docs(www): fix factual contradictions, quick starts, stale facts, and links (#2284) (ccd9a1d3)
* docs(www): trim Spectrum walkthrough and clarify routed-components examples (#2298) (e6180c85)
* feat(www): build the release pages' header from the docs navigation (#2288) (b0755e08)
* docs(www): add Redirects guide (#2295) (54396fce)
* docs(www): add State Parameters guide (#2294) (e533d713)
* docs(www): add summaries and a package link to each API reference index (#2293) (d0f0cf90)
* docs(www): group the guides sidebar as #1566 orders it (#2289) (d673ab73)
* docs(www): add plain-language lead to server overview and trim package shorthand (#2291) (fa22d773)
* docs(navigation-location-plugin): trim CI runner details from README (#2290) (eccf916c)
* docs(lit-ui-router): fix the README quick start and the development warning count (#2287) (bfee1f39)
* feat(ci): record Workers Builds preview URLs as GitHub Deployments (#2283) (9036bf3c)
* perf(sample-app): wait for the devtools install before starting only when spans are exported (#2281) (afc78e84)
* docs(www): record the 1.x docs snapshot re-baked with the llms-full.txt base fix (#2270) (85e06646)
* fix(sample-app): start the router after the devtools install so the first transition is traced (#2269) (1fb0b87a)
* feat(sample-apps): export router spans over OTLP when a build sets an endpoint (#2236) (1a7069ff)
* feat(www): list recent releases across packages on /releases/ (#2241) (f99acbc7)
* feat(www): link the publishing run and keep the integrity hash on deprecated versions (#2240) (30408661)
* feat(www): redirect every dist-tag on the release pages and label tagged versions (#2242) (c4bc53e4)
* chore(deps): bump distilled to 1.0.0-rc.20 with a patch for the workers_builds list types (#2266) (82237e82)
* chore(deps): bump oxlint to 1.94.0 (#2264) (55ac2ddb)
* build(deps): bump signal-polyfill to 0.2.3 in the examples and sample app (#2265) (261c2619)
* chore(deps): bump turbo 2.11.11, cf 1.0 rc.1 with wrangler 4.164, gray-matter 3, and tooling patches (#2261) (3bfa24f0)
* feat(www): show the release notes for every version in a compare range (#2238) (ca57abae)
* feat(www): mark breaking changes and show the install command on release pages (#2239) (479b2b80)
* chore(deps): bump pullfrog/pullfrog from 0.1.127 to 0.1.130 in the actions-minor-and-patch group (#2256) (86793544)
* chore(deps): bump @pierre/trees from 1.0.0-beta.6 to 1.0.0 (#2259) (084303c0)
* fix(ui-router-devtools): keep the duration inside the collapsed pill beside a long state name (#2232) (44660088)
* fix(www): stop doubling the base in a docs snapshot's llms-full.txt (#2255) (f6afe79f)
* docs(www): refresh the 1.x docs snapshot from lit-ui-router-ssr@0.11.1 (#2234) (cb712fb8)
* build(www): stop storing the Workers' traces in Cloudflare and hold the configs equal (#2230) (a98ab6ce)
* docs(www): describe the Workers' observability and the Honeycomb destination (#2229) (3c1d8ae9)
* feat(www): send security headers from the docs site, worker-rendered pages included (#2252) (b19ac348)
* fix(www): stop saying release notes live only on GitHub (#2233) (d425b5ec)
* feat(www): serve the frozen 1.x docs at /v1/ (#2167) (917cd155)
* feat(www): add the docs version manifest, menu and banner (#1945) (0cacee7e)
* build: bump pnpm to 12.21.0 (#2227) (bb152f90)
* build(www): send the release-diffs Worker's traces to Honeycomb (#2228) (9414f842)
* feat(ui-router-otel): make transition hooks and lazy loads active spans (#2206) (d8b74ac5)
* docs(ui-router-otel): say how to send spans to other trace viewers (#2217) (667e6304)
* build(www): send the Workers' traces to a Honeycomb destination (#2225) (94a9a6af)
* perf(www): cache the hashed build assets for a year (#2216) (229a4a5e)
* test(ui-router-server): cover a request url that is a bare origin under a base (#2221) (cbe06d33)
* ci: cache the examples' npm installs (#2218) (6d9f6252)
* build(www): turn on Workers traces for the docs worker (#2219) (090fd033)
* feat(sample-apps): show OpenTelemetry spans in the devtools Timeline (#2193) (1903a914)
* feat(ui-router-devtools): add a Timeline tab and an OpenTelemetry span input (#2150) (178132e4)
* feat(ui-router-devtools): copy a state's name from the inspector (#2214) (54d88557)
* feat(ui-router-devtools): add ways to clear the selection and hide the inspector (#2196) (d65ffb0e)
* feat(ui-router-devtools): go to a state on double-click (#2199) (ca886532)
* docs(www): call the prerender guides static site generators (SSG) (#2197) (2f0d86c1)
* feat(www): match synonyms in docs search, such as 11ty for Eleventy (#2190) (1bfd2f26)
* feat(ui-router-devtools): go to a lazy state from the inspector (#2192) (6f22d89d)
* fix(examples): stop active and pressed states shifting the layout (#2191) (5a7c61d7)
* fix(release): wait for npm to list a new version before the post-publish published-diff (#2186) (87dafd6b)
* feat(www): group a package's releases by minor and fold away prereleases (#2177) (59862a92)
* feat(www): show release notes on the release pages (#2166) (881f11ed)
* chore(deps): bump glob from 13.0.6 to 13.0.7 in the security group across 1 directory (#2185) (8d638492)
* feat(examples): follow the system color scheme in the hello examples (#2189) (45e29b2c)
* build(examples): move the examples to this week's patch releases (#2187) (b8e9dca4)
* Release 0.11.1 (#2184) (aa7f8bfb)
* Release 0.11.1 (#2183) (623103a1)
* feat(www): default the release compare form to the published-files diff (#2182) (699189e2)
* feat(examples): key solar system urls by body name, redirecting the numbered ones (#2180) (c80d0185)
* feat(www): add previous and next links and a prerelease marker to release pages (#2176) (35267bb8)
* fix(ui-router-devtools): start the Map strip's keys at the right end and stop its per-render scroll (#2181) (abd6d27b)
* fix(ui-router-server): reject a listed prerender path with a malformed percent-escape (#2170) (22271c1e)
* fix(www): show the whole atlas model on the packages page (#2168) (9ff8d74e)
* docs(lit-ui-router-ssr): correct the peer ranges and the Quick Start tally (#2148) (f7d61210)
* fix(ui-router-server): write decoded prerender file names and encoded _redirects lines (#2155) (4d3e227c)
* docs(ui-router-server): note that the core-free entries' types reference @uirouter/core (#2156) (838ffc6e)
* fix(ui-router-server): keep the shell asset's own Link header beside the canonical one (#2146) (d09fac8d)
* fix(ui-router-server): pass a throw inside the Connect verdict callback to next(error) (#2138) (ca404e6d)
* fix(ui-router-server): serve the shell for a malformed percent-escape on matcher mounts (#2140) (52d30303)
* fix(lit-ui-router-ssr): settle template on the path within its mount (#2144) (74fc4bb9)
* fix(ui-router-server): report a redirectTo that lands where the router already stands (#2142) (d9e12f7b)
* fix(ui-router-server): keep the vite preview page lookup inside outDir (#2149) (8e6c4f15)
* test(ui-router-devtools): settle the nested Map specs without racing motion (#2164) (8acc9865)
* build(repo-checks): keep .playwright-cli/ out of check:knip's inputs (#2152) (21d9b0a0)
* ci: read the Pullfrog model from a repository variable (#2153) (f6c54b5b)
* Release 1.3.1 (#2161) (4af3af48)

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
