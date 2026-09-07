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

/**
 * The mount base — THE ONE base constant. vite's `base`, `<base href>`,
 * every href in both template sets, the generator's fragment links and the
 * staged site's _redirects all derive from it. The app owns the site root;
 * the flat drawing set lives beside it under `/set/`.
 */
export const MOUNT = '/';

/** `MOUNT` with its trailing slash: the prefix every href in the app starts with. */
export const BASE = MOUNT.endsWith('/') ? MOUNT : `${MOUNT}/`;

/** Where the standalone drawing set is staged, relative to the site root. */
export const SET = `${BASE}set/`;

/** The hrefs the client templates and the server templates share. */
export const href = {
  gallery: BASE,
  about: `${BASE}about`,
  city: `${BASE}city`,
  specimen: `${BASE}specimen`,
  log: `${BASE}log`,
  sheet: (num: string): string => `${BASE}sheet/${num}`,
  /** The flat set's index — a plain page, never a router state. */
  set: SET,
  /** A sheet's standalone page in the flat set. */
  plate: (file: string): string => `${SET}${file}`,
};

export const routes: RouteDeclaration[] = [
  // Abstract shell: the rail and the content ui-view. Url-less, so it
  // contributes no segment; its children's urls are the whole url.
  { name: 'atlas' },
  { name: 'atlas.gallery', url: '/' },
  { name: 'atlas.sheet', url: '/sheet/:num' },
  // The 3D city: a plate the flat set only publishes inside its gallery, and
  // the one state whose view loads a library on demand (three, resolved).
  { name: 'atlas.city', url: '/city' },
  // The type specimen: a design bench, not a plate. It is the one state whose
  // view pulls a webfont — and it pulls it on entry, so no other page's
  // payload knows the faces exist.
  { name: 'atlas.specimen', url: '/specimen' },
  // The survey office is sheet 14 under its own name.
  {
    name: 'atlas.office',
    url: '/office',
    redirectTo: { state: 'atlas.sheet', params: { num: '14' } },
  },
  { name: 'atlas.about', url: '/about' },
  // The set's issue log — every REV across every plate, latest first. It was
  // the cover's right-hand column until 2026-09-06; a page of its own is where
  // a drawing set's issue record belongs once it outgrows the title sheet.
  { name: 'atlas.log', url: '/log' },
  // Url-less on purpose: an unmatched path keeps its own url in the address
  // bar, exactly as a server 404 does. This is the `otherwise` projection.
  { name: 'atlas.notFound' },
];

/** The declared url for a state name — the client reads its urls from here. */
export function urlOf(name: string): string | undefined {
  return routes.find((route) => route.name === name)?.url;
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
export function mountsFor(sheetNums?: readonly string[]): Record<string, MountConfig> {
  const nums = [...new Set(sheetNums ?? [])].sort();
  const narrowed = routes.map((route) => {
    if (route.name !== 'atlas.sheet' || nums.length === 0) return route;
    return { ...route, url: `/sheet/{num:(?:${nums.join('|')})}` };
  });
  const lowercased: RedirectRule[] = nums
    .filter((num) => num !== num.toLowerCase())
    .map((num) => ({
      pattern: `/sheet/${num.toLowerCase()}`,
      to: { state: 'atlas.sheet', params: { num } },
    }));

  return {
    [MOUNT]: {
      routes: narrowed,
      redirects: [
        ...lowercased,
        // A bare mount base (no trailing slash) resolves the empty subpath,
        // which no route claims; send it to the gallery rather than 404ing
        // the front door. Inert at a root mount — `/` is the gallery's own
        // url — and kept so a move back under a prefix keeps working.
        { pattern: /^$/, to: 'atlas.gallery' },
      ],
      otherwise: { state: 'atlas.notFound' },
      strategy: 'matcher',
      // Cloudflare Pages serves `<subpath>/index.html` and 308s the bare
      // path onto the slash, so `/sheet/7/` must be as real a url as
      // `/sheet/7`. The client sets `strictMode(false)` for the same reason.
      config: { strict: false },
    },
  };
}
