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
  attribute directives emit real hrefs. The render passes `deferHydration`, so every custom element
  on the page carries `defer-hydration` and renders nothing until the client's walk reaches it.
- **The emit loop.** Verdict to file name, redirect to rules line, tally, warnings for paths that
  matched nothing.
- **The host rules file.** `_redirects` by default, every generated line paired with and without a
  trailing slash. No SPA catch-all is ever written: one turns every 404 into a 200.
- **`<ui-view>` on both sides.** `UiViewRenderer` fills the element's light DOM on the server;
  `lit-ui-router-ssr/client` adopts what it drew.

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

`lit-ui-router`, `ui-router-server`, `@lit-labs/ssr`, `@lit-labs/ssr-client`, `lit`, and
`@uirouter/core` are peer dependencies. `@lit-labs/ssr` is the server half and `@lit-labs/ssr-client`
the client half, so a bundle takes one or the other, never both.

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

## The routed view, drawn on the server

`elementRenderers` defaults to `[UiViewRenderer]` — not `@lit-labs/ssr`'s `[LitElementRenderer]`,
which wraps every custom element in a declarative shadow root it never asked for. `UiViewRenderer`
answers for `ui-view`: it registers the view at the address its `name` attribute and enclosing
`<ui-view>`s spell, takes the `ViewConfig` the registration syncs back, and writes the routed
component into the element's light DOM between the part markers the element's own `render()`
hydrates against. An address no state routes gets empty markers. That pair stays plain, so the walk
hydrating the view's surroundings reads it as the `uiViewSlot()` part and stops there; every marker
between it carries a prefix, so the same walk reads past the view's interior.

The use site opts in with `uiViewSlot()`, which is what reaches the renderer's light-DOM render and
commits nothing on the client:

```typescript
import { uiViewSlot } from 'lit-ui-router-ssr/client';

const page = (router: UIRouterLit) => html`
  <ui-router .uiRouter=${router}><ui-view>${uiViewSlot()}</ui-view></ui-router>
`;
```

One template set, both sides: the server fills the hole through the renderer, the client renders the
same strings with the hole empty and each `<ui-view>` fills itself.

## The client half

`lit-ui-router-ssr/client` is the adopt side — two exports, no import side effects. The router boots
first, and one call adopts the page:

```typescript
import { hydrateRoot, uiViewSlot } from 'lit-ui-router-ssr/client';

const booted = new Promise<void>((resolve) => {
  const off = router.transitionService.onSuccess({}, () => {
    off();
    resolve();
  });
});
router.start();
await booted;

const release = hydrateRoot(root, page(router));
if (!release) render(page(router), root);
```

- **The sequence is the contract.** `router.start()`, await its first successful transition, then
  `hydrateRoot()`. The walk commits `.uiRouter` onto `<ui-router>` and each `<ui-view>` re-seeks the
  router before its own first render, so every view finds the settled router rather than the
  placeholder it registered against. Nothing constrains when `lit-ui-router/register` is imported.
- **`hydrateRoot(container, value, options?)`** provides `adoptUiViewContext` under `container` with
  core's `provideContext()` and runs one `hydrate()` over `container`. It returns that provider's
  release function, or `false` when there is nothing to adopt — a cold client render, a dev server.
  Release it once the page has settled; a nested view wakes on its parent's own update, after this
  call returns.
- **One walk wakes the page.** A served `<ui-view>` sleeps under `defer-hydration` and renders
  nothing. Removing the attribute wakes it: it re-seeks its router, requests `adoptUiViewContext`
  and calls the adopter it gets, which adopts the nodes the view holds. The walk pins that adopter
  to every served view it passes, so a view the app detaches before its own update is still
  adopted. A view the walk never reached drops those nodes, renders cold, and warns in development.
- **The prefix is the protocol, and both halves are here.** `UiViewRenderer` writes a plain outer
  part pair around each view's routed markup and prefixes every marker between them; `hydrate()`
  reads past a prefixed comment, so the walk hydrating a view's surroundings stops at that pair. The
  adopter renames one view's markers back at that view's wake and hydrates the element's own
  `render()` against them, which leaves a nested view's interior hidden until its own wake.
- **`uiViewSlot()`** is the hole, on both halves: the server reaches the renderer's `renderLight()`
  only through it, and on the client it wakes the `<ui-view>` it sits in, whenever the enclosing
  template hydrates, then resolves to `noChange` — so the walk reads that element as a leaf and a
  later render of the template leaves the view's own nodes alone. On a cold render there is no
  attribute to remove.
- **An empty pair is nothing to adopt.** A view the server drew at an address no state routed holds
  only its two markers. Both go, and the element renders cold and silent.
- **A mismatch falls back.** One static document answers a whole family of urls, so a client can boot
  into a state the document was not drawn for. `hydrate()` throws on that; the client warns in
  development, drops that one view's server nodes, and the view renders cold — its ancestors keep
  theirs.

### How this compares

Two axes separate the hydration models in circulation: where the code that wakes the markup comes
from — imported from the renderer, or provided from outside it — and how much it wakes at once, the
whole tree or one boundary on demand.

| Model                     | Where the wake code comes from                                                                         | Scope        | Shipped by the framework |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | ------------ | ------------------------ |
| Whole tree, in-renderer   | imported from the renderer — React `hydrateRoot()`, Vue `createSSRApp().mount()`, Solid `hydrate()`    | the page     | yes                      |
| Whole tree, provided      | a provider or a global patch — Angular `provideClientHydration()`, Lit's `lit-element-hydrate-support` | the page     | opt-in                   |
| Per boundary, in-renderer | the renderer schedules it — React Suspense selective hydration, Nuxt `<NuxtIsland>`                    | one boundary | yes                      |
| Per boundary, provided    | a directive or a context provider — Astro `client:*`, Angular `@defer (hydrate on …)`, this package    | one boundary | opt-in                   |

This package sits in the per-boundary, provided cell. Each `<ui-view>` is an island whose trigger is
a route match rather than viewport or idle, and the adopter is provided over `context-request`, so
any provider can scope or replace it. The element side reuses Lit's `defer-hydration` contract
unchanged, and `lit-ui-router` carries only the gated sleep and wake and one context key — Qwik,
which resumes rather than hydrates, is off the grid entirely.

The [guide](https://lit-ui-router.dev/packages/ssr#how-this-compares) carries the longer discussion.

## Documentation

- [Guide](https://lit-ui-router.dev/packages/ssr)
- [API reference](https://lit-ui-router.dev/api/lit-ui-router-ssr/)

## License

MIT
