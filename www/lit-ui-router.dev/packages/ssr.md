---
title: Static Prerendering
description: A ui-router-server mount table in, an emitted static site out, with lit-ui-router-ssr
---

# lit-ui-router-ssr

<p class="badges">
<a href="https://npmx.dev/package/lit-ui-router-ssr" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/lit-ui-router-ssr" /></a>
<a href="https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router-ssr" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router-ssr@*" /></a>
</p>

[`lit-ui-router-ssr`](https://npmx.dev/package/lit-ui-router-ssr) turns a
[`ui-router-server`](/packages/server) mount table into an emitted static
site. `prerender()` asks the table for a verdict per path and makes each one
an artefact: a shell verdict becomes `<subpath>/index.html`, a redirect
becomes a host rules line and no page, and the mount's `otherwise` projection
becomes the 404 document.

The render itself is why the package exists. It owns the `@lit-labs/ssr` call
and the router hand-off — `provideRouter` on the render root, `withRouterSync`
around the render — so a consumer never imports the pre-1.0 renderer or
re-derives the incantation, and a template's `<ui-router>` descendants and its
`srefHref` attribute directives both read the same router.

::: warning Release candidate
The package publishes on a `0.1.0-rc` line, under the `rc` dist-tag, while
[the atlas](https://atlas.lit-ui-router.dev) adopts it as its first consumer.
The API below is live and covered by tests; the surface freezes at `0.1.0`
once that adoption has exercised it.
:::

## Installation

```bash
npm install lit-ui-router-ssr@rc
# or
pnpm add lit-ui-router-ssr@rc
```

`lit-ui-router`, `ui-router-server`, `@lit-labs/ssr`, `lit`, and
`@uirouter/core` are peer dependencies.

## What this package owns

- **The render call.** `provideRouter(root, router)` once, then
  `withRouterSync(router, () => collectResultSync(render(template, { eventTargetStack: [root] })))`
  per page — the pairing the
  [Server-Side Routing guide](/guides/server-route-matching#the-router-on-the-server)
  derives by hand, applied for you.
- **The emit loop.** Verdict to file name, redirect to rules line, tally, and
  a warning for every path that matched nothing.
- **The host rules file.** `_redirects` by default, every generated line
  paired with and without a trailing slash. No SPA catch-all is ever written:
  one turns every 404 into a 200.

Path enumeration, the html document, `<title>`, and driving the router to each
path stay with the caller — `paths`, `document()`, and an async
`renderShell()` are the seams for them.

## Quick start

```ts
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

`renderShell` returns a template and this package renders it; return a string
and it is written as-is. `dryRun: true` plans everything and writes nothing.

## Verdict to artefact

| Verdict               | What is emitted                                                       |
| --------------------- | --------------------------------------------------------------------- |
| `shell`               | `<subpath>/index.html`, rendered through `renderShell` and `document` |
| `redirect`            | a rules line (`from to status`), no page                              |
| `notFound`            | nothing, and the path is listed in `result.warnings`                  |
| the `otherwise` probe | the 404 document, `404.html` by default, rendered like any shell      |

[`PrerenderResult`](/api/lit-ui-router-ssr/interfaces/PrerenderResult) carries
all of it: `pages` lists every artefact in enumeration order, `rules` every
line the host file carries, `tally` the counts by kind, `warnings` the paths
that matched no route and had no projection to fall back on, and `root` the
render's event target.

## Where files land

Files go through `node:fs`, imported lazily on first write, so the specifier
never enters the static module graph. Pass
[`write`](/api/lit-ui-router-ssr/type-aliases/FileWriter) to emit into memory
or a virtual fs instead — it receives `outDir` already joined on.

The rules file follows the same seam: `rules: '_redirects'` (the default)
writes the Cloudflare Pages / Netlify file, `'none'` writes nothing and leaves
`result.rules` to you, and a function receives the lines and writes whatever
your host reads.

## One render at a time

`withRouterSync` is a module slot, so renders run sequentially — there is
nothing to parallelise. The uninstall from `provideRouter` runs in a `finally`,
so a throwing render leaves no listener behind.

The render root is yours if you want it: pass `root` and `prerender` provides
the router on that target, so you can attach context providers of your own
before the call. It comes back on the result either way.

## Development and production builds

Like `lit-ui-router`, this package ships two builds and bundlers pick between
them through the `development` export condition — see
[Development & Production Builds](/guides/development-builds) for the
mechanism.

One warning exists here: a path that verdicts `notFound` with no `otherwise`
projection to fall back on logs a console warning naming that path, because
nothing was emitted for it. `result.warnings` carries the same list in both
builds.

## Further reading

- [API reference](/api/lit-ui-router-ssr/)
- [Server-Side Routing guide](/guides/server-route-matching) — the verdicts
  this consumes, and the router hand-off it performs
- [`ui-router-server`](/packages/server) — the mount table and its verdicts
- [View fallback content](/guides/view-fallback-content#prerendered-shells-and-server-rendering) —
  what a `<ui-view>` renders in a prerendered shell
