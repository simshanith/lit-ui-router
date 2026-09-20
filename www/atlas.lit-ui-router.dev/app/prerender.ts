/**
 * Build-time prerender: `ui-router-server` decides, `lit-ui-router-ssr` draws
 * and emits, this file supplies the page template, the titles and the router.
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
 * ONE TEMPLATE SET, and one template: `views.page(router)`. `prerender()`
 * provides the router on the render root and scopes it around each render, so
 * the client's own views emit real hrefs, the `is-active` class and
 * `aria-current` for the state the page IS, and `UiViewRenderer` draws each
 * `<ui-view>`'s routed component into the element's light DOM.
 */
import '@lit-labs/ssr/lib/install-global-dom-shim.js';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Type-only, so they are erased and the values still arrive by dynamic import.
import type { LitStateDeclaration, UIRouterLit as LitRouter } from 'lit-ui-router';
import type { Transition } from '@uirouter/core';
import type { RedirectLine } from 'lit-ui-router-ssr';
import type { ExtraRow, Manifest, SheetRow } from './src/manifest.ts';
import { allSheets, findExtra, findSheet } from './src/manifest.ts';
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

// CONSUMER FINDING, WORKED AROUND HERE — see SSR-VERDICT.md.
// `@lit-labs/ssr` routes a child part to `UiViewRenderer.renderLight()` only
// when the directive class carries `_$litRenderLight`, and
// `@lit-labs/ssr-client`'s PRODUCTION build mangles that property name.
// `uiViewSlot()` sets it by its literal name, so under node's default
// conditions the flag `isRenderLightDirective()` reads is absent and every
// `<ui-view>` is served with an empty part pair, silently. The flag
// ssr-client's own `renderLight()` carries is copied onto the slot's class.
const { getDirectiveClass } = await import('lit/directive-helpers.js');
const { renderLight } = await import('@lit-labs/ssr-client/directives/render-light.js');
const { uiViewSlot } = await import('lit-ui-router-ssr/client');
const RESERVED = new Set(['length', 'name', 'prototype']);
const litRenderLight = Object.getOwnPropertyNames(
  getDirectiveClass(renderLight()) ?? {},
).find((key) => !RESERVED.has(key));
const slotClass = getDirectiveClass(uiViewSlot()) as unknown as Record<string, unknown>;
if (litRenderLight) slotClass[litRenderLight] = true;

/**
 * ONE router, driven from page to page.
 *
 * The state table is src/routes.ts — the same projection the client's
 * src/router.ts hangs its components and resolves off, so a name or a url
 * cannot drift between the two. This half hangs the same components off it
 * and its own resolves: `UiViewRenderer` renders `component({ router,
 * resolves, transition })`, so the tokens a view reads have to be resolved on
 * the state's path by the time `renderShell` runs. Where the client fetches,
 * the build reads — the manifest is already parsed here and the fragments come
 * off disk.
 *
 * The url side is the other half of the router's job: `srefHref` reads
 * `stateService.href()`, `srefActiveClass` and `srefAriaCurrent` read
 * `globals.$current`, so it has to have entered the page's own state.
 */
const router: LitRouter = installServerLocation(new UIRouterLit(), {
  // Cloudflare Pages 308s `/sheet/7` onto `/sheet/7/`; the client sets the
  // same relaxed mode in src/router.ts and the mount compiles `strict: false`.
  strictMode: false,
});
const cityRow = findExtra(manifest, 'city');

const fragmentOf = (row: { file: string }): string => readFileSync(join(PUBLIC, row.file), 'utf8');

/** The routed component per state name — the client's own, from src/views.ts. */
const components: Record<string, LitStateDeclaration['component']> = {
  atlas: views.ShellView,
  'atlas.gallery': views.GalleryView,
  'atlas.sheet': views.SheetView,
  'atlas.city': views.CityView,
  'atlas.specimen': views.SpecimenView,
  'atlas.about': views.AboutView,
  'atlas.log': views.LogView,
  'atlas.notFound': views.NotFoundView,
};

/**
 * The resolves per state name — the client's tokens, read rather than fetched.
 *
 * `atlas.gallery`, `atlas.about` and `atlas.log` read the shell's manifest and
 * have none of their own, exactly as src/router.ts has it.
 */
const serverResolves: Record<string, LitStateDeclaration['resolve']> = {
  atlas: [{ token: 'manifest', resolveFn: (): Manifest => manifest }],
  'atlas.sheet': [
    {
      token: 'sheet',
      deps: ['$transition$'],
      resolveFn: (transition: Transition): SheetRow => {
        const num = String(transition.params().num);
        const row = findSheet(manifest, num);
        // The mount narrows /sheet/{num} to the drawn numbers, so this is types only.
        if (!row) throw new Error(`prerender: no sheet ${num}`);
        return row;
      },
    },
    { token: 'fragment', deps: ['sheet'], resolveFn: fragmentOf },
  ],
  'atlas.city': [
    {
      token: 'extra',
      resolveFn: (): ExtraRow => {
        if (!cityRow) throw new Error('prerender: no city row in the manifest');
        return cityRow;
      },
    },
    { token: 'fragment', deps: ['extra'], resolveFn: fragmentOf },
    // A client resolve: the scene is raised on boot, so the served page has none.
    { token: 'three', resolveFn: (): undefined => undefined },
  ],
  // The bench's element IS the resolve on the client (src/router.ts). The
  // server has no bench to draw — every reading on it is a measurement of a
  // live document — so a truthy token stands in and the view emits its head
  // and an empty <atlas-specimen>.
  'atlas.specimen': [{ token: 'specimen', resolveFn: (): boolean => true }],
};

/** src/routes.ts's names and urls, with this half's components and resolves on them. */
const serverStates: LitStateDeclaration[] = routes.map((route) => ({
  ...(route as LitStateDeclaration),
  // Url-less and unreachable on its own: the shell is entered through a child.
  ...(route.name === 'atlas' ? { abstract: true } : {}),
  ...(components[route.name] ? { component: components[route.name] } : {}),
  ...(serverResolves[route.name] ? { resolve: serverResolves[route.name] } : {}),
}));
for (const state of serverStates) router.stateRegistry.register(state);
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

/** Every path that gets a page, and the `<title>` its document carries. */
const titles = new Map<string, string>([
  [href.gallery, TITLES.gallery],
  [href.about, TITLES.about],
  [href.log, TITLES.log],
  ...(cityRow ? ([[href.city, TITLES.city]] as [string, string][]) : []),
  [href.specimen, TITLES.specimen],
  ...PLATES.map((row: SheetRow): [string, string] => [href.sheet(row.num), sheetTitle(row)]),
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
  paths: [...titles.keys(), ...verdictOnly],
  extraRules: megacanvas,
  // The default `[UiViewRenderer]` answers for `<ui-view>` alone; the atlas's
  // own light-DOM elements each fall back to a plain tag around their children.
  renderShell: async (_verdict, { path }) => {
    await goTo(path);
    return views.page(router);
  },
  document: (body, { path }) => {
    const title = titles.get(path) ?? TITLES.notFound;
    return shellHtml
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
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
