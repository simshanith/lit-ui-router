/**
 * The route table as DATA — the one projection both halves of this app read.
 *
 * The client (src/router.ts) looks its urls up here and hangs components and
 * resolves off the same names; `ui-router-server` (vite.config.ts,
 * prerender.ts) compiles the same array into mounts and answers pathnames
 * with verdicts. A route that exists on one side and not the other is
 * impossible by construction, which is the point of the projection.
 */
import type { MountConfig, RedirectRule, RouteDeclaration } from 'ui-router-server';
import type { RouterUrlConfig } from 'ui-router-server/url-config';
import type { AssertNoCollisions, StatesOf } from 'ui-router-registry';

/**
 * The mount base — THE ONE base constant. vite's `base`, `<base href>`,
 * every href in both template sets, the generator's fragment links and the
 * staged site's _redirects all derive from it. The app owns the site root.
 */
export const MOUNT = '/';

/** `MOUNT` with its trailing slash: the prefix every href in the app starts with. */
export const BASE = MOUNT.endsWith('/') ? MOUNT : `${MOUNT}/`;

/**
 * The url shape both halves compile with. Cloudflare Pages serves
 * `<subpath>/index.html` and 308s the bare path onto the slash, so `/sheet/7/`
 * must be as real a url as `/sheet/7`. The client router takes it through
 * `applyUrlConfig` (src/router.ts), the mount through `config`, and the
 * prerender's router through `installServerLocation` (prerender.ts).
 */
export const URL_CONFIG = { strict: false } satisfies RouterUrlConfig;

/** The hrefs the client templates and the server templates share. */
export const href = {
  gallery: BASE,
  about: `${BASE}about`,
  city: `${BASE}city`,
  plant: `${BASE}plant`,
  bricks: `${BASE}bricks`,
  builds: `${BASE}builds`,
  specimen: `${BASE}specimen`,
  colour: `${BASE}colour`,
  log: `${BASE}log`,
  sheet: (num: string): string => `${BASE}sheet/${num}`,
  plate: (num: string): string => `${BASE}plate/${num}`,
};

/**
 * Sheet ids that resolve to a plate filed under another id: the survey office's
 * lane is appendix A2i. `/sheet/14i` redirects on both sides of the seam, and
 * HISTORY.md's record headings file under the plate's own id.
 */
export const SHEET_ALIASES: Readonly<Record<string, string>> = { '14i': 'A2i' };

/**
 * The gallery's filter params — null by default, so an absent key is an
 * absent query param rather than an empty one. Deliberately NOT `dynamic`: a
 * filter change re-enters atlas.gallery, which is what re-renders the index,
 * and the state has no resolve of its own to pay for (the manifest is the
 * shell's, and the shell does not re-enter).
 */
export const FILTER_PARAMS = {
  subject: { value: null },
  projection: { value: null },
  mode: { value: null },
  basis: { value: null },
  kv: { value: null },
} as const;

/**
 * A figure page's in-place params, dynamic, never inherited, null when absent:
 * an interactive page's selection, `?focus=12`, and the enlarged figure,
 * `?enlarge=sheet-7` (src/lightbox.ts).
 */
export const FOCUS_PARAMS = {
  focus: { value: null, dynamic: true, inherit: false },
  enlarge: { value: null, dynamic: true, inherit: false },
} as const;

/**
 * The builds' params: the focus pair and the picked build, `?build=signals`,
 * dynamic and inherited, so a pin's url move keeps the build it was made in.
 * Null is the first build.
 */
export const BUILD_PARAMS = {
  ...FOCUS_PARAMS,
  build: { value: null, dynamic: true },
} as const;

export const routes = [
  // Abstract shell: the rail and the content ui-view. Url-less, so it
  // contributes no segment; its children's urls are the whole url.
  { name: 'atlas' },
  // THE KEY INDEX, as route state: FORM's four keys plus the general kv
  // fallback ride the gallery's url as query params, so every filtered index
  // is a link someone can send. Each defaults to null — the unfiltered index
  // carries no query string, and the prerendered `/` is that page.
  {
    name: 'atlas.gallery',
    url: '/?subject&projection&mode&basis&kv',
    params: FILTER_PARAMS,
  },
  { name: 'atlas.sheet', url: '/sheet/:num?focus&enlarge', params: FOCUS_PARAMS },
  // The city in the round and its working twin: app-only plates whose view loads
  // @google/model-viewer on entry, resolved. The twin is the same city with its plants raised.
  { name: 'atlas.city', url: '/city?focus&enlarge', params: FOCUS_PARAMS },
  { name: 'atlas.plant', url: '/plant?focus&enlarge', params: FOCUS_PARAMS },
  // Sheet 2's finished model in the round: its view loads @google/model-viewer
  // on entry, as the city's does.
  { name: 'atlas.bricks', url: '/bricks?focus&enlarge', params: FOCUS_PARAMS },
  // Sheet 2C's builds in the round, one picked at a time: the same on-demand view.
  { name: 'atlas.builds', url: '/builds?build&focus&enlarge', params: BUILD_PARAMS },
  // The type specimen: a design bench, not a plate. It is the one state whose
  // view pulls a webfont — and it pulls it on entry, so no other page's
  // payload knows the faces exist.
  { name: 'atlas.specimen', url: '/specimen' },
  // The colour standards: the specimen's sibling bench, the tokens and the guard's ratios.
  { name: 'atlas.colour', url: '/colour' },
  // The survey office is appendix A2 under its own name.
  {
    name: 'atlas.office',
    url: '/office',
    redirectTo: { state: 'atlas.sheet', params: { num: 'A2' } },
  },
  { name: 'atlas.about', url: '/about' },
  // The set's issue log — every REV across every plate, latest first. It was
  // the cover's right-hand column until 2026-09-06; a page of its own is where
  // a drawing set's issue record belongs once it outgrows the title sheet.
  { name: 'atlas.log', url: '/log' },
  // Url-less on purpose: an unmatched path keeps its own url in the address
  // bar, exactly as a server 404 does. This is the `otherwise` projection.
  { name: 'atlas.notFound' },
  // THE BARE PLATE: one sheet as one plate in a bare document, with no shell
  // and no client bundle. A top-level state, so no rail; the prerender answers
  // it from the sheet's fragment, and the client knows it as a link target.
  { name: 'plate', url: '/plate/:num' },
] as const satisfies readonly RouteDeclaration[];

