/**
 * Build-time prerender: `ui-router-server` decides, `@lit-labs/ssr` draws.
 *
 * Run after `vite build` (npm run build does both). For every route the
 * client can reach, the mount table in src/routes.ts is asked for a verdict:
 *
 *   shell     → write dist/<subpath>/index.html with server-rendered content
 *   redirect  → a line in dist/_redirects (Cloudflare Pages), no page
 *   notFound  → dist/404.html, written once from the otherwise projection
 *
 * The verdicts come out of the same compiled mounts the Vite dev/preview
 * server uses, so a route that 302s in development 302s on the deployed site.
 *
 * ONE TEMPLATE SET. This file used to carry a second, plain-href copy of every
 * view, because the sref directives had no way to reach a router with no
 * element to seek from and emitted nothing on the server. `lit-ui-router/server`
 * closes that: `configureServerRouter` points a router at the page's own url
 * with a path-shaped location plugin, and `withServerRouter` publishes it for
 * the duration of one synchronous render, so the client's own src/views.ts
 * emits real hrefs, the `is-active` class and `aria-current` for the state the
 * page IS. The twins are gone; what is left is the shell, the resolves the
 * router would have produced, and the write loop.
 */
import '@lit-labs/ssr/lib/install-global-dom-shim.js';

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render as ssrRender } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
// Type-only, so it is erased and the value still arrives by dynamic import.
import type { UIRouterLit as LitRouter } from 'lit-ui-router';
import type { TemplateResult } from 'lit';
import { createServerRouter } from 'ui-router-server';
import type { Verdict } from 'ui-router-server';
import type { Manifest, SheetRow } from './src/manifest.ts';
import { allSheets, findExtra } from './src/manifest.ts';
import { BASE, MOUNT, href, mountsFor, routes } from './src/routes.ts';
import { TITLES, sheetTitle } from './src/titles.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, 'dist');
const PUBLIC = join(HERE, 'public');

const manifest: Manifest = JSON.parse(
  readFileSync(join(PUBLIC, 'manifest.json'), 'utf8'),
) as Manifest;

const shellHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const ROOT_RE = /(<div id="root">)(\s*)(<\/div>)/;
if (!ROOT_RE.test(shellHtml))
  throw new Error('prerender: dist/index.html has no empty <div id="root">');

// BOTH lists narrow the `/sheet/{num:...}` alternation: the appendix is out of
// the ascent, but /sheet/A1 is as real a url as /sheet/13.
const PLATES = allSheets(manifest);

/** The verdict engine — which paths get a page at all. */
const verdicts = createServerRouter({
  mounts: mountsFor(PLATES.map((sheet) => sheet.num)),
});

// --- the client's own halves, loaded AFTER the shim ------------------------
// NOTE the dynamic imports. `lit-ui-router` must be loaded after the DOM shim
// has finished installing: a static `import ... from 'lit-ui-router'` in this
// module leaves <ui-view>/<ui-router> unregistered, and they then render as
// inert unknown elements with no error at all (repo issue #808).
const { UIRouterLit } = await import('lit-ui-router/pure');
const { configureServerRouter, withServerRouter } = await import('lit-ui-router/server');
const views = await import('./src/views.ts');

/**
 * One router per page, settled on that page's url.
 *
 * The state table is src/routes.ts — the same projection the client's
 * src/router.ts hangs its components and resolves off, so a name or a url
 * cannot drift between the two. The components and resolves themselves are
 * deliberately NOT registered: this file already holds the manifest and reads
 * the fragments off disk, and a resolve here would be a second fetch of data
 * the build has in hand. What the router is for is the url — `srefHref` reads
 * `stateService.href()`, `srefActiveClass` and `srefAriaCurrent` read
 * `globals.$current` — so it has to have entered the page's own state.
 */
const routerFor = async (url: string): Promise<LitRouter> => {
  const router = configureServerRouter(new UIRouterLit(), {
    // Cloudflare Pages 308s `/sheet/7` onto `/sheet/7/`; the client sets the
    // same relaxed mode in src/router.ts and the mount compiles `strict: false`.
    strictMode: false,
    url,
  });
  for (const route of routes) router.stateRegistry.register(route);
  // Twins of src/router.ts: the function form of `initial` hands the query
  // string through, and an unmatched path keeps its url on the notFound state.
  router.urlService.rules.initial((_match, parsed) => ({
    state: 'atlas.gallery',
    params: parsed?.search ?? {},
  }));
  router.urlService.rules.otherwise({ state: 'atlas.notFound' });

  const settled = new Promise<void>((resolve) => {
    router.transitionService.onSuccess({}, () => {
      resolve();
    });
  });
  router.start();
  await settled;
  return router;
};

/**
 * The render itself, synchronous on purpose.
 *
 * `withServerRouter` is a module slot, not an async context, and @lit-labs/ssr's
 * `render()` is a sync generator — consumed inside the callback by
 * `collectResultSync`, so every directive's `render()` has already read the
 * router by the time the slot is restored.
 *
 * `elementRenderers: []` is the second deliberate choice. The atlas's own
 * elements (`<atlas-plate>`, `<atlas-city>`, `<atlas-themer>`) are light-DOM
 * LitElements; the default `LitElementRenderer` would wrap each one in a
 * `<template shadowrootmode="open"><slot></slot></template>` it never asked
 * for and render nothing inside it, because `connectedCallback` is not called
 * on the server. With no element renderers each one falls back to a plain tag
 * around its own children — which is what a static page wants, and what the
 * client replaces on boot.
 */
