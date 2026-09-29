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

Path enumeration, the html document, and `<title>` stay with the caller —
`paths`, `document()`, and an async `renderShell()` are the seams for them.
[`settle()`](#settling-the-router-on-each-path) drives the router to each path
inside `renderShell()`.

## Quick start

```ts
import { prerender, settle } from 'lit-ui-router-ssr';

const result = await prerender({
  mounts,
  router,
  outDir: 'dist',
  paths: ['/', '/sheet/7B', '/legacy'],
  extraRules: [{ from: '/megacanvas', to: '/megacanvas.html', status: 301 }],
  renderShell: async (_verdict, { path }) => {
    await settle(router, path);
    return page();
  },
  document: (body, { path }) => fillShell(titles.get(path), body),
});

console.log(result.tally); // { shell: 2, redirect: 1, notFound: 0, document: 1 }
```

`renderShell` returns a template and this package renders it; return a string
and it is written as-is. `dryRun: true` plans everything and writes nothing.

## Settling the router on each path

A server render reads the router only once its transition has landed,
resolves included.
[`settle(router, path)`](/api/lit-ui-router-ssr/functions/settle) sets the
url, syncs the router to it, and resolves with the transition that landed, so
the synchronous render after it reads every resolve. A `redirectTo` chain
settles on its final state, and a path the router already stands on resolves
at once.

A page fails to land in three ways, and each rejects rather than hangs:

- **No rule matches.** A url no state claims, on a router with no `otherwise`
  rule, rejects with an `Error` naming it. An `otherwise` rule is itself a
  match and settles on its state.
- **A resolve fails.** The promise rejects with an `Error` whose `cause` is
  the transition's `Rejection`, the resolve's error in its `detail`. Core's
  `defaultErrorHandler` still logs it.
- **Nothing lands in time.**
  [`timeout`](/api/lit-ui-router-ssr/interfaces/SettleOptions) bounds the
  wait, `10_000` ms by default; `0` waits without a limit.

`settle()` never calls `router.start()`, which runs once per router: it drives
`urlService` directly, so a page loop calls it once per path on the same
router, started or not.

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

## Static hosts add a trailing slash

A shell page lands at `<subpath>/index.html`. Cloudflare Pages, Netlify, and
S3-style hosts serve that file for `/sheet/7B` by answering 308 onto
`/sheet/7B/`, so the client boots at the slashed url. `@uirouter/core`'s
default
[`strictMode`](https://ui-router.github.io/core/docs/latest/interfaces/_url_interface_.urlmatcherconfig.html)
refuses the trailing slash, and the app boots into its not-found state over
the correct prerendered page. A host with directory-index redirects makes the
pairing mandatory — relax both sides:

```ts
// the browser router
router.urlService.config.strictMode(false);

// the mount prerender() resolves against
const mounts = { '/': { routes, config: { strict: false } } };
```

The mount half holds at build time too: `prerender()` takes every verdict
from it, and the live server answers from the same table. A preview server
such as `vite preview` serves the file without the redirect, so only the
deployed site shows the failure. The development build warns once when the
first page's slashed spelling does not resolve to the same shell.

## One render at a time

`withRouterSync` is a module slot, so renders run sequentially — there is
nothing to parallelise. The uninstall from `provideRouter` runs in a `finally`,
so a throwing render leaves no listener behind.

The render root is yours if you want it: pass `root` and `prerender` provides
the router on that target, so you can attach context providers of your own
before the call. It comes back on the result either way.

## Property bindings on the server

Take a card that receives a post by property and draws it in its own
`render()`:

```ts
import { html, LitElement } from 'lit';

type Post = { title: string; summary: string };

class XCard extends LitElement {
  static properties = { post: { attribute: false } };
  declare post: Post;
  render() {
    return html`<h2>${this.post.title}</h2>
      <p>${this.post.summary}</p>`;
  }
}
customElements.define('x-card', XCard);
```

A routed template that feeds it by property,
`` html`<x-card .post=${post}></x-card>` ``, serves the card empty:

```text
<!--lit-part vYJeArn6Pos=--><!--lit-node 0--><x-card  defer-hydration></x-card><!--/lit-part-->
```

`@lit-labs/ssr` writes a `.prop=${…}` binding as its part marker and nothing
else — no attribute, no child, no value. Setting the property is an element
renderer's job, and
[`elementRenderers`](/api/lit-ui-router-ssr/interfaces/PrerenderOptions#elementrenderers)
defaults to `[UiViewRenderer]`, which answers for `ui-view` alone. The card has
no renderer, so nothing on the server sets `post` or runs its `render()`: the
card first draws on the client, once hydration sets the property, and the
served page shows an empty tag where it stands.

Anything the served page has to show arrives as an attribute, as children, or
through a renderer for the element. The shape that keeps one template on both
sides writes the content as the card's children, binds the property over it,
and lets the card project them through a `<slot>`:

```ts
class XCard extends LitElement {
  static properties = { post: { attribute: false } };
  declare post: Post;
  render() {
    return html`<slot></slot>`;
  }
}

const card = (post: Post) =>
  html`<x-card .post=${post}>
    <h2>${post.title}</h2>
    <p>${post.summary}</p>
  </x-card>`;
```

The server emits the children, the `hydrate()` walk described under
[The hydration model](#the-hydration-model) adopts them as the same child part
and sets `post`, and the card keeps the data for its behaviour while the
template owns what shows.

Write the children on both sides. A branch on `isServer` that writes them on
the server alone looks like a way to serve the content without drawing it
twice:

```ts
import { html, isServer } from 'lit';

// ❌ two templates: the client cannot adopt what the server drew
const card = (post: Post) =>
  isServer
    ? html`<x-card .post=${post}>
        <h2>${post.title}</h2>
        <p>${post.summary}</p>
      </x-card>`
    : html`<x-card .post=${post}></x-card>`;
```

The served page carries the children, under a part marker that names the
template that drew them:

```text
<!--lit-part EdxohtX2HMw=--><!--lit-node 0--><x-card  defer-hydration><h2><!--lit-part-->Hello<!--/lit-part--></h2><p><!--lit-part-->A first post.<!--/lit-part--></p></x-card><!--/lit-part-->
```

On the client `isServer` is false, so the enclosing `ui-view` hydrates the
second template, whose own marker would read `vYJeArn6Pos=`, against that one.
The digests differ, `hydrate()` throws on the mismatch, and the view drops
everything the server drew inside it and renders cold. The served card and its
children go, the client draws the empty card in their place, and in development
the console warns that the element could not adopt the server render.

The other answer is a renderer for the card. `LitElementRenderer` from
`@lit-labs/ssr`, passed beside `UiViewRenderer`, sets the property on the
server and draws the card's `render()` into a declarative shadow root:

```ts
import { LitElementRenderer } from '@lit-labs/ssr';
import { prerender, UiViewRenderer } from 'lit-ui-router-ssr';

await prerender({
  // …
  elementRenderers: [UiViewRenderer, LitElementRenderer],
});
```

With the first card, the one that draws `post` in its own `render()`, the
same property binding now serves the card filled:

```text
<!--lit-part vYJeArn6Pos=--><!--lit-node 0--><x-card  defer-hydration><template shadowroot="open" shadowrootmode="open"><!--lit-part HdSxZ92CImA=--><h2><!--lit-part-->Hello<!--/lit-part--></h2><p><!--lit-part-->A first post.<!--/lit-part--></p><!--/lit-part--></template></x-card><!--/lit-part-->
```

The children stay where the card's `render()` put them, in a shadow root the
browser attaches as it parses, and hydration adopts them there.
`LitElementRenderer` does the same for every `LitElement` on the page,
whether or not it has anything to show on the server, which is the cost the
default avoids.

## Development and production builds

Like `lit-ui-router`, this package ships two builds and bundlers pick between
them through the `development` export condition — see
[Development & Production Builds](/guides/development-builds) for the
mechanism.

Two warnings come from `prerender()`. A path that verdicts `notFound` with no
`otherwise` projection to fall back on logs a console warning naming that
path, because nothing was emitted for it; `result.warnings` carries the same
list in both builds. A mount that refuses the first page's trailing-slash
spelling logs one warning naming that page — see
[Static hosts add a trailing slash](#static-hosts-add-a-trailing-slash).

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
to core's `UiView`. Every value the app takes from the router — `UIRouterLit`,
`srefHref`, `srefActiveClass`, `srefAriaCurrent` — comes from
`lit-ui-router/pure`, which registers nothing; the root entry registers the
plain `<ui-view>` as a side effect, and imported after this one it warns that
the tag is already defined. Then the router boots and one call adopts the page:

```ts
import 'lit-ui-router-ssr/register';
import { UIRouterLit, srefHref } from 'lit-ui-router/pure';
import { hydrateRoot } from 'lit-ui-router-ssr/client';

router.start();
await booted; // the first successful transition
const release = hydrateRoot(root, page(router));
```

A `<ui-view>` another class already defined throws, naming both ways out.

The build-time entry that calls `prerender()` imports
`lit-ui-router-ssr/register` too, after the DOM shim and before the views.
[`UiViewRenderer`](/api/lit-ui-router-ssr/classes/UiViewRenderer) draws the
served class, and a `<ui-view>` nothing defined on the server renders as an
inert element with an empty part pair — no error, and every page's body
missing.

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

A served `<ui-view>` — the class `lit-ui-router-ssr/register` defines the tag
with — arrives asleep. The render passes `deferHydration`, so
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
[`adoptUiViewContext`](/api/lit-ui-router-ssr/variables/adoptUiViewContext)
over the standard `context-request` event and hands itself to whichever provider
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
Lit's `defer-hydration` contract unchanged. All of it is in this package:
`lit-ui-router-ssr/register` defines `<ui-view>` with the served class, so an
app that never prerenders carries none of it.

## Further reading

- [API reference](/api/lit-ui-router-ssr/)
- [Server-Side Routing guide](/guides/server-route-matching) — the verdicts
  this consumes, and the router hand-off it performs
- [`ui-router-server`](/packages/server) — the mount table and its verdicts
- [View fallback content](/guides/view-fallback-content#prerendered-shells-and-server-rendering) —
  what a `<ui-view>` renders in a prerendered shell
