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

## Registering the elements

A prerendered page needs the served `<ui-view>`, and `lit-ui-router-ssr/register`
is the one import that defines it. Three shapes cover every app.

### A cold app

It imports `lit-ui-router` and changes nothing. It never draws a document on the
server, so it never needs this package on the client.

### A prerendered app

It imports `lit-ui-router-ssr/register` in place of `lit-ui-router`, ahead of
anything else that registers `<ui-view>`. That entry defines `<ui-router>` from
core and `<ui-view>` with
[`withServedRender`](/api/lit-ui-router-ssr/functions/withServedRender) applied
to core's `UiView`. Then the router boots and one call adopts the page:

```ts
import 'lit-ui-router-ssr/register';
import { hydrateRoot } from 'lit-ui-router-ssr/client';

router.start();
await booted; // the first successful transition
const release = hydrateRoot(root, page(router));
```

A `<ui-view>` another class already defined throws, naming both ways out.

### An app with its own registry

It imports `lit-ui-router/pure`, which registers nothing, and defines the served
class under a tag of its own:

```ts
import { UiView } from 'lit-ui-router/pure';
import { withServedRender } from 'lit-ui-router-ssr/client';

customElements.define('app-view', withServedRender(UiView));
```

The result extends core's `UiView`, so an enclosing view adopts it as a parent.
`UiViewRenderer` answers for the `ui-view` tag, so a tag of your own needs a
renderer of your own.

[`lit-ui-router-effect`](/packages/effect) from 0.1.1 and
[`lit-ui-router-mobx`](/packages/mobx) from 1.0.2 import `lit-ui-router/pure`,
so they register nothing and compose with any of the three.

## The hydration model

A served `<ui-view>` arrives asleep. The render passes `deferHydration`, so
every custom element on the page carries Lit's `defer-hydration` attribute,
and while it is there the view renders nothing and holds the nodes the server
drew. The client boots the router first, then calls
[`hydrateRoot`](/api/lit-ui-router-ssr/functions/hydrateRoot), which provides
an adopter under the container with core's
[`provideContext`](/api/reference/core/provideContext) and runs one
`hydrate()` walk over it:

```ts
import { hydrateRoot } from 'lit-ui-router-ssr/client';

const release = hydrateRoot(root, page(router));
```

Every [`uiViewSlot`](/api/lit-ui-router-ssr/variables/uiViewSlot) that walk
reaches wakes the `<ui-view>` it sits in, and the waking view requests
[`adoptUiViewContext`](/api/reference/core/adoptUiViewContext) over the
standard `context-request` event and hands itself to whichever provider
answers. The mechanics — the boot sequence, the marker protocol, and what a
view with no provider above it does — are in the
[API reference](/api/lit-ui-router-ssr/) and in
[the package README](https://github.com/simshanith/lit-ui-router/blob/main/packages/lit-ui-router-ssr/README.md#the-client-half).

## How this compares

Two axes separate the hydration models in circulation: where the code that
wakes the markup comes from — imported from the renderer, or provided from
outside it — and how much it wakes at once, the whole tree or one boundary on
demand.

| Model                     | Where the wake code comes from                                                                         | Scope        | Shipped by the framework |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | ------------ | ------------------------ |
| Whole tree, in-renderer   | imported from the renderer — React `hydrateRoot()`, Vue `createSSRApp().mount()`, Solid `hydrate()`    | the page     | yes                      |
| Whole tree, provided      | a provider or a global patch — Angular `provideClientHydration()`, Lit's `lit-element-hydrate-support` | the page     | opt-in                   |
| Per boundary, in-renderer | the renderer schedules it — React Suspense selective hydration, Nuxt `<NuxtIsland>`                    | one boundary | yes                      |
| Per boundary, provided    | a directive or a context provider — Astro `client:*`, Angular `@defer (hydrate on …)`, this package    | one boundary | opt-in                   |

Solid pairs its walk with `data-hk` hydration keys in the markup; Angular's
provider arrives through DI, while Lit's own `@lit-labs/ssr-client` support is
a patch of `LitElement`'s prototype — opt-in, but global once imported. Astro
sits at the far end of the provided column: the island's `client:*` directive
is the whole contract, and the framework inside the island never sees it.

Qwik is the outlier on both axes. It resumes rather than hydrates, so there is
no wake pass at all: the served markup and the serialized state both survive
into the client, and a handler is fetched when its event fires. This package
keeps only the markup; the router rebuilds its state on the first transition,
which is what booting before `hydrateRoot()` waits for.

In that grid `lit-ui-router-ssr` sits in the per-boundary, provided cell. Each
`<ui-view>` is an island whose trigger is a route match rather than viewport
or idle. The code that wakes it is provided, not imported, so any
`context-request` provider — an `@lit/context` provider, a test harness, a
nested app — can scope or replace the adopter, and the element side reuses
Lit's `defer-hydration` contract unchanged. `lit-ui-router` carries the gated
sleep and wake and one context key; everything else is in this package.

## Further reading

- [API reference](/api/lit-ui-router-ssr/)
- [Server-Side Routing guide](/guides/server-route-matching) — the verdicts
  this consumes, and the router hand-off it performs
- [`ui-router-server`](/packages/server) — the mount table and its verdicts
- [View fallback content](/guides/view-fallback-content#prerendered-shells-and-server-rendering) —
  what a `<ui-view>` renders in a prerendered shell
