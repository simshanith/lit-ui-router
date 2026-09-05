/**
 * The route table as DATA — the one projection both halves of this app read.
 *
 * The client (src/router.ts) looks its urls up here and hangs components and
 * resolves off the same names; `ui-router-server` (vite.config.ts,
 * prerender.ts) compiles the same array into mounts and answers pathnames
 * with verdicts. A route that exists on one side and not the other is
 * impossible by construction, which is the point of the projection.
 */
import type { MountConfig, RouteDeclaration } from 'ui-router-server';

/** The mount base — matches vite's `base` and the staged site's /app/. */
export const MOUNT = '/app';

export const routes: RouteDeclaration[] = [
  // Abstract shell: the rail and the content ui-view. Url-less, so it
  // contributes no segment; its children's urls are the whole url.
  { name: 'atlas' },
  { name: 'atlas.gallery', url: '/' },
  { name: 'atlas.sheet', url: '/sheet/:num' },
  // `at` is a DYNAMIC search param on the client: changing it must not
  // re-enter the state (that would re-resolve all twenty-one fragments).
  // The experimental layer pans the reel to it; the base app ignores it.
  {
    name: 'atlas.megacanvas',
    url: '/megacanvas?at',
    params: { at: { value: null, dynamic: true } },
  },
  // The survey office is sheet 14 under its own name.
  {
    name: 'atlas.office',
    url: '/office',
    redirectTo: { state: 'atlas.sheet', params: { num: '14' } },
  },
  { name: 'atlas.about', url: '/about' },
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
 * the client's `/sheet/:num`, `/app/sheet/99` is a perfectly good match and
 * the server must answer 200 — the in-app guard is the only thing that knows
 * 99 is not a sheet. Passing the sheet numbers here narrows the param to a
 * regex alternation, and the same mount then answers an honest 404 for a
 * number that was never drawn. The numbers come from the generated manifest,
 * which the server side can read off disk; the browser keeps the loose
 * pattern and its onBefore guard.
 */
export function mountsFor(sheetNums?: readonly string[]): Record<string, MountConfig> {
  const narrowed = routes.map((route) => {
    if (route.name !== 'atlas.sheet' || !sheetNums?.length) return route;
    const alternates = [
      ...new Set(sheetNums.flatMap((num) => [num, num.toLowerCase()])),
    ].sort();
    return { ...route, url: `/sheet/{num:(?:${alternates.join('|')})}` };
  });

  return {
    [MOUNT]: {
      routes: narrowed,
      // A bare `/app` (no trailing slash) resolves the empty subpath, which no
      // route claims; send it to the gallery rather than 404ing the front door.
      redirects: [{ pattern: /^$/, to: 'atlas.gallery' }],
      otherwise: { state: 'atlas.notFound' },
      strategy: 'matcher',
    },
  };
}

