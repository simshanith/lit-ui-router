# lit-ui-router-ssr

[![npm version](https://img.shields.io/npm/v/lit-ui-router-ssr.svg)](https://npmx.dev/package/lit-ui-router-ssr)
[![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router-ssr@*)](https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router-ssr)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Flit-ui-router.dev)](https://lit-ui-router.dev/packages/ssr)
[![codecov](https://codecov.io/gh/simshanith/lit-ui-router/graph/badge.svg?component=lit-ui-router-ssr)](https://app.codecov.io/gh/simshanith/lit-ui-router?components%5B0%5D=lit-ui-router-ssr)

Static prerendering for [lit-ui-router](https://lit-ui-router.dev): a
[`ui-router-server`](https://lit-ui-router.dev/packages/server) mount table in, an emitted site out.

`prerender()` asks the mount table for a verdict per path and turns each one into an artefact: a
shell verdict becomes `<subpath>/index.html`, a redirect becomes a host rules line and no page, and
the mount's `otherwise` projection becomes the 404 document. The render itself is the reason the
package exists — it owns the `@lit-labs/ssr` call and the router hand-off, so a consumer never
imports the pre-1.0 renderer or re-derives the incantation.

## What this package owns

- **The render call.** `provideRouter(root, router)` once, then
  `withRouterSync(router, () => collectResultSync(render(template, { eventTargetStack: [root] })))`
  per page — so a template's `<ui-router>` descendants answer `context-request` and its `srefHref`
  attribute directives emit real hrefs.
- **The emit loop.** Verdict to file name, redirect to rules line, tally, warnings for paths that
  matched nothing.
- **The host rules file.** `_redirects` by default, every generated line paired with and without a
  trailing slash. No SPA catch-all is ever written: one turns every 404 into a 200.

Path enumeration, the html document, `<title>`, and driving the router to each path stay with the
caller — `paths`, `document()`, and an async `renderShell()` are the seams for them.

## Installation

```bash
npm install lit-ui-router-ssr
# or
pnpm add lit-ui-router-ssr
# or
yarn add lit-ui-router-ssr
```

`lit-ui-router`, `ui-router-server`, `@lit-labs/ssr`, `lit`, and `@uirouter/core` are peer
dependencies.

## Quick Start

```typescript
import { prerender } from 'lit-ui-router-ssr';

const result = await prerender({
  mounts,
  router,
  outDir: 'dist',
  paths: ['/', '/sheet/7B', '/legacy'],
  extraRules: [{ from: '/megacanvas', to: '/megacanvas.html', status: 301 }],
  renderShell: async (_verdict, { path }) => {
    await goTo(router, path);
    return page();
  },
  document: (body, { path }) => fillShell(titles.get(path), body),
});

console.log(result.tally); // { shell: 2, redirect: 1, notFound: 0, document: 1 }
```

`result.pages` lists every artefact in enumeration order, `result.rules` every line the host file
carries, and `result.warnings` the paths that matched no route and had no projection to fall back
on. `dryRun: true` plans all of it and writes nothing.

Files land through `node:fs`, imported lazily on first write; pass `write` to emit into memory or a
virtual fs instead.

## Documentation

- [Guide](https://lit-ui-router.dev/packages/ssr)
- [API reference](https://lit-ui-router.dev/api/lit-ui-router-ssr/)

## License

MIT
