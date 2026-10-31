/**
 * Build-time prerender: `ui-router-server` decides, `lit-ui-router-ssr` draws
 * and emits, this file supplies the page template, the titles and the router.
 *
 * Run after `vite build` (npm run build does both). `prerender()` asks the
 * mount table in src/routes.ts for a verdict on every path listed here:
 *
 *   shell     → dist/<subpath>/index.html, rendered from src/views.ts
 *   plate     → dist/plate/<num>/index.html, one fragment in a bare document
 *   redirect  → a line in dist/_redirects (Cloudflare Pages), no page
 *   notFound  → dist/404.html, once, from the otherwise projection
 *
 * The verdicts come out of the same mount table the Vite dev/preview server
 * uses, so a route that 302s in development 302s on the deployed site. The
 * server replays them on the simulate tier, a pooled headless
 * `@uirouter/core` router with one prewarmed; dev and preview take the
 * default matcher tier, and both tiers read the mount's `strict: false`.
 *
 * ONE TEMPLATE SET, and one template: `views.page(router)`. `prerender()`
 * provides the router on the render root and scopes it around each render, so
 * the client's own views emit real hrefs, the `is-active` class and
 * `aria-current` for the state the page IS, and `UiViewRenderer` draws each
 * `<ui-view>`'s routed component into the element's light DOM.
 *
 * THE BARE PLATE is the one page outside that template: `plate` is a top-level
 * state in the same route table, and its render is the sheet's fragment as a
 * string in a document of its own — no shell, no hydration signature, no
 * client bundle — so a reader who opts out of the router still gets the plate
 * the route table defines.
 */
