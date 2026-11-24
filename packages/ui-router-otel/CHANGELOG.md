# Changelog

Prereleases and canaries are not listed here; see [all releases](https://lit-ui-router.dev/releases/ui-router-otel/).

## 0.1.0 (2026-11-24)

### Features

* **ui-router-devtools:** add a Timeline tab and an OpenTelemetry span input ([#2150](https://github.com/simshanith/lit-ui-router/issues/2150)) ([178132e](https://github.com/simshanith/lit-ui-router/commit/178132e4e2f51ec55aaf0b91523bfdd1169691dd))
* **ui-router-devtools:** settle the v1 event schema and session file ([#2117](https://github.com/simshanith/lit-ui-router/issues/2117)) ([2942626](https://github.com/simshanith/lit-ui-router/commit/2942626418d22e47ae11dc59d9dd3f2a6a82f794))
* **ui-router-otel:** add a private package that reports transitions as OpenTelemetry spans ([#2104](https://github.com/simshanith/lit-ui-router/issues/2104)) ([574cbd0](https://github.com/simshanith/lit-ui-router/commit/574cbd0478cd0c765a5f590368eea58e41a76543))
* **ui-router-otel:** make transition hooks and lazy loads active spans ([#2206](https://github.com/simshanith/lit-ui-router/issues/2206)) ([d8b74ac](https://github.com/simshanith/lit-ui-router/commit/d8b74ac59e4b59f1fd6a32ebd7bb954ca85f8860))
* **ui-router-otel:** wire the package into the release pipeline ([#2357](https://github.com/simshanith/lit-ui-router/issues/2357))

### Code Refactoring

* **ui-router-otel:** move transition attributes under uirouter.transition.* ([#2353](https://github.com/simshanith/lit-ui-router/issues/2353)) ([b0ab89b](https://github.com/simshanith/lit-ui-router/commit/b0ab89b19d288c3962873f5ad6102d0f7a97fbc3))

### Documentation

* **ui-router-otel:** say how to send spans to other trace viewers ([#2217](https://github.com/simshanith/lit-ui-router/issues/2217)) ([667e630](https://github.com/simshanith/lit-ui-router/commit/667e63044dfa910c243b3b77f4657ee4532c7566)), references [#2223](https://github.com/simshanith/lit-ui-router/issues/2223)

[Release page](https://lit-ui-router.dev/releases/ui-router-otel/0.1.0/)
