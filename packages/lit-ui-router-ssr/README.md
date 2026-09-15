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
hydrates against. An address no state routes gets empty markers.

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

`lit-ui-router-ssr/client` is the adopt side — three calls, no import side effects:

```typescript
import { armLightDom, hydrateRoot, wakeAll } from 'lit-ui-router-ssr/client';

armLightDom();
await import('lit-ui-router/register');

if (hydrateRoot(root, page(router))) {
  const booted = new Promise<void>((resolve) => {
    const off = router.transitionService.onSuccess({}, () => {
      off();
      resolve();
    });
  });
  router.start();
  void booted.then(() => wakeAll(root));
} else {
  router.start();
  render(page(router), root);
}
```

- **`armLightDom()`** patches `LitElement` so an element carrying `defer-hydration` stays asleep at
  connect — no render root, no update — and hydrates rather than renders once the attribute is
  removed. `@lit-labs/ssr-client`'s own arming runs in `createRenderRoot` and only for an element
  with a shadow root, so `<ui-view>`, whose render root is the element itself, is never armed by it.
  Arming observes `defer-hydration` the way that support does, so removal is the wake signal on both
  halves.
- **Import order is the contract.** `armLightDom()` must run before `lit-ui-router` defines its tags:
  registration upgrades the server's markup, and an element that upgrades unarmed renders over the
  nodes meant to be adopted. An entry that hydrates therefore imports `lit-ui-router/pure`, which
  registers nothing, and reaches `lit-ui-router/register` (or the root entry) after the call.
- **`uiViewSlot()`** is the same directive on both halves: the server reaches the renderer's
  `renderLight()` only through it, and on the client it commits nothing, leaving the empty part whose
  markers the shelter keeps.
- **`hydrateRoot(container, value, options?)`** lifts each deferred element's server content out from
  between its part markers before hydrating the container, and puts it back as that element wakes —
  light DOM has no `<template>` to shelter nested markers from the host's walk, so this makes one. It
  returns `false` when there is nothing to adopt. A sheltered element sleeps through the walk that
  strips its attribute — lit's own way of waking a shadow-DOM child — and wakes on the next removal.
- **`wakeAll(container)`** wakes them outermost first, one level per pass, by removing
  `defer-hydration` from each. Call it once the boot transition has succeeded: that is the whole of
  the boot-transition contract, and `defer-hydration` is its handle. Removing the attribute by hand
  wakes that one element just the same; what `wakeAll()` adds is the order, and a parent has to be
  awake before its children — a child's server content is sheltered out of the document until the
  parent's hydrate walk has run over the markers standing in its place.
- **A mismatch falls back.** One static document answers a whole family of urls, so a client can boot
  into a state the document was not drawn for. `hydrate()` throws on that; the client warns in
  development, drops that one element's server nodes, and renders — its ancestors keep theirs.

## Documentation

- [Guide](https://lit-ui-router.dev/packages/ssr)
- [API reference](https://lit-ui-router.dev/api/lit-ui-router-ssr/)

## License

MIT
