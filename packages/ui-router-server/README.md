# ui-router-server

[![npm version](https://img.shields.io/npm/v/ui-router-server.svg)](https://npmx.dev/package/ui-router-server)
[![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-server@*)](https://github.com/simshanith/lit-ui-router/releases/?q=ui-router-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![codecov](https://codecov.io/gh/simshanith/lit-ui-router/graph/badge.svg?component=ui-router-server)](https://app.codecov.io/gh/simshanith/lit-ui-router?components%5B0%5D=ui-router-server)

Server-side routing for ui-router state trees. Given per-mount routing config and a request URL, it resolves the path against the registered states and returns a plain routing verdict (render, redirect, or miss) — runtime-agnostic, with no fetch/Response or workers types in the core. Adapters turn verdicts into HTTP for Connect/Vite middleware and fetch/Hono handlers. Matcher-only mounts are dependency-free; `simulate` mounts lazily replay the path through a headless `@uirouter/core` router (an optional peer dependency).

**Status: early `0.x`** — published to npm and dogfooded in production by
[lit-ui-router.dev](https://lit-ui-router.dev), but young: the API is covered
by tests and can still move in a minor release before `1.0`, so pin what you
install.

```bash
npm install ui-router-server
```

`@uirouter/core` (only for `simulate` mounts) and `hono` are optional peer
dependencies. Full docs:
[lit-ui-router.dev/packages/server](https://lit-ui-router.dev/packages/server).

## Attribution

URL-matching logic (`src/url-matcher.ts`) is derived from [@uirouter/core](https://github.com/ui-router/core) (MIT) — see [LICENSE](./LICENSE).
