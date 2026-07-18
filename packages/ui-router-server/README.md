# ui-router-server

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Server-side routing for ui-router state trees. Given per-mount routing config and a request URL, it resolves the path against the registered states and returns a plain routing verdict (render, redirect, or miss) — runtime-agnostic, with no fetch/Response or workers types in the core. Adapters turn verdicts into HTTP for Connect/Vite middleware and fetch/Hono handlers. Matcher-only mounts are dependency-free; `simulate` mounts lazily replay the path through a headless `@uirouter/core` router (an optional peer dependency).

**Status: unreleased** — this package has not been published to npm yet.

## Attribution

URL-matching logic (`src/url-matcher.ts`) is derived from [@uirouter/core](https://github.com/ui-router/core) (MIT) — see [LICENSE](./LICENSE).
