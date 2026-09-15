/**
 * Build-time prerender: `ui-router-server` decides, `lit-ui-router-ssr` draws
 * and emits, this file supplies the shell, the job table and the router.
 *
 * Run after `vite build` (npm run build does both). `prerender()` asks the
 * mount table in src/routes.ts for a verdict on every path listed here:
 *
 *   shell     → dist/<subpath>/index.html, rendered from src/views.ts
 *   redirect  → a line in dist/_redirects (Cloudflare Pages), no page
 *   notFound  → dist/404.html, once, from the otherwise projection
 *
 * The verdicts come out of the same compiled mounts the Vite dev/preview
 * server uses, so a route that 302s in development 302s on the deployed site.
 *
 * ONE TEMPLATE SET. `prerender()` provides the router on the render root and
 * scopes it around each render, so the client's own views emit real hrefs,
 * the `is-active` class and `aria-current` for the state the page IS.
 */
import '@lit-labs/ssr/lib/install-global-dom-shim.js';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Type-only, so they are erased and the values still arrive by dynamic import.
import type { UIRouterLit as LitRouter } from 'lit-ui-router';
import type { TemplateResult } from 'lit';
import type { RedirectLine } from 'lit-ui-router-ssr';
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

// --- loaded AFTER the shim -------------------------------------------------
// NOTE the dynamic imports. `lit-ui-router` must be loaded after the DOM shim
// has finished installing, or <ui-view>/<ui-router> stay unregistered and
// render as inert unknown elements with no error at all (repo #808).
// `lit-ui-router-ssr` reaches only `lit-ui-router/context` and a static import
// of it measured byte-identical here; it rides with the family all the same.
const { UIRouterLit } = await import('lit-ui-router/pure');
const { installServerLocation } = await import('ui-router-server/location');
const { prerender } = await import('lit-ui-router-ssr');
const views = await import('./src/views.ts');

/**
 * ONE router, driven from page to page.
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
const router: LitRouter = installServerLocation(new UIRouterLit(), {
  // Cloudflare Pages 308s `/sheet/7` onto `/sheet/7/`; the client sets the
  // same relaxed mode in src/router.ts and the mount compiles `strict: false`.
  strictMode: false,
});
for (const route of routes) router.stateRegistry.register(route);
// Twins of src/router.ts: the function form of `initial` hands the query
// string through, and an unmatched path keeps its url on the notFound state.
router.urlService.rules.initial((_match, parsed) => ({
  state: 'atlas.gallery',
  params: parsed?.search ?? {},
}));
router.urlService.rules.otherwise({ state: 'atlas.notFound' });

let started = false;

/** Settles the one router on `path`; `start()` syncs the first url itself. */
const goTo = async (path: string): Promise<void> => {
  const settled = new Promise<void>((resolve, reject) => {
    const offSuccess = router.transitionService.onSuccess({}, () => {
      offSuccess();
      offError();
      resolve();
    });
    const offError = router.transitionService.onError({}, (transition) => {
      offSuccess();
      offError();
      reject(new Error(`prerender: ${path} — ${String(transition.error())}`));
    });
  });
  router.urlService.url(path);
  if (!started) {
    started = true;
    router.start();
  }
  await settled;
};

interface Job {
  title: string;
  /** The routed view, handed the resolves the client's router would have made. */
  content: (router: LitRouter) => TemplateResult;
}

const cityRow = findExtra(manifest, 'city');

