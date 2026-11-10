---
title: Prerender with Vite
description: Emit one HTML page per route, a 404.html and a _redirects file from vite build, decided by the route table the app runs
---

# Prerender with Vite

One plugin option and one script turn `vite build` into a static site: one
HTML page per route, a `404.html`, and a `_redirects` file for the host. The
same route table the app runs decides which path gets which, so a static host
answers a deep link, a redirect and a typo the way the
[server](/guides/server-route-matching) would.

Three terms carry the rest of this page:

- The **route table** is the `mounts` object
  [`ui-router-server`](/packages/server#quick-start) compiles. Each key is a
  mount, the url prefix an app is served under (`/` here), and holds that
  app's route names and urls as plain data, with no components, so
  `vite.config.ts` and a server can import it.
- A **verdict** is the route table's answer for one path: a page, a redirect,
  or no route at all.
- The **prerender script** is the module the plugin runs after the client
  build. It returns the options for the render, and the plugin's side calls
  `prerender()` with them.

## The two files

The app below keeps its route table in `src/routes.ts`: a `home` state at
`/`, `about` at `/about`, `legacy` at `/legacy` redirecting to `about`, and a
url-less `notFound` state that the mount's `otherwise` rule sends every
unmatched path to. Its `src/app.ts` holds the Lit side: `states`, the same
names and urls with their components, and `page(router)`, the template
`src/main.ts` renders in the browser. That template's `<ui-view>` holds
[`uiViewSlot()`](/packages/ssr#the-hydration-model) from
`lit-ui-router-ssr/client`, the hole the server render fills with the routed
view.

`vite.config.ts` adds one option to
[`serverRouterPlugin`](/api/lit-ui-router-ssr/vite/functions/serverRouterPlugin)
from `lit-ui-router-ssr/vite`:

```ts
import { serverRouterPlugin } from 'lit-ui-router-ssr/vite';
import { createServerRouter } from 'ui-router-server';
import { defineConfig } from 'vite';

import { mounts } from './src/routes.ts';

export default defineConfig({
  plugins: [
    serverRouterPlugin(createServerRouter({ mounts }), {
      prerender: './src/prerender.ts',
    }),
  ],
});
```

`prerender` names the prerender script, resolved against Vite's root. The
plugin is `ui-router-server/vite`'s, set up for Lit: before the script it
loads `@lit-labs/ssr`'s DOM shim, then
[`lit-ui-router-ssr/register`](/packages/ssr#a-prerendered-app), which
defines the elements in the registry the shim installed. Modules of your own
to load before the script go in `prerender: { entry, preload: [...] }`, and
load after those two; a module listed twice loads once. To use another DOM,
list its setup modules in the plugin's `shim` option, which replaces
`@lit-labs/ssr`'s shim; `shim: []` installs none.

`src/prerender.ts` is the prerender script, and it imports everything
statically. Its default export comes from
[`definePrerender`](/api/lit-ui-router-ssr/vite/functions/definePrerender),
whose callback receives `site` and returns the options for
[`lit-ui-router-ssr`'s `prerender()`](/api/lit-ui-router-ssr/index/functions/prerender):

- `site.outDir`: Vite's output directory, absolute.
- `site.shellHtml`: the built `index.html`, as a string.
- `site.write`: writes a file, creating its directory.

```ts
import { UIRouterLit } from 'lit-ui-router/pure';
import { settle } from 'lit-ui-router-ssr';
import { definePrerender } from 'lit-ui-router-ssr/vite';
import { installServerLocation } from 'ui-router-server/location';

import { page, states } from './app.ts';
import { mounts } from './routes.ts';

const router = installServerLocation(new UIRouterLit());
for (const state of states) router.stateRegistry.register(state);
router.urlService.rules.otherwise({ state: 'notFound' });

export default definePrerender((site) => ({
  mounts,
  router,
  paths: ['/', '/about', '/legacy'],
  renderShell: async (_verdict, { path }) => {
    await settle(router, path);
    return page(router);
  },
  document: (body) => site.shellHtml.replace('<!--app-->', body),
}));
```

`definePrerender` spreads `site` under the options and calls `prerender()`,
so an option the script returns, such as `outDir`, wins over the build's.

`paths` lists every path to visit. `renderShell` moves the router to the path
and returns the page's template, and `document` puts the rendered body into
the built `index.html`, where the app's container holds a marker:

```html
<div id="app"><!--app--></div>
```

The shim must finish installing before anything defines an element, which
is why the plugin preloads it rather than the script importing it:
[`lit-ui-router-ssr`](/packages/ssr#a-prerendered-app) explains the order a
script that imports the shim itself has to follow. A page whose `<ui-view>`
leaves out `uiViewSlot()` renders that view empty, with no error.

## What `vite build` writes

Next to Vite's own `assets/`, `dist/` gains:

- `index.html`: the `home` page, in place of the built shell.
- `about/index.html`: the `about` page.
- `404.html`: the `notFound` page, which a static host serves for any path
  with no file.
- `_redirects`: `/legacy /about 302`, plus the same line for `/legacy/`.

`/legacy` gets no page: its verdict is a redirect, so it becomes a line in
`_redirects`, the file Cloudflare Pages and Netlify read. Those hosts serve
`about/index.html` at `/about/`, so both the route table and the browser
router need to
[accept the trailing slash](/packages/ssr#static-hosts-add-a-trailing-slash).

## How it runs

Four parties share one `vite build`. Vite runs the client build and owns
`dist/`. `ui-router-server` owns the plugin and the verdicts, and never
imports Lit. `lit-ui-router-ssr` wraps that plugin with the Lit preloads and
owns the Lit render. Your app owns the route table, the paths, the router
and the page. Everything after the plugin runs in a worker thread, the solid
outline, which ends once the result is back. The <span style="color: var(--vp-c-brand-1)">tinted</span> boxes are
lit-ui-router's part; the tinted files are the ones it adds to `dist/`.

<DiagramEmbed src="/diagrams/prerender-with-vite-build-flow.svg">

<!--@include: ../public/diagrams/prerender-with-vite-build-flow.svg-->

</DiagramEmbed>

`lit-ui-router-ssr`'s `prerender()` supplies the Lit render and hands the
rest to `ui-router-server`'s, which visits the paths, asks the route table
for each verdict and writes the files. The diagrams below follow each step.

### What the plugin hands the script

The plugin runs once the client build has written `dist/`. It reads the
built `index.html` as `shellHtml` and starts a worker thread, which loads the
preloads, then the prerender script, and calls its default export with
`site`. That export, from `definePrerender`, hands `site` to your callback,
spreads it under the options the callback returns, and calls
`lit-ui-router-ssr`'s `prerender()`. The worker posts the result back to the
plugin: the pages, the `_redirects` lines, the warnings and the delegated
paths. A non-empty `warnings` fails the build; otherwise the plugin logs a
summary line.

<DiagramEmbed src="/diagrams/prerender-with-vite-seq-1-site.svg">

<!--@include: ../public/diagrams/prerender-with-vite-seq-1-site.svg-->

</DiagramEmbed>

### A page

`/about` is the whole render path. The route table's verdict is a page, so
`ui-router-server` asks `lit-ui-router-ssr` to render it. Your `renderShell`
settles the router on the path and returns the page's template, Lit renders
it to html, and your `document` puts that body into `shellHtml` in place of
the marker. The finished document is written as `about/index.html`.

<DiagramEmbed src="/diagrams/prerender-with-vite-seq-2-page.svg">

<!--@include: ../public/diagrams/prerender-with-vite-seq-2-page.svg-->

</DiagramEmbed>

### A redirect

`/legacy` never reaches Lit. Its verdict is a redirect, so it becomes a line
in `_redirects`, plus the same line for `/legacy/`, and no page is written.

<DiagramEmbed src="/diagrams/prerender-with-vite-seq-3-redirect.svg">

<!--@include: ../public/diagrams/prerender-with-vite-seq-3-redirect.svg-->

</DiagramEmbed>

### The 404 page

After the listed paths, `ui-router-server` asks the route table about a path
no route claims under the mount. The `otherwise` rule answers with the
`notFound` page carrying status 404, which renders like any other page and
is written once, as `404.html`.

<DiagramEmbed src="/diagrams/prerender-with-vite-seq-4-not-found.svg">

<!--@include: ../public/diagrams/prerender-with-vite-seq-4-not-found.svg-->

</DiagramEmbed>

### A path with no route

A path in `paths` that matches no route, with no `otherwise` rule to fall
back on, gets no file and lands in `warnings`. The plugin turns that into an
error naming the path, and `vite build` fails.

<DiagramEmbed src="/diagrams/prerender-with-vite-seq-5-no-route.svg">

<!--@include: ../public/diagrams/prerender-with-vite-seq-5-no-route.svg-->

</DiagramEmbed>

## Details

**Loading the script.** The plugin runs after every other plugin has finished
the client build. It starts one
[`worker_thread`](https://nodejs.org/api/worker_threads.html) per build,
which loads the preloads and then the prerender script through a Vite module
runner of its own, with the project's root and mode but without the app's
plugins. The app's own modules go through Vite; every dependency loads from
`node_modules` as it would under `node src/prerender.ts`, with the same
`--conditions`. The result comes back to the plugin, and the thread ends with
whatever the script and its preloads installed: the DOM shim's globals, the
elements they defined, any loader hooks. Vite's own process never sees them,
so a second build in the same process, as under `vite build --watch` or a
test runner, loads the app fresh. An error the script or a preload throws
fails the build with its own message.

**`vite preview`.** The plugin's middleware still answers redirects and paths
with no route, so `/legacy` answers 302. Every other path gets the file the
build wrote for it, `404.html` for a path the `otherwise` rule catches, and
`index.html` for a path the build wrote no page for. A `serveShell` passed
to the plugin replaces this.

<DiagramEmbed src="/diagrams/prerender-with-vite-seq-6-preview.svg">

<!--@include: ../public/diagrams/prerender-with-vite-seq-6-preview.svg-->

</DiagramEmbed>

**Other renderers.** `serverRouterPlugin` and `definePrerender` from
[`ui-router-server/vite`](/api/ui-router-server/vite/functions/serverRouterPlugin)
are the same pair without Lit: the plugin preloads only what
`prerender: { entry, preload }` lists, and the script's default export calls
a `prerender()` itself and returns its result. For an app that does not
render with Lit, call `prerender` from
[`ui-router-server/prerender`](/packages/server#emitting-a-static-site) with a
`render` of your own, which receives each page verdict and returns the file's
text:

```ts
// vite.config.ts
import { serverRouterPlugin } from 'ui-router-server/vite';

serverRouterPlugin(createServerRouter({ mounts }), {
  prerender: { entry: './src/prerender.ts', preload: ['./src/setup.ts'] },
});

// src/prerender.ts
import { prerender } from 'ui-router-server/prerender';
import { definePrerender } from 'ui-router-server/vite';

export default definePrerender((site) =>
  prerender({ ...site, mounts, paths, render }),
);
```

**Delegating states on Workers.** A path that matches a
[delegating state](/packages/server#delegating-states) gets no file, and the
result lists it in `delegated`. On Cloudflare Workers, list those paths in
[`assets.run_worker_first`](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/#run-worker-first-for-selective-paths)
so the Worker answers them before the asset layer does.