const renderPage = (router: LitRouter, content: TemplateResult): string =>
  withServerRouter(router, () =>
    collectResultSync(ssrRender(views.shell(manifest, content), { elementRenderers: [] })),
  );

const writeFile = (file: string, body: string, title: string): void => {
  mkdirSync(dirname(file), { recursive: true });
  const titled = shellHtml.replace(
    /<title>[^<]*<\/title>/,
    `<title>${title}</title>`,
  );
  writeFileSync(file, titled.replace(ROOT_RE, `$1${body}$3`));
};

/** A route path becomes `<subpath>/index.html`, so every url keeps its slash. */
const write = (subpath: string, body: string, title: string): void => {
  writeFile(
    subpath === '/' ? join(DIST, 'index.html') : join(DIST, subpath, 'index.html'),
    body,
    title,
  );
};

// --- drive it off the verdicts --------------------------------------------

interface Job {
  path: string;
  title: string;
  /** The routed view, handed the resolves the client's router would have made. */
  content?: (router: LitRouter) => TemplateResult;
}

const verdictOnly = (path: string): Job => ({ path, title: '' });

const cityRow = findExtra(manifest, 'city');

const jobs: Job[] = [
  {
    path: href.gallery,
    title: TITLES.gallery,
    content: (router) => views.GalleryView({ router, resolves: { manifest } }),
  },
  {
    path: href.about,
    title: TITLES.about,
    content: (router) => views.AboutView({ router, resolves: { manifest } }),
  },
  {
    path: href.log,
    title: TITLES.log,
    content: (router) => views.LogView({ router, resolves: { manifest } }),
  },
  ...(cityRow
    ? [
        {
          path: href.city,
          title: TITLES.city,
          content: (router: LitRouter): TemplateResult =>
            views.CityView({
              router,
              resolves: {
                extra: cityRow,
                fragment: readFileSync(join(PUBLIC, cityRow.file), 'utf8'),
                // `three` is a client resolve: the scene is raised on boot.
                three: undefined,
              },
            }),
        },
      ]
    : []),
  {
    path: href.specimen,
    title: TITLES.specimen,
    // The bench's element IS the resolve on the client (src/router.ts). The
    // server has no bench to draw — every reading on it is a measurement of a
    // live document — so a truthy token stands in and the view emits its head
    // and an empty <atlas-specimen>.
    content: (router) => views.SpecimenView({ router, resolves: { specimen: true } }),
  },
  // Verdict-only: /office is a redirect, a bare mount (when the mount is not
  // the root) redirects to the gallery, and a lowercase sheet id redirects
  // to its cased page. None gets a page; each gets a _redirects line.
  verdictOnly(`${BASE}office`),
  ...(MOUNT === BASE ? [] : [verdictOnly(MOUNT)]),
  ...PLATES.filter((row) => row.id !== row.num).map((row) => verdictOnly(href.sheet(row.id))),
  ...PLATES.map((row: SheetRow) => ({
    path: href.sheet(row.num),
    title: sheetTitle(row),
    content: (router: LitRouter): TemplateResult =>
      views.SheetView({
        router,
        resolves: {
          fragment: readFileSync(join(PUBLIC, row.file), 'utf8'),
          manifest,
          sheet: row,
        },
      }),
  })),
];

// The megacanvas was retired from the app on 2026-09-05; the flat set still
// publishes the page, so both spellings of the old url are sent to it.
const redirects: string[] = [
  `${BASE}megacanvas ${href.plate('megacanvas.html')} 301`,
  `${BASE}megacanvas/ ${href.plate('megacanvas.html')} 301`,
];
const tally = { shell: 0, redirect: 0, notFound: 0 };

for (const job of jobs) {
  const verdict: Verdict = await verdicts.resolve(job.path);
  if (verdict.kind === 'redirect') {
    tally.redirect += 1;
    redirects.push(`${job.path} ${verdict.location} ${String(verdict.status)}`);
    continue;
  }
  if (verdict.kind === 'notFound' || !job.content) {
    tally.notFound += 1;
    console.warn(`prerender: no route for ${job.path}`);
    continue;
  }
  tally.shell += 1;
  const router = await routerFor(job.path);
  const subpath = job.path === BASE ? '/' : job.path.slice(BASE.length);
  write(subpath, renderPage(router, job.content(router)), job.title);
}

// The otherwise projection, as a page: Cloudflare Pages serves 404.html with
// a 404 status, which is the same verdict the mount gives an unknown path.
const missingPath = `${BASE}sheet/does-not-exist`;
const missing: Verdict = await verdicts.resolve(missingPath);
const missingRouter = await routerFor(missingPath);
writeFile(
  join(DIST, '404.html'),
  renderPage(missingRouter, views.NotFoundView({ router: missingRouter, resolves: {} })),
  TITLES.notFound,
);

// No SPA catch-all: every route the mount claims has its own file, and
// anything else must reach 404.html with a real 404 status. stage-site.mjs
// appends the site-level rules (the flat set's old filenames, /app/*).
writeFileSync(join(DIST, '_redirects'), `${redirects.join('\n')}\n`);

console.log(
  `prerendered ${String(tally.shell)} pages + 404.html · ` +
    `${String(redirects.length)} redirects → _redirects · ` +
    `unknown-path verdict: ${missing.kind}` +
    ('status' in missing && missing.status ? ` ${String(missing.status)}` : ''),
);
