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
  build. Its default export receives the build's output and returns what it
  wrote.

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
[`serverRouterPlugin`](/api/ui-router-server/vite/functions/serverRouterPlugin):

```ts
import { createServerRouter } from 'ui-router-server';
import { serverRouterPlugin } from 'ui-router-server/vite';
import { defineConfig } from 'vite';

import { mounts } from './src/routes.ts';

export default defineConfig({
  plugins: [
    serverRouterPlugin(createServerRouter({ mounts }), {
      prerender: { entry: './src/prerender.ts' },
    }),
  ],
});
```

`prerender: './src/prerender.ts'` is shorthand for the same option.

`src/prerender.ts` is the prerender script.
[`definePrerender`](/api/ui-router-server/vite/functions/definePrerender)
types its default export and returns it unchanged, as Vite's `defineConfig`
does. The plugin calls it with `site`:

- `site.outDir`: Vite's output directory, absolute.
- `site.shellHtml`: the built `index.html`, as a string.
- `site.write`: writes a file, creating its directory.

```ts
import '@lit-labs/ssr/lib/install-global-dom-shim.js';

import { definePrerender } from 'ui-router-server/vite';

// Loaded once the DOM shim has installed, so the elements land in its registry.
await import('lit-ui-router-ssr/register');
const { UIRouterLit } = await import('lit-ui-router/pure');
const { installServerLocation } = await import('ui-router-server/location');
const { prerender, settle } = await import('lit-ui-router-ssr');
const { mounts } = await import('./routes.ts');
const { page, states } = await import('./app.ts');

const router = installServerLocation(new UIRouterLit());
for (const state of states) router.stateRegistry.register(state);
router.urlService.rules.otherwise({ state: 'notFound' });

export default definePrerender((site) =>
  prerender({
    ...site,
    mounts,
    router,
    paths: ['/', '/about', '/legacy'],
    renderShell: async (_verdict, { path }) => {
      await settle(router, path);
      return page(router);
    },
    document: (body) => site.shellHtml.replace('<!--app-->', body),
  }),
);
```

`paths` lists every path to visit. `renderShell` moves the router to the path
and returns the page's template, and `document` puts the rendered body into
the built `index.html`, where the app's container holds a marker:

```html
<div id="app"><!--app--></div>
```

[`lit-ui-router-ssr`](/packages/ssr#a-prerendered-app) explains the import
order: the shim must finish installing before anything defines an element.

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

```text
vite build
  └─ client build writes dist/
  └─ serverRouterPlugin
       └─ loads src/prerender.ts, calls its default export with site
            └─ lit-ui-router-ssr prerender()
                 └─ ui-router-server/prerender prerender()
                      for each path in paths, the route table's verdict:
                        page      → Lit render → write <path>/index.html
                        redirect  → add a _redirects line
                        no route  → warning
                      then the otherwise rule's state → Lit render → write 404.html
                      returns the pages, the _redirects lines and the warnings
  └─ any warning fails the build
```

`lit-ui-router-ssr`'s `prerender()` supplies the Lit render;
`ui-router-server`'s visits the paths, asks the route table for each verdict
and writes the files. A path in `paths` that matches no route, with no
`otherwise` rule to fall back on, fails `vite build` with the path's name.

## Details

**Loading the script.** The plugin runs after every other plugin has finished
the client build, and loads the prerender script through Vite's module runner
with the project's root and mode but without the app's plugins. The app's own
modules go through Vite; every dependency loads from `node_modules` as it
would under `node src/prerender.ts`.

**`vite preview`.** The plugin's middleware still answers redirects and paths
with no route, so `/legacy` answers 302. Every other path gets the file the
build wrote for it, `404.html` for a path the `otherwise` rule catches, and
`index.html` for a path the build wrote no page for. A `serveShell` passed
to the plugin replaces this.

**Other renderers.** The prerender script picks the `prerender()` it calls.
For an app that does not render with Lit, call `prerender` from
[`ui-router-server/prerender`](/packages/server#emitting-a-static-site) with a
`render` of your own, which receives each page verdict and returns the file's
text.

**Delegating states on Workers.** A path that matches a
[delegating state](/packages/server#delegating-states) gets no file, and the
result lists it in `delegated`. On Cloudflare Workers, list those paths in
[`assets.run_worker_first`](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/#run-worker-first-for-selective-paths)
so the Worker answers them before the asset layer does.