import '@lit-labs/ssr/lib/install-global-dom-shim.js';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
// Type-only, so they are erased and the values still arrive by dynamic import.
import type { LitStateDeclaration, UIRouterLit as LitRouter } from 'lit-ui-router';
import type { Transition } from '@uirouter/core';
import type { RedirectLine } from 'lit-ui-router-ssr';
import type { ResolvePayload } from 'ui-router-server/ssr';
import type { ExtraRow, Manifest, SheetRow } from './src/manifest.ts';
import { allSheets, findExtra, findSheet } from './src/manifest.ts';
import { BASE, MOUNT, SHEET_ALIASES, URL_CONFIG, href, mountsFor, routes } from './src/routes.ts';
import { TITLES, sheetTitle } from './src/titles.ts';
import { ICON_SPRITE } from './src/generated/icons.js';
import { CYTOSCAPE_URL, FILL_SCRIPT, PLATE_END_SCRIPT } from './src/generated/plate-page.js';

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
// The stand-in font links, as the shell carries them; the stager swaps them for the kit.
const FONT_LINKS = shellHtml.match(/<link[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>/g) ?? [];

// BOTH lists narrow the `/sheet/{num:...}` alternation: the appendix is out of
// the ascent, but /sheet/A1 is as real a url as /sheet/13.
const PLATES = allSheets(manifest);

// --- loaded AFTER the shim -------------------------------------------------
// NOTE the dynamic imports. `lit-ui-router` must be loaded after the DOM shim
// has finished installing, or <ui-view>/<ui-router> stay unregistered and
// render as inert unknown elements with no error at all (repo #808).
// `lit-ui-router-ssr` reaches only `lit-ui-router/context` and a static import
// of it measured byte-identical here; it rides with the family all the same.
// The elements come from the register entry src/main.ts uses; src/views.ts
// imports `lit-ui-router/pure`, which registers nothing.
await import('lit-ui-router-ssr/register');
const { UIRouterLit } = await import('lit-ui-router/pure');
const { createServerRouter, diagnoseMounts } = await import('ui-router-server');
const { installServerLocation } = await import('ui-router-server/location');
const { prerender, settle } = await import('lit-ui-router-ssr');
const { dehydrate } = await import('ui-router-server/ssr');
const { RouterRefController } = await import('lit-ui-router-effect');
const { withRouterSync } = await import('lit-ui-router/context');
const views = await import('./src/views.ts');

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
// The one url shape (src/routes.ts): the client router and the mount take the same object.
const router: LitRouter = installServerLocation(new UIRouterLit(), { urlConfig: URL_CONFIG });
const cityRow = findExtra(manifest, 'city');
const plantRow = findExtra(manifest, 'plant');
const bricksRow = findExtra(manifest, 'bricks');
const buildsRow = findExtra(manifest, 'builds');

const fragmentOf = (row: { file: string }): string => readFileSync(join(PUBLIC, row.file), 'utf8');

/** A 3D plate's resolves: its row and fragment, read from disk. */
const sceneResolves = (id: string, row: ExtraRow | undefined): LitStateDeclaration['resolve'] => [
  {
    token: 'extra',
    resolveFn: (): ExtraRow => {
      if (!row) throw new Error(`prerender: no ${id} row in the manifest`);
      return row;
    },
  },
  { token: 'fragment', deps: ['extra'], resolveFn: fragmentOf },
  // A client resolve: the model is wired on boot, so the served page has none.
  { token: 'viewer', resolveFn: (): undefined => undefined },
];

/** The routed component per state name — the client's own, from src/views.ts. */
const components: Record<string, LitStateDeclaration['component']> = {
  atlas: views.ShellView,
  'atlas.gallery': views.GalleryView,
  'atlas.sheet': views.SheetView,
  'atlas.city': views.CityView,
  'atlas.plant': views.CityView,
  'atlas.bricks': views.BricksView,
  'atlas.builds': views.BuildsView,
  'atlas.specimen': views.SpecimenView,
  'atlas.colour': views.ColourView,
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
  'atlas.city': sceneResolves('city', cityRow),
  'atlas.plant': sceneResolves('plant', plantRow),
  'atlas.bricks': sceneResolves('bricks', bricksRow),
  'atlas.builds': sceneResolves('builds', buildsRow),
  // The bench's element IS the resolve on the client (src/router.ts). The
  // server has no bench to draw — every reading on it is a measurement of a
  // live document — so a truthy token stands in and the view emits its head
  // and an empty <atlas-specimen>; the colour bench mounts the same way.
  'atlas.specimen': [{ token: 'specimen', resolveFn: (): boolean => true }],
  'atlas.colour': [{ token: 'colour', resolveFn: (): boolean => true }],
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

/** The sheet each `/sheet/*` page is, by path. */
const sheetOf = new Map(PLATES.map((row): [string, string] => [href.sheet(row.num), row.num]));
/** The sheet each `/plate/*` page draws, by path. */
const plateOf = new Map(PLATES.map((row): [string, SheetRow] => [href.plate(row.num), row]));

/**
 * The bare plate's document: the fragment is already the whole sheet section
 * (chrome.mjs's `sheetSection`), so the page adds the head, the sprite, the
 * two inline scripts every standalone page carries, and the lanes' cytoscape.
 */
const plateDocument = (row: SheetRow, fragment: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${sheetTitle(row)}</title>
<meta name="description" content="${row.caption}">
<link rel="icon" href="${BASE}favicon.ico" sizes="any">
<link rel="icon" href="${BASE}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${BASE}apple-touch-icon.png">
<link rel="stylesheet" href="${BASE}sheets/atlas.css">
${FONT_LINKS.join('\n')}
${row.needsCytoscape ? `<script defer src="${CYTOSCAPE_URL}"></script>\n` : ''}</head>
<body>
<main>
${ICON_SPRITE}
${fragment}
</main>
<script>${PLATE_END_SCRIPT}
${FILL_SCRIPT}</script>
</body>
</html>
`;
/**
 * The resolve payload each shell page carries in its signature, for `bootstrap()` to seed.
 * `fragment` is the body's own HTML, `specimen` and `colour` server stand-ins for the
 * benches the client imports, and `manifest` the 146 KB index the shell
 * preloads (index.html) and the browser caches, so `shouldDehydrate` keeps
 * the three out; `viewer` resolves `undefined` and `dehydrate` lists it as
 * unserializable.
 */
const LEFT_OUT = new Set(['fragment', 'specimen', 'colour', 'manifest']);
const EXPECTED_UNSERIALIZABLE = new Set(['viewer']);
const payloadReport: { path: string; bytes: number; unserializable: string[] }[] = [];

const drawPayload = (transition: Transition, { path }: { path: string }): ResolvePayload => {
  const { payload, unserializable } = dehydrate(transition, {
    shouldDehydrate: ({ token }) => !LEFT_OUT.has(token),
  });
  payloadReport.push({
    path,
    bytes: Buffer.byteLength(JSON.stringify(payload)),
    unserializable: unserializable.map(({ state, token }) => `${state}.${token}`),
  });
  return payload;
};

const routeRefFailures: string[] = [];
let routeRefReads = 0;
let routeRefMisses = 0;
let routeRefSheets = 0;

/**
 * The route ref's construction-time read, against the router the page was
 * rendered from: a `RouterRefController` on a host that never connects takes
 * the router `withRouterSync` scopes, reads its ref once, and `.value` must
 * be the settled route.
 */
const checkRouteRef = (path: string): void => {
  const host = Object.assign(document.createElement('div'), {
    addController() {},
    removeController() {},
    requestUpdate() {},
    updateComplete: Promise.resolve(true),
  });
  const { value } = withRouterSync(router, () => new RouterRefController(host, (route) => route));
  const { current, params } = router.globals;
  const sheet = sheetOf.get(path);
  const num = value.includes('atlas.sheet') ? value.params.num : undefined;
  const misses = [
    value.current?.name === current.name
      ? ''
      : `reads ${String(value.current?.name)}, globals ${current.name}`,
    isDeepStrictEqual(value.params, Object.fromEntries(Object.entries(params)))
      ? ''
      : 'params differ from globals.params',
    sheet === undefined || num === sheet ? '' : `reads sheet ${String(num)}, page is ${sheet}`,
  ].filter(Boolean);
  routeRefReads += 1;
  if (sheet !== undefined) routeRefSheets += 1;
  if (misses.length === 0) return;
  routeRefMisses += 1;
  for (const miss of misses) routeRefFailures.push(`${path}: routeRef ${miss}`);
};

/** Every path that gets a page, and the `<title>` its document carries. */
const titles = new Map<string, string>([
  [href.gallery, TITLES.gallery],
  [href.about, TITLES.about],
  [href.log, TITLES.log],
  ...(cityRow ? ([[href.city, TITLES.city]] as [string, string][]) : []),
  ...(plantRow ? ([[href.plant, TITLES.plant]] as [string, string][]) : []),
  ...(bricksRow ? ([[href.bricks, TITLES.bricks]] as [string, string][]) : []),
  ...(buildsRow ? ([[href.builds, TITLES.builds]] as [string, string][]) : []),
  [href.specimen, TITLES.specimen],
  [href.colour, TITLES.colour],
  ...PLATES.map((row: SheetRow): [string, string] => [href.sheet(row.num), sheetTitle(row)]),
  ...PLATES.map((row: SheetRow): [string, string] => [href.plate(row.num), sheetTitle(row)]),
]);

// Verdict-only: /office is a redirect, a bare mount (when the mount is not the
// root) redirects to the gallery, and a lowercase or aliased sheet id redirects
// to its cased page. None gets a page; each gets a _redirects line.
const verdictOnly: string[] = [
  `${BASE}office`,
  ...(MOUNT === BASE ? [] : [MOUNT]),
  ...PLATES.filter((row) => row.id !== row.num).map((row) => href.sheet(row.id)),
  ...Object.keys(SHEET_ALIASES).map((alias) => href.sheet(alias)),
  ...PLATES.filter((row) => row.id !== row.num).map((row) => href.plate(row.id)),
  ...Object.keys(SHEET_ALIASES).map((alias) => href.plate(alias)),
];

// The megacanvas is not a state: both spellings of its url go to the index.
// `trailingSlash` pairs the generated lines only — these ride verbatim.
const megacanvas: RedirectLine[] = [
  { from: `${BASE}megacanvas`, to: href.gallery, status: 301 },
  { from: `${BASE}megacanvas/`, to: href.gallery, status: 301 },
];

// The route table's own diagnostics, on the matcher tier: a mount that 404s its bare base fails the build here.
const findings = diagnoseMounts(createServerRouter({ mounts: mountsFor(PLATES.map((sheet) => sheet.num)) }));
if (findings.length > 0) throw new Error(`prerender: ${findings.map((f) => `${f.mount} — ${f.message}`).join('; ')}`);

const result = await prerender({
  // One pooled router, built up front, serves the whole walk.
  mounts: mountsFor(
    PLATES.map((sheet) => sheet.num),
    { strategy: 'simulate', prewarm: 1 },
  ),
  router,
  outDir: DIST,
  paths: [...titles.keys(), ...verdictOnly],
  extraRules: megacanvas,
  // The default `[UiViewRenderer, LightElementRenderer]` draws each
  // `<ui-view>` and the atlas's own `LightDomHydrating` elements in place.
  // `settle()` drives the url directly and never calls `router.start()`; a
  // page that fails to land rejects, which fails the build.
  renderShell: async (_verdict, { path }) => {
    await settle(router, path);
    checkRouteRef(path);
    // A string is written as-is, with no hydration signature: the bare plate.
    const plate = plateOf.get(path);
    if (plate) return fragmentOf(plate);
    return views.page(router);
  },
  // The landed transition's resolves, written into each shell page's signature block.
  payload: drawPayload,
  document: (body, { path }) => {
    const plate = plateOf.get(path);
    if (plate) return plateDocument(plate, body);
    const title = titles.get(path) ?? TITLES.notFound;
    return shellHtml
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(ROOT_RE, () => `<div id="root">${body}</div>`);
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

// Every render was read, and every plate is a page.
const rendered = result.tally.shell + result.tally.document;
if (routeRefReads !== rendered)
  throw new Error(`prerender: routeRef read ${String(routeRefReads)} of ${String(rendered)} renders`);
if (routeRefSheets !== PLATES.length)
  throw new Error(`prerender: routeRef read ${String(routeRefSheets)} of ${String(PLATES.length)} sheets`);
for (const failure of routeRefFailures) console.error(`prerender: ${failure}`);
console.log(
  `scoped router at construction: ${String(routeRefReads - routeRefMisses)}/` +
    `${String(routeRefReads)} renders match router.globals (${String(routeRefSheets)} sheets by num)`,
);
if (routeRefFailures.length > 0) process.exitCode = 1;

const sizes = payloadReport.map(({ bytes }) => bytes).sort((a, b) => a - b);
const median = sizes[Math.floor(sizes.length / 2)] ?? 0;
console.log(
  `resolve payload: ${String(payloadReport.length)} shell pages · ` +
    `${String(sizes[0] ?? 0)}–${String(sizes.at(-1) ?? 0)} bytes, median ${String(median)}`,
);
for (const { path, bytes, unserializable } of payloadReport) {
  const reruns = unserializable.length > 0 ? ` · re-runs ${unserializable.join(', ')}` : '';
  console.log(`  ${path}: ${String(bytes)} bytes${reruns}`);
}
const unexpected = payloadReport.flatMap(({ path, unserializable }) =>
  unserializable
    .filter((token) => !EXPECTED_UNSERIALIZABLE.has(token.slice(token.lastIndexOf('.') + 1)))
    .map((token) => `${path}: ${token}`),
);
for (const miss of unexpected) console.error(`prerender: unserializable resolve ${miss}`);
if (unexpected.length > 0) process.exitCode = 1;
