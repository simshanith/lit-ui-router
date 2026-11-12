---
title: Prerender with Eleventy
description: Let Eleventy write the pages and the layout while lit-ui-router-ssr's prerender decides what each path is and renders it
type: guide
topic: server
---

# Prerender with Eleventy

[Eleventy](https://www.11ty.dev) can write a lit-ui-router app as a static
site. Eleventy owns the files, the layout around each page and the host rules.
[`prerender()`](/packages/lit-ui-router-ssr#quick-start) from `lit-ui-router-ssr` owns
everything routing decides: which paths are pages, which redirect, what the
404 page holds, and the server render of each page. The client then adopts the
served page instead of rendering it again.

<LiveExample name="hellosolarsystem-eleventy" />

The example is the Hello Solar System tutorial app, built this way. Its files:

- [`src/app.ts`](https://github.com/simshanith/lit-ui-router/blob/main/examples/hellosolarsystem-eleventy/src/app.ts)
  holds the components, the states, `configure(router)` and `page(router)`,
  the template both halves render.
- [`src/routes.ts`](https://github.com/simshanith/lit-ui-router/blob/main/examples/hellosolarsystem-eleventy/src/routes.ts)
  holds the states as data: names, urls, the redirect, `otherwise` and
  `strict`. `src/app.ts` spreads it into the states it registers, and the
  server's mount compiles it, so the two halves can't drift.
- [`src/bodies.ts`](https://github.com/simshanith/lit-ui-router/blob/main/examples/hellosolarsystem-eleventy/src/bodies.ts)
  holds the solar-system data.
- [`src/prerender.ts`](https://github.com/simshanith/lit-ui-router/blob/main/examples/hellosolarsystem-eleventy/src/prerender.ts)
  runs one `prerender()` over a path per body, plus `/` and `/legacy`, and
  returns the pages and rules.
- [`site/`](https://github.com/simshanith/lit-ui-router/tree/main/examples/hellosolarsystem-eleventy/site)
  is Eleventy's input: a template per output kind, and the layout.
- [`src/client.ts`](https://github.com/simshanith/lit-ui-router/blob/main/examples/hellosolarsystem-eleventy/src/client.ts)
  boots the client with
  [`bootstrap()`](/packages/lit-ui-router-ssr#the-hydration-model).
- [`eleventy.config.js`](https://github.com/simshanith/lit-ui-router/blob/main/examples/hellosolarsystem-eleventy/eleventy.config.js)
  builds both halves with Vite and runs
  [`render.js`](https://github.com/simshanith/lit-ui-router/blob/main/examples/hellosolarsystem-eleventy/render.js),
  which calls `src/prerender.ts`, before each Eleventy build.
  [`build.js`](https://github.com/simshanith/lit-ui-router/blob/main/examples/hellosolarsystem-eleventy/build.js)
  starts Eleventy with `--base=` as its
  [path prefix](https://www.11ty.dev/docs/config/#deploy-to-a-subdirectory-with-a-path-prefix).

## Who writes what

`prerender()` runs before each Eleventy build, and its result becomes
[global data](https://www.11ty.dev/docs/data-global-custom/). Its `write`
collects each file in memory instead of writing it. `base` puts the path
prefix on every redirect line, and
[`redirectPages()`](/packages/ui-router-server#hosts-without-redirect-rules) writes `_redirects`
and a page per redirect, whose body here is just its target:

```ts
const result = await prerender({
  mounts,
  router,
  paths: ['/', ...solarBodies.map(({ id }) => `/planets/${id}`), '/legacy'],
  outDir: '',
  base,
  rules: redirectPages({ redirectsFile: true, page: ({ to }) => to }),
  dehydrate: {},
  template: page,
  write: (file, body) => {
    files.set(file, body);
  },
});
```

Each page in `result.pages` names the file it belongs at, such as
`planets/3/index.html` or `404.html`, and its verdict carries the status. The
other collected files are `_redirects` and the redirect pages. From there
Eleventy does the writing:

- A [paginated](https://www.11ty.dev/docs/pagination/) template writes one
  page per entry in `result.pages`, at its `file`, wrapped in the layout.
- A second template writes `_redirects` as `prerender()` wrote it. A third
  wraps each redirect page in the layout, which sends the browser on, for
  hosts that don't read `_redirects`.
- The layout owns the document: the `<head>`, the client script, and a
  `<base>` for a site served under a path prefix.

The path prefix has one source, `eleventyConfig.pathPrefix`, which
`eleventy.config.js` hands to the Vite client build as `base`, to the render
as `prerender()`'s `base`, and to the layout. Eleventy's
[HTML `<base>` plugin](https://www.11ty.dev/docs/plugins/html-base/) is left
out: the router already put the prefix on every link in the page bodies, and
the plugin would add it again.

Vite builds the two halves Eleventy can't compile itself: the server module
that renders the pages, and the client bundle Eleventy copies through. Under
`eleventy --serve`, a save under `src/` runs both builds and the render again.
The render runs in a fresh Node process each time, because importing the
rebuilt module again would define the app's custom elements a second time.

## The page, then the client

`dehydrate: {}` puts each page's resolved data into its
[hydration signature](/packages/lit-ui-router-ssr#adopting-the-resolves-on-boot), so the
client boots on the served data instead of running the resolves again.
`bootstrap()` then adopts the served `<ui-view>` and its routed component,
keeping the server's nodes.

Links bind `href=${srefHref(...)}` rather than `uiSref`. The server renders
attribute parts and skips element parts, so a `uiSref` link would be served as
an `<a>` with no `href` until the client boots.

`<app-root>` renders into a shadow root, so the render needs
`LitElementRenderer` after the package's own renderers;
`elementRenderers: shadowElementRenderers` is that list. The
[default](/packages/lit-ui-router-ssr#property-bindings-on-the-server) leaves it out, and
`<app-root>` would render empty.

## Details

**Lit's Eleventy plugin.**
[`@lit-labs/eleventy-plugin-lit`](https://www.npmjs.com/package/@lit-labs/eleventy-plugin-lit)
renders the custom elements in each finished page after Eleventy writes it.
On a page `prerender()` already rendered, it renders `<app-root>` again with
no router and puts that empty render ahead of the routed one, and the browser
shows the empty one. Keep the routed pages out of the plugin's reach.

**One render at a time.** `prerender()` renders pages one after another, so a
build waits on every page's resolves in turn. See
[One render at a time](/packages/lit-ui-router-ssr#one-render-at-a-time).

**Trailing slashes.** Each page lands at `<path>/index.html`, which hosts serve
at the slashed url. The browser router and the route table both relax strict
mode, as [Static hosts add a trailing slash](/packages/lit-ui-router-ssr#static-hosts-add-a-trailing-slash)
describes.

**With Vite alone.** [Prerender with Vite](./prerender-with-vite) does the same
from `vite build`, with no Eleventy.