/**
 * The table, registered: `RegisteredStates` takes its rows keyed by name, so a
 * `stateService.go`, `href`, `target` or `includes` anywhere in the app takes a
 * registered name and that state's params, and the effect entry fills
 * `ui-router-effect`'s `RouteTypes`, so the route ref's snapshot narrows on
 * `includes` to a state's params (src/registry.test-d.ts).
 */
import type {} from 'ui-router-registry/effect';
declare module 'ui-router-registry' {
  interface RegisteredStates extends StatesOf<typeof routes> {}
}

/** Fails to compile when a row here is not the one registered under its name. */
export type AtlasStates = AssertNoCollisions<typeof routes>;

/** The declared url for a state name — the client reads its urls from here. */
export function urlOf(name: string): string | undefined {
  const table: readonly RouteDeclaration[] = routes;
  return table.find((route) => route.name === name)?.url;
}

/**
 * A mount table for the server.
 *
 * CONSUMER FINDING: `ui-router-server` projects PATTERNS, not existence. With
 * the client's `/sheet/:num`, `/sheet/99` is a perfectly good match and the
 * server must answer 200 — the in-app guard is the only thing that knows 99
 * is not a sheet. Passing the sheet numbers here narrows the param to a
 * regex alternation, and the same mount then answers an honest 404 for a
 * number that was never drawn. The numbers come from the generated manifest,
 * which the server side can read off disk; the browser keeps the loose
 * pattern and its onBefore guard.
 *
 * Sheet ids are cased ('2A', '12i'). The cased form is canonical: a
 * lowercase url is a redirect to it here, exactly as the client's onBefore
 * guard redirects it, so prerender writes one directory per sheet and the
 * rail's uiSrefActive compares like with like.
 */
/** The two states whose `:num` is a sheet number: the routed sheet and its bare plate. */
const SHEET_STATES: ReadonlyArray<[state: string, segment: string, query: string]> = [
  ['atlas.sheet', 'sheet', '?focus&enlarge'],
  ['plate', 'plate', ''],
];

/**
 * The tier a mount resolves on. The dev and preview servers take the default
 * matcher. The prerender replays its whole list through the simulate tier's
 * pooled headless router, prewarmed before the first path. Both tiers read
 * the mount's `config`, so a path verdicts the same on either.
 */
export type MountTier = Pick<MountConfig, 'strategy' | 'prewarm'>;

export function mountsFor(
  sheetNums?: readonly string[],
  tier: MountTier = { strategy: 'matcher' },
): Record<string, MountConfig> {
  const nums = [...new Set(sheetNums ?? [])].sort();
  const narrowed = routes.map((route) => {
    const own = SHEET_STATES.find(([state]) => state === route.name);
    if (!own || nums.length === 0) return route;
    const [, segment, query] = own;
    return { ...route, url: `/${segment}/{num:(?:${nums.join('|')})}${query}` };
  });
  const lowercased: RedirectRule[] = SHEET_STATES.flatMap(([state, segment]) =>
    nums
      .filter((num) => num !== num.toLowerCase())
      .map((num) => ({
        pattern: `/${segment}/${num.toLowerCase()}`,
        to: { state, params: { num } },
      })),
  );
  const aliased: RedirectRule[] = SHEET_STATES.flatMap(([state, segment]) =>
    Object.entries(SHEET_ALIASES).map(([alias, num]) => ({
      pattern: `/${segment}/${alias}`,
      to: { state, params: { num } },
    })),
  );

  return {
    [MOUNT]: {
      routes: narrowed,
      redirects: [
        ...lowercased,
        ...aliased,
        // A bare mount base (no trailing slash) resolves the empty subpath,
        // which no route claims; send it to the gallery rather than 404ing
        // the front door. Inert at a root mount — `/` is the gallery's own
        // url — and kept so a move back under a prefix keeps working.
        { pattern: /^$/, to: 'atlas.gallery' },
      ],
      otherwise: { state: 'atlas.notFound' },
      ...tier,
      config: URL_CONFIG,
    },
  };
}
