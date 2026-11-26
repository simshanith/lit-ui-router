# Changelog

Prereleases and canaries are not listed here; see [all releases](https://lit-ui-router.dev/releases/ui-router-devtools/).

## 0.2.0 (2026-11-26)

<!-- notes-through: 035e74f540e28f6d24afbbd9f7393c8a3a9266e7 -->

### Features

* **ui-router-devtools:** add a lazy entry that records from startup and loads the panel on demand ([#2457](https://github.com/simshanith/lit-ui-router/issues/2457)) ([7d35686](https://github.com/simshanith/lit-ui-router/commit/7d356864aa50387fd8803798c7e873c0af56849e))

### Documentation

* add the README badge row to ui-router-devtools and ui-router-otel ([#2468](https://github.com/simshanith/lit-ui-router/issues/2468)) ([4caae75](https://github.com/simshanith/lit-ui-router/commit/4caae75a82078d3095c526ab53f999c68e063bbf))

[Release page](https://lit-ui-router.dev/releases/ui-router-devtools/0.2.0/) · [Diff from 0.1.0](https://lit-ui-router.dev/releases/ui-router-devtools/diff/0.1.0...0.2.0/)

## 0.1.0 (2026-11-24)

### Features

* **ui-router-devtools:** add a private devtools package for `@uirouter/core` routers ([#2069](https://github.com/simshanith/lit-ui-router/issues/2069)) ([555f0e9](https://github.com/simshanith/lit-ui-router/commit/555f0e9f6004f428b58627ad7b94973c238b159a))
* **ui-router-devtools:** add a Timeline tab and an OpenTelemetry span input ([#2150](https://github.com/simshanith/lit-ui-router/issues/2150)) ([178132e](https://github.com/simshanith/lit-ui-router/commit/178132e4e2f51ec55aaf0b91523bfdd1169691dd))
* **ui-router-devtools:** add a view map of the router's ui-views ([#2201](https://github.com/simshanith/lit-ui-router/issues/2201)) ([7ea5039](https://github.com/simshanith/lit-ui-router/commit/7ea50393f5a8d2b46706d1a4ad323e6e56afa694))
* **ui-router-devtools:** add ways to clear the selection and hide the inspector ([#2196](https://github.com/simshanith/lit-ui-router/issues/2196)) ([d65ffb0](https://github.com/simshanith/lit-ui-router/commit/d65ffb0ea013e21563d3c9797138f3dbfe0d434e))
* **ui-router-devtools:** copy a state's name from the inspector ([#2214](https://github.com/simshanith/lit-ui-router/issues/2214)) ([54d8855](https://github.com/simshanith/lit-ui-router/commit/54d8855762ad8e2bff6f06b1a84cc0e68ee02b3e))
* **ui-router-devtools:** draw the Map as nested boxes with routed edges on selection ([#2101](https://github.com/simshanith/lit-ui-router/issues/2101)) ([b49a06c](https://github.com/simshanith/lit-ui-router/commit/b49a06c1ca5c334ad8e1af5a4f61961b63b5de11))
* **ui-router-devtools:** give the nested Map a viewport, a port budget, count chips and a minimap ([#2127](https://github.com/simshanith/lit-ui-router/issues/2127)) ([1a559af](https://github.com/simshanith/lit-ui-router/commit/1a559af0dc04d61d71ea4536fe2398902475b4ce))
* **ui-router-devtools:** go to a lazy state from the inspector ([#2192](https://github.com/simshanith/lit-ui-router/issues/2192)) ([6f22d89](https://github.com/simshanith/lit-ui-router/commit/6f22d89db0e8ac38eb73f6db470c6fba8e8f00bc))
* **ui-router-devtools:** go to a state on double-click ([#2199](https://github.com/simshanith/lit-ui-router/issues/2199)) ([ca88653](https://github.com/simshanith/lit-ui-router/commit/ca88653214c3881d2faae1c901682c44c72a72db))
* **ui-router-devtools:** mark abstract, default-child, history and sticky states in the outline ([#2093](https://github.com/simshanith/lit-ui-router/issues/2093)) ([2e5ba22](https://github.com/simshanith/lit-ui-router/commit/2e5ba22ccdeba893d5cd1a1ee9e5ce0016b293d4))
* **ui-router-devtools:** settle the v1 event schema and session file ([#2117](https://github.com/simshanith/lit-ui-router/issues/2117)) ([2942626](https://github.com/simshanith/lit-ui-router/commit/2942626418d22e47ae11dc59d9dd3f2a6a82f794))
* **ui-router-devtools:** show the active state's view path under the Map ([#2202](https://github.com/simshanith/lit-ui-router/issues/2202)) ([25cf86b](https://github.com/simshanith/lit-ui-router/commit/25cf86ba16ffc70b44abd97eeab41dc65d281c71))
* **ui-router-devtools:** wire the package into the release pipeline ([#2344](https://github.com/simshanith/lit-ui-router/issues/2344)), references [#2331](https://github.com/simshanith/lit-ui-router/issues/2331)
* **ui-router-otel:** add a private package that reports transitions as OpenTelemetry spans ([#2104](https://github.com/simshanith/lit-ui-router/issues/2104)) ([574cbd0](https://github.com/simshanith/lit-ui-router/commit/574cbd0478cd0c765a5f590368eea58e41a76543))
* **ui-router-otel:** make transition hooks and lazy loads active spans ([#2206](https://github.com/simshanith/lit-ui-router/issues/2206)) ([d8b74ac](https://github.com/simshanith/lit-ui-router/commit/d8b74ac59e4b59f1fd6a32ebd7bb954ca85f8860))

### Bug Fixes

* **ui-router-devtools:** keep the duration inside the collapsed pill beside a long state name ([#2232](https://github.com/simshanith/lit-ui-router/issues/2232)) ([4466008](https://github.com/simshanith/lit-ui-router/commit/4466008852b0d04bb69f694fbf70503c0e4c00f1))
* **ui-router-devtools:** start the Map strip's keys at the right end and stop its per-render scroll ([#2181](https://github.com/simshanith/lit-ui-router/issues/2181)) ([abd6d27](https://github.com/simshanith/lit-ui-router/commit/abd6d27b59f39fafc0623e2c197e15f43ecb8337))

### Code Refactoring

* **ui-router-otel:** move transition attributes under uirouter.transition.* ([#2353](https://github.com/simshanith/lit-ui-router/issues/2353)) ([b0ab89b](https://github.com/simshanith/lit-ui-router/commit/b0ab89b19d288c3962873f5ad6102d0f7a97fbc3))

<details>
<summary>Also touched this package (1)</summary>

* **ui-router-otel:** say how to send spans to other trace viewers ([#2217](https://github.com/simshanith/lit-ui-router/pull/2217))

</details>

[Release page](https://lit-ui-router.dev/releases/ui-router-devtools/0.1.0/)
