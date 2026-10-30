---
title: Static Prerendering
description: A ui-router-server mount table in, an emitted static site out, with lit-ui-router-ssr
---

# lit-ui-router-ssr

<p class="badges">
<a href="https://npmx.dev/package/lit-ui-router-ssr" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/lit-ui-router-ssr" /></a>
<a href="https://lit-ui-router.dev/gh/releases/lit-ui-router-ssr/latest" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router-ssr@*" /></a>
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

## Installation

```bash
npm install lit-ui-router-ssr
```

`lit-ui-router`, `ui-router-server`, `@lit-labs/ssr`, `@lit-labs/ssr-client`, `lit`,
and `@uirouter/core` are peer dependencies. `@lit-labs/ssr` is the server half
and `@lit-labs/ssr-client` the client half, so a bundle takes one or the other,
never both. `@lit-labs/ssr-client` is optional: install it when you import
`lit-ui-router-ssr/client`.

The `lit-ui-router` peer is `^1.19.0`: the server renders a view through the
helper `<ui-view>` renders through, and the client hands a served class element
to the view it wakes.

## What this package owns

- **The render call.** `provideRouter(root, router)` once, then
  `withRouterSync(router, () => collectResultSync(render(template, { eventTargetStack: [root] })))`
  per page — the pairing the
  [Server-Side Routing guide](/guides/server-route-matching#the-router-on-the-server)
  derives by hand, applied for you.
- **The lit render inside the emit loop.** The loop itself — verdict to file
  name, redirect to rules line, the `_redirects` file, delegating states
  skipped, tally, and a warning for every path that matched nothing — is
  [`prerender`](/packages/server#emitting-a-static-site) from
  `ui-router-server/prerender`, which takes any render. This package's `prerender`
  supplies the lit one and takes the same options, plus `router`,
  `renderShell`, `document`, `root`, `elementRenderers`, `payload` and
  `responses`. No SPA catch-all is ever written: one turns every 404 into a 200.
- **Response states after settle.** [`responder`](#response-states) runs
  the handler bound to a response state's name with the resolves its
  transition landed with.

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

console.log(result.tally); // { shell: 2, redirect: 1, notFound: 0, delegate: 0, document: 1 }
```

`renderShell` returns a template and this package renders it; return a string
and it is written as-is. `dryRun: true` plans everything and writes nothing.

## Settling the router on each path

A server render reads the router only once its transition has landed,
resolves included.
[`settle(router, path)`](/api/ui-router-server/ssr/functions/settle), the
[`ui-router-server/ssr`](/packages/server#settling-a-server-router) step this
package re-exports, sets the url, syncs the router to it, and resolves with the
transition that landed, so the synchronous render after it reads every resolve.
A `redirectTo` chain settles on its final state, and a path the router already
stands on resolves at once.

A page fails to land in four ways, and each rejects rather than hangs:

- **No rule matches.** A url no state claims, on a router with no `otherwise`
  rule, rejects with an `Error` naming it. An `otherwise` rule is itself a
  match and settles on its state.
- **A resolve fails.** The promise rejects with an `Error` whose `cause` is
  the transition's `Rejection`, the resolve's error in its `detail`. Core's
  `defaultErrorHandler` still logs it.
- **Nothing lands in time.**
  [`timeout`](/api/ui-router-server/ssr/interfaces/SettleOptions) bounds the
  wait, `10_000` ms by default; `0` waits without a limit.
- **The url keeps rewriting.** `maxRewrites` bounds a chain of url rules that
  rewrite the url to another url, `10` by default.

`settle()` never calls `router.start()`, which runs once per router: it drives
`urlService` directly, so a page loop calls it once per path on the same
router, started or not.

## Adopting the resolves on boot

The [`payload`](/api/lit-ui-router-ssr/index/interfaces/PrerenderOptions#payload) option
hands each rendered page's landed transition to a hook, which returns the
resolve payload to write.
[`dehydrate`](/api/ui-router-server/ssr/functions/dehydrate) from
`ui-router-server/ssr` draws one, and the hook decides what to do with the
resolves it leaves out:

```ts
import { prerender } from 'lit-ui-router-ssr';
import { dehydrate } from 'ui-router-server/ssr';

await prerender({
  // mounts, router, paths, renderShell, …
  payload: (transition, { path }) => {
    const { payload, unserializable } = dehydrate(transition);

    for (const { state, token } of unserializable)
      console.warn(`${path}: ${state}.${token} re-runs on the client`);

    return payload;
  },
});
```

The payload's `resolves` go into the page's
[hydration signature](#the-hydration-model), beside `version`, `state` and
`params`, so the one block is the payload. `bootstrap` seeds the boot
transition from it before the router starts: each resolve the page was drawn
with adopts its value in place of running its function. Every other resolve
runs as it would without one: a value `dehydrate` left out, a `NOWAIT`
resolve, every resolve of a boot that lands on another state or other
parameters, and every resolve of a page whose block carries no `resolves`.
Without the hook no page carries resolves. What `dehydrate` draws, and which
values it leaves out, is in
[Handing resolves to the client](/packages/server#handing-resolves-to-the-client).

## Verdict to artefact

| Verdict               | What is emitted                                                       |
| --------------------- | --------------------------------------------------------------------- |
| `shell`               | `<subpath>/index.html`, rendered through `renderShell` and `document` |
| `redirect`            | a rules line (`from to status`), no page                              |
| `notFound`            | nothing, and the path is listed in `result.warnings`                  |
| `delegate`            | nothing: the path is listed in `result.delegated` for a host handler  |
| `response`            | the handler's 2xx body at its url, or its 3xx as a rules line         |
| the `otherwise` probe | the 404 document, `404.html` by default, rendered like any shell      |

[`PrerenderResult`](/api/lit-ui-router-ssr/index/interfaces/PrerenderResult) carries
all of it: `pages` lists every artefact in enumeration order, `rules` every
line the host file carries, `tally` the counts by kind, `warnings` the paths
that matched no route and had no projection to fall back on, `delegated` the
paths a delegating state's host handler answers, and `root` the render's event
target.

`delegated` gets no page and no rules line, so the host must send those paths
to the server. On Cloudflare Workers, list them in
[`assets.run_worker_first`](/packages/server#emitting-a-static-site) so the
Worker sees them before static assets do.

## Response states

A [response state](/packages/server#response-states) answers with a `Response`
built from its resolves instead of a page. `responder(router, responses)`
serves one: it settles `router` on the verdict's subpath, the request's query
included, runs the handler bound to the landed state's name with that
transition's resolves (inherited ones included) and the request, and returns
the `Response` as the handler built it. A HEAD gets it without its body. A
resolve that throws rejects before any handler runs, as `settle` rejects for
a page.

```ts
import { responder, type ResponseHandlers } from 'lit-ui-router-ssr';

const responses = {
  badge: ({ resolves }) =>
    new Response(resolves.svg, {
      headers: { 'Content-Type': 'image/svg+xml' },
    }),
} satisfies ResponseHandlers<
  (typeof routes)[number],
  { badge: { svg: string } }
>;

const handler = createFetchHandler(router, {
  serveShell,
  serveResponse: (verdict, request) =>
    responder(pageRouter(), responses)(verdict, request),
});
```

`prerender` takes the same handlers as `responses`: a path that matches a
response state is written as its handler's 2xx body at the path its url
spells, or its 3xx as a rules line. The handler's request is a GET for the
path at `origin`. It defaults to `http://lit-ui-router-ssr`, a host that names
the package, so a url built from it stands out in the output. A handler that
answers with paths needs none; pass the site's own origin when a handler builds
absolute urls from `request.url`.

## Where files land

Files go through `node:fs`, imported lazily on first write, so the specifier
never enters the static module graph. Pass
[`write`](/api/lit-ui-router-ssr/index/type-aliases/FileWriter) to emit into memory
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

[The Altitude Atlas](https://atlas.lit-ui-router.dev), where `/sheet/7B` comes
from, runs both halves on Cloudflare Pages: its client sets `strictMode(false)`
and its mount compiles `strict: false`.

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
[`elementRenderers`](/api/lit-ui-router-ssr/index/interfaces/PrerenderOptions#elementrenderers)
defaults to `[UiViewRenderer, LightElementRenderer]`, which answer for
`ui-view` and for opted-in [light-DOM elements](#light-dom-elements) alone. The
card has no renderer, so nothing on the server sets `post` or runs its `render()`: the
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
import {
  LightElementRenderer,
  prerender,
  UiViewRenderer,
} from 'lit-ui-router-ssr';

await prerender({
  // …
  // The list replaces the default; LightElementRenderer stays ahead of the shadow-root renderer.
  elementRenderers: [UiViewRenderer, LightElementRenderer, LitElementRenderer],
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

Three warnings come from `prerender()`. The first two come from the
`ui-router-server/prerender` loop, prefixed `ui-router-server: prerender:`, and
follow that package's build. A path that verdicts `notFound` with
no `otherwise` projection to fall back on logs a console warning naming that
path, because nothing was emitted for it; `result.warnings` carries the same
list in both builds. A mount that refuses the first page's trailing-slash
spelling logs one warning naming that page — see
[Static hosts add a trailing slash](#static-hosts-add-a-trailing-slash). A
registry that holds no `<ui-view>` when the call starts logs one warning,
because every view on those pages would render empty. Plain `node` resolves
the production build; `node --conditions=development` resolves this one.

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
[`withServedRender`](/api/lit-ui-router-ssr/client/functions/withServedRender) applied
to core's `UiView`. Every value the app takes from the router — `UIRouterLit`,
`srefHref`, `srefActiveClass`, `srefAriaCurrent` — comes from
`lit-ui-router/pure`, which registers nothing; the root entry registers the
plain `<ui-view>` as a side effect, and imported after this one it warns that
the tag is already defined. Then one call boots the router and adopts the page:

```ts
import 'lit-ui-router-ssr/register';
import { UIRouterLit, srefHref } from 'lit-ui-router/pure';
import { bootstrap } from 'lit-ui-router-ssr/client';

await bootstrap(router, root, page(router));
```

A `<ui-view>` another class already defined throws, naming both ways out.

The build-time entry that calls `prerender()` imports
`lit-ui-router-ssr/register` too, once the DOM shim has finished installing.
The shim module awaits at its top level, so a static import beside it evaluates
first: lit's Node build installs a registry of its own, the elements are defined
there, and the shim then replaces `globalThis.customElements` with an empty one.
Import the shim statically and everything that defines or reaches an element by
dynamic import:

```ts
import '@lit-labs/ssr/lib/install-global-dom-shim.js';

await import('lit-ui-router-ssr/register');
const { UIRouterLit } = await import('lit-ui-router/pure');
const { prerender, settle } = await import('lit-ui-router-ssr');
const { page } = await import('./views.js');
```

The atlas's
[`app/prerender.ts`](https://github.com/simshanith/lit-ui-router/blob/www/atlas/www/atlas.lit-ui-router.dev/app/prerender.ts)
is a complete entry in this shape.

Preloading the shim with
`node --import @lit-labs/ssr/lib/install-global-dom-shim.js` finishes it before
the entry's graph starts, so static imports hold there too.
[`UiViewRenderer`](/api/lit-ui-router-ssr/index/classes/UiViewRenderer) draws the
served class, and a `<ui-view>` nothing defined on the server renders as an
inert element with an empty part pair — no error, and every page's body
missing. In development `prerender()` warns when the registry holds no
`<ui-view>`.

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

[`lit-ui-router-effect`](/packages/lit-ui-router-effect) from 0.1.1 and
[`lit-ui-router-mobx`](/packages/lit-ui-router-mobx) from 1.0.2 import `lit-ui-router/pure`,
so they register nothing and compose with any of the three.

## The hydration model

A served `<ui-view>` — the class `lit-ui-router-ssr/register` defines the tag
with — arrives asleep. The render passes `deferHydration`, so
every custom element on the page carries Lit's `defer-hydration` attribute,
and while it is there the view renders nothing and holds the nodes the server
drew. One call boots the client:
[`bootstrap`](/api/lit-ui-router-ssr/client/functions/bootstrap) starts the
router, waits for the boot transition to land, then calls
[`hydrateRoot`](/api/lit-ui-router-ssr/client/functions/hydrateRoot), which provides
an adopter under the container with core's
[`provideContext`](/api/reference/core/provideContext) and runs one
`hydrate()` walk over it. It resolves once every awake view has updated:

```ts
import { bootstrap } from 'lit-ui-router-ssr/client';

const { outcome, signature } = await bootstrap(router, root, page(router));
```

`signature` is a
[`BootstrapSignature`](/api/lit-ui-router-ssr/client/type-aliases/BootstrapSignature):
`matched`, `elsewhere` or `absent`, comparing the state the boot landed on with
the one the document was drawn for.

The cold path is the same call: a container with nothing to adopt, a boot
transition that fails, and a walk that throws all end in a cold render. The
boot also decides mismatches once, against the state it landed on, rather than
once per view. A boot that lands elsewhere adopts the views that match; a view
whose state or url parameters differ from the drawn ones renders cold.

`prerender()` opens every page it renders from a template on a hydration
signature: a JSON data block ahead of the render, carrying this package's
version, the name of the state the router stood on, that state's url
parameter values, and the resolved values the
[`payload` hook](#adopting-the-resolves-on-boot) supplies.
It never executes, `hydrate()` walks comments only and reads past it, and every
`<` and `>` in it is written `\u003c` and `\u003e`, so no value can close it.

```text
<script type="application/json" data-lit-ui-router-ssr>{"version":"0.2.0","state":"sheet","params":{"num":"7B"}}</script>
```

`hydrateRoot` reads it before it touches the document, and returns `false`
over an emptied container when it finds nothing to adopt, so `bootstrap`, or the
caller's own `render()`, draws the page once:

- **No signature.** A cold client render, a dev server, a page from an earlier
  `prerender()`, or a page whose `renderShell` returned a string.
- **A signature from another release line.** Below 1.0 a minor breaks, so a
  document adopts only on the client's own minor; from 1.0, its own major.
  The development build warns, naming both versions.
- **A signature with no render marker after it.** A minifier that strips html
  comments keeps the block and drops the markers `hydrate()` reads. The
  development build warns.

A container `hydrateRoot` adopts keeps its block.

[`readHydrationSignature`](/api/lit-ui-router-ssr/client/functions/readHydrationSignature)
returns the parsed
[`HydrationSignature`](/api/lit-ui-router-ssr/client/interfaces/HydrationSignature),
or `null` when the container holds none or one that does not parse to an
object with a string `version`. Only `version` is typed, so a boot that compares
the state the document was drawn for with the one it booted into narrows
`state` and `params` first.

[`readResolvePayload`](/api/lit-ui-router-ssr/client/functions/readResolvePayload)
returns the block as a resolve payload, or `undefined` when it carries no
`resolves` or comes from another release line. A boot that calls `hydrateRoot`
itself hands it to `seed` before the router starts.

Every [`uiViewSlot`](/api/lit-ui-router-ssr/client/variables/uiViewSlot) that walk
reaches wakes the `<ui-view>` it sits in, and the waking view requests
[`adoptUiViewContext`](/api/lit-ui-router-ssr/client/variables/adoptUiViewContext)
over the standard `context-request` event and hands itself to whichever provider
answers. The mechanics — the boot sequence, the marker protocol, and what a
view with no provider above it does — are in the
[API reference](/api/lit-ui-router-ssr/) and in
[the package README](https://github.com/simshanith/lit-ui-router/blob/main/packages/lit-ui-router-ssr/README.md#the-client-half).

Each served view reports what its wake came to, once, parent first, in
production as in development. The view dispatches a bubbling, composed
[`ui-view:adopt`](/api/lit-ui-router-ssr/client/variables/uiViewAdoptEventName) event
whose [`detail`](/api/lit-ui-router-ssr/client/interfaces/UiViewAdoptDetail) carries
an [`AdoptOutcome`](/api/lit-ui-router-ssr/client/type-aliases/AdoptOutcome):
`adopted` when its served nodes are the live ones, `fell-back` when a mismatch
or a lost pair dropped them for a cold render, with the cause in `error`, and
`none` when there was nothing to adopt. The
[`onAdopt`](/api/lit-ui-router-ssr/client/interfaces/HydrateRootOptions) option of
`bootstrap` and `hydrateRoot` receives the same reports for every view the walk
reaches, so a consumer needs no listener:

```ts
await bootstrap(router, root, page(router), {
  onAdopt: (view, outcome, error) => {
    if (outcome === 'fell-back') report(view, error);
  },
});
```

### Routed class views

[`UiViewRenderer`](/api/lit-ui-router-ssr/index/classes/UiViewRenderer) draws a
view through `lit-ui-router`'s own render helper, the one `<ui-view>`'s
`render()` calls, so the served markup and the client's first render share one
source. A routed `LitElement` class, plain or `sticky`, prerenders too:
`lit-ui-router` builds the element and assigns its props, and
`LitElementRenderer` writes it, shadow root included, into the slot `<ui-view>`
places a class in. At the wake the served view hands that element to
`lit-ui-router`, which adopts it instead of building its own, so the element
the server wrote is the element the client keeps. A class that renders into its
own light DOM prerenders into it when it uses
[`LightDomHydrating`](#light-dom-elements), and hydrates those nodes in place.
Without it, the class is written as its bare element, with no shadow root to
hide its render, and renders on the client. A class must be on the
`customElements` registry to prerender.

The served `<ui-view>` markup is internal to this package and `lit-ui-router`
and changes with them. Post-processing of prerendered HTML keys on the
hydration signature block.

### Light-DOM elements

A consumer's own `LitElement` that renders into its light DOM opts in to the
same sleep-then-adopt cycle with
[`LightDomHydrating`](/api/lit-ui-router-ssr/client/functions/LightDomHydrating).
[`LightElementRenderer`](/api/lit-ui-router-ssr/index/classes/LightElementRenderer)
draws it on the server as one of `prerender()`'s default renderers, and
[`lightSlot`](/api/lit-ui-router-ssr/client/variables/lightSlot) marks the hole
at the use site:

```ts
import { html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { LightDomHydrating, lightSlot } from 'lit-ui-router-ssr/client';

export class AppCard extends LightDomHydrating(LitElement) {
  @property() label = '';

  render() {
    return html`<p>${this.label}</p>`;
  }
}

export const card = (label: string) =>
  html`<app-card .label=${label}>${lightSlot()}</app-card>`;
```

The mixin brands the class it returns, so a subclass stays opted in and the
base class does not; an element that did not opt in is served empty and renders
cold. The renderer builds the element as `LitElementRenderer` does, then writes
its `render()` where a shadow root would go, with custom elements inside it,
`<ui-view>` included, drawn too. An explicit `elementRenderers` replaces the
default, so keep it in that list, ahead of any `LitElementRenderer`.

`lightSlot` is `uiViewSlot` under a name that does not read as a view. On the
client it wakes the element, parent first, and the element hands itself to the
same adopter a view does, which hydrates its `render()` in place. Each opted-in
element reports a bubbling, composed
[`light-dom:adopt`](/api/lit-ui-router-ssr/client/variables/lightDomAdoptEventName)
event with the same detail as `ui-view:adopt`; `onAdopt` reports views only.

A hydrate that throws drops that element's served nodes for a cold render,
warning in development. A child the use site writes beside `lightSlot` with
bindings of its own does that every time, because its markers come ahead of
the element's own; static author children are kept. `static styles` do not
apply: a light-DOM element has no shadow root to adopt them into, so it takes
the document's styles.

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
which is what `bootstrap()` waits for before it hydrates.

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
- [The Altitude Atlas](https://atlas.lit-ui-router.dev) and
  [its source](https://github.com/simshanith/lit-ui-router/tree/www/atlas/www/atlas.lit-ui-router.dev)
  on `www/atlas` — the dogfood consumer whose prerender build shaped this package
- [On the Altitude Atlas](https://atlas.lit-ui-router.dev/bricks/?focus=lit-ui-router-ssr) — this package as
  a brick in sheet 2's model in the round, sized by its authored files and
  seated on what it peers
