/**
 * The client half of src/routes.ts: the same names and urls, with components
 * and resolves hung off them.
 */
import { hashLocationPlugin, pushStateLocationPlugin } from '@uirouter/core';
import type { Transition } from '@uirouter/core';
import { UIRouterLit } from 'lit-ui-router';
import type { LitStateDeclaration } from 'lit-ui-router';
import {
  isUIRouterNavigateEvent,
  navigationLocationPlugin,
} from 'ui-router-navigation-location-plugin';
import { ARTIFACT } from './mode.ts';
import { urlOf } from './routes.ts';
import type { ExtraRow, Manifest, SheetRow } from './manifest.ts';
import { findExtra, findSheet, loadFragment, loadManifest } from './manifest.ts';
import { titleFor } from './titles.ts';
import {
  AboutView,
  CityView,
  GalleryView,
  NotFoundView,
  SheetView,
  ShellView,
} from './views.ts';

export const states: LitStateDeclaration[] = [
  {
    name: 'atlas',
    abstract: true,
    component: ShellView,
    // Resolved once for the whole shell; children read it through their own
    // deps, and loadManifest() memoizes, so the rail costs one fetch.
    resolve: [{ token: 'manifest', resolveFn: loadManifest }],
  },
  { name: 'atlas.gallery', url: urlOf('atlas.gallery'), component: GalleryView },
  {
    name: 'atlas.sheet',
    url: urlOf('atlas.sheet'),
    component: SheetView,
    resolve: [
      {
        token: 'sheet',
        deps: ['manifest', '$transition$'],
        resolveFn: (manifest: Manifest, transition: Transition): SheetRow => {
          const row = findSheet(manifest, String(transition.params().num));
          // The onBefore guard below has already turned an unknown number
          // into a redirect; this only keeps the type honest.
          if (!row) throw new Error(`no sheet ${String(transition.params().num)}`);
          return row;
        },
      },
      {
        token: 'fragment',
        deps: ['sheet'],
        resolveFn: (sheet: SheetRow): Promise<string> => loadFragment(sheet),
      },
    ],
  },
  {
    name: 'atlas.city',
    url: urlOf('atlas.city'),
    component: CityView,
    // DEPENDENCIES ON DEMAND: three.js is a resolve, so the router fetches the
    // library's own chunk while it enters the state — and no other route in
    // the app ever pays for it. The scene itself is a generated module
    // (src/generated/city-init.js) that takes the namespace resolved here.
    resolve: [
      {
        token: 'extra',
        deps: ['manifest'],
        resolveFn: (manifest: Manifest): ExtraRow => {
          const row = findExtra(manifest, 'city');
          if (!row) throw new Error('no city row in the manifest');
          return row;
        },
      },
      {
        token: 'fragment',
        deps: ['extra'],
        resolveFn: (extra: ExtraRow): Promise<string> => loadFragment(extra),
      },
      { token: 'three', resolveFn: (): Promise<unknown> => import('three') },
    ],
  },
  {
    name: 'atlas.office',
    url: urlOf('atlas.office'),
    redirectTo: { state: 'atlas.sheet', params: { num: '14' } },
  },
  { name: 'atlas.about', url: urlOf('atlas.about'), component: AboutView },
  // Url-less: an unmatched path keeps its own url, exactly as a server 404
  // does — the shape ui-router-server projects as `otherwise`.
  { name: 'atlas.notFound', component: NotFoundView },
];

/**
 * Which location plugin this page got. The Navigation API where it exists,
 * pushState everywhere else — the pairing the location-plugins guide
 * recommends; both produce /sheet/7. The artifact build can use neither: its
 * page is served from a path the host owns, so every url lives in the hash.
 * Exported because the analytics layer has to know: `navigation.navigate()`
 * never touches history.pushState, so gtag's own history hook cannot see it.
 */
export const NAVIGATION_API =
  !ARTIFACT && typeof window !== 'undefined' && 'navigation' in window;

export function createRouter(): UIRouterLit {
  const router = new UIRouterLit();
  if (ARTIFACT) router.plugin(hashLocationPlugin);
  else router.plugin(NAVIGATION_API ? navigationLocationPlugin : pushStateLocationPlugin);

  // CONSUMER FINDING: the Navigation API plugin calls navigation.navigate()
  // and leaves interception to the app — the sample app wires the same
  // listener. Without it, every router-driven navigate() is a cross-document
  // load: the SPA reloads on each click, the view transition never runs.
  if (NAVIGATION_API) {
    window.navigation.addEventListener('navigate', (event) => {
      if (!event.canIntercept || !isUIRouterNavigateEvent(event)) return;
      event.intercept({ handler: () => Promise.resolve() });
    });
  }

  // Cloudflare Pages serves `<subpath>/index.html` and 308s `/sheet/7` onto
  // `/sheet/7/`, so a trailing slash must match — core's default strict mode
  // would boot every prerendered deep link into notFound. The server mount
  // (routes.ts) is compiled with the same `strict: false`.
  router.urlService.config.strictMode(false);

  for (const state of states) router.stateRegistry.register(state);

  // An unknown sheet number is a miss, not a broken resolve: redirect to the
  // url-less notFound state WITHOUT moving the address bar. A miscased
  // number ('2a') is the sheet under its canonical id: redirect there, so
  // the url, the rail's uiSrefActive and the prerendered directory agree.
  router.transitionService.onBefore({ to: 'atlas.sheet' }, async (transition) => {
    const manifest = await loadManifest();
    const num = String(transition.params().num);
    const row = findSheet(manifest, num);
    if (!row) {
      return router.stateService.target('atlas.notFound', undefined, {
        location: false,
      });
    }
    if (row.num !== num) {
      return router.stateService.target(
        'atlas.sheet',
        { ...transition.params(), num: row.num },
        { location: 'replace' },
      );
    }
    return true;
  });

  router.transitionService.onSuccess({}, (transition) => {
    window.scrollTo({ top: 0 });
    // The prerendered pages carry these titles; the SPA keeps them current.
    const to = transition.to().name;
    const sheet =
      to === 'atlas.sheet' ? (transition.injector().get('sheet') as SheetRow) : undefined;
    document.title = titleFor(to, sheet);
  });

  router.urlService.rules.initial({ state: 'atlas.gallery' });
  router.urlService.rules.otherwise({ state: 'atlas.notFound' });
  return router;
}