const jobs = new Map<string, Job>([
  [
    href.gallery,
    {
      title: TITLES.gallery,
      content: (r) => views.GalleryView({ router: r, resolves: { manifest } }),
    },
  ],
  [
    href.about,
    {
      title: TITLES.about,
      content: (r) => views.AboutView({ router: r, resolves: { manifest } }),
    },
  ],
  [
    href.log,
    {
      title: TITLES.log,
      content: (r) => views.LogView({ router: r, resolves: { manifest } }),
    },
  ],
  ...(cityRow
    ? ([
        [
          href.city,
          {
            title: TITLES.city,
            content: (r: LitRouter): TemplateResult =>
              views.CityView({
                router: r,
                resolves: {
                  extra: cityRow,
                  fragment: readFileSync(join(PUBLIC, cityRow.file), 'utf8'),
                  // `three` is a client resolve: the scene is raised on boot.
                  three: undefined,
                },
              }),
          },
        ],
      ] as [string, Job][])
    : []),
  [
    href.specimen,
    {
      title: TITLES.specimen,
      // The bench's element IS the resolve on the client (src/router.ts). The
      // server has no bench to draw — every reading on it is a measurement of a
      // live document — so a truthy token stands in and the view emits its head
      // and an empty <atlas-specimen>.
      content: (r) => views.SpecimenView({ router: r, resolves: { specimen: true } }),
    },
  ],
  ...PLATES.map((row: SheetRow): [string, Job] => [
    href.sheet(row.num),
    {
      title: sheetTitle(row),
      content: (r: LitRouter): TemplateResult =>
        views.SheetView({
          router: r,
          resolves: {
            fragment: readFileSync(join(PUBLIC, row.file), 'utf8'),
            manifest,
            sheet: row,
          },
        }),
    },
  ]),
]);

// Verdict-only: /office is a redirect, a bare mount (when the mount is not the
// root) redirects to the gallery, and a lowercase sheet id redirects to its
// cased page. None gets a page; each gets a _redirects line.
const verdictOnly: string[] = [
  `${BASE}office`,
  ...(MOUNT === BASE ? [] : [MOUNT]),
  ...PLATES.filter((row) => row.id !== row.num).map((row) => href.sheet(row.id)),
];

// The megacanvas was retired from the app on 2026-09-05; the flat set still
// publishes the page, so both spellings of the old url are sent to it.
// `trailingSlash` pairs the generated lines only — these ride verbatim.
const megacanvas: RedirectLine[] = [
  { from: `${BASE}megacanvas`, to: href.plate('megacanvas.html'), status: 301 },
  { from: `${BASE}megacanvas/`, to: href.plate('megacanvas.html'), status: 301 },
];

const result = await prerender({
  mounts: mountsFor(PLATES.map((sheet) => sheet.num)),
  router,
  outDir: DIST,
  paths: [...jobs.keys(), ...verdictOnly],
  extraRules: megacanvas,
  // The atlas's own elements (`<atlas-plate>`, `<atlas-city>`, `<atlas-themer>`)
  // are light-DOM LitElements; the default `LitElementRenderer` would wrap each
  // one in a `<template shadowrootmode="open">` it never asked for and render
  // nothing inside it, because `connectedCallback` is not called on the server.
  // With none, each falls back to a plain tag around its own children.
  elementRenderers: [],
  renderShell: async (_verdict, { path }) => {
    await goTo(path);
    const job = jobs.get(path);
    // THE CLIENT'S EXACT TREE (spike #898): `<ui-router>` → `<ui-view>` →
    // shell → `<ui-view>` → the routed view, through the same template
    // functions main.ts renders, so every digest matches on the other side.
    // The job table stands in for the server-side `UiViewRenderer`: it is what
    // supplies the routed view and its resolves for a path.
    return views.rootTemplate(
      router,
      views.shell(
        manifest,
        views.uiViewSlot(
          job ? job.content(router) : views.NotFoundView({ router, resolves: {} }),
        ),
      ),
    );
  },
  document: (body, { path }) => {
    const title = jobs.get(path)?.title ?? TITLES.notFound;
    return shellHtml
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      // NOTE (spike #898): nothing is added here. @lit-labs/ssr already writes
      // `defer-hydration` on every custom element it renders below the top
      // level, which is exactly the attribute the client's arming patch runs
      // on — so the server half of the contract is already in the box.
      .replace(ROOT_RE, `$1${body}$3`);
  },
});

// A listed path that matches no route is a build bug for this app: every one of
// them comes out of the manifest the mounts were compiled from.
for (const path of result.warnings) console.error(`prerender: no route for ${path}`);

console.log(
  `prerendered ${String(result.tally.shell)} pages + ` +
    `${String(result.tally.document)} × 404.html · ` +
    `${String(result.rules.length)} redirects → _redirects`,
);

if (result.warnings.length > 0) process.exitCode = 1;
