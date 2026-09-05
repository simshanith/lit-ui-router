/**
 * The client half of src/routes.ts: the same names and urls, with components
 * and resolves hung off them.
 */
import { pushStateLocationPlugin } from '@uirouter/core';
import type { Transition } from '@uirouter/core';
import { UIRouterLit } from 'lit-ui-router';
import type { LitStateDeclaration } from 'lit-ui-router';
import { navigationLocationPlugin } from 'ui-router-navigation-location-plugin';
import { urlOf } from './routes.ts';
import type { Manifest, SheetRow } from './manifest.ts';
import { findSheet, loadFragment, loadManifest } from './manifest.ts';
import {
  AboutView,
  GalleryView,
  MegacanvasView,
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
          const row = findSheet(manifest, String(transition.params()['num']));
          // The onBefore guard below has already turned an unknown number
          // into a redirect; this only keeps the type honest.
          if (!row) throw new Error(`no sheet ${String(transition.params()['num'])}`);
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
    name: 'atlas.megacanvas',
    url: urlOf('atlas.megacanvas'),
    // Dynamic, so panning the reel never re-runs the resolve below.
    params: { at: { value: null, dynamic: true } },
    component: MegacanvasView,
    resolve: [
      {
        token: 'megacanvas',
        deps: ['manifest'],
        resolveFn: async (manifest: Manifest): Promise<string> =>
          (await Promise.all(manifest.sheets.map(loadFragment))).join('\n'),
      },
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

export function createRouter(): UIRouterLit {
  const router = new UIRouterLit();
  // The Navigation API where it exists, pushState everywhere else — the
  // pairing the location-plugins guide recommends. Both produce /app/sheet/7.
  router.plugin(
    typeof window !== 'undefined' && 'navigation' in window
      ? navigationLocationPlugin
      : pushStateLocationPlugin,
  );

  for (const state of states) router.stateRegistry.register(state);

  // An unknown sheet number is a miss, not a broken resolve: redirect to the
  // url-less notFound state WITHOUT moving the address bar.
  router.transitionService.onBefore({ to: 'atlas.sheet' }, async (transition) => {
    const manifest = await loadManifest();
    if (findSheet(manifest, String(transition.params()['num']))) return true;
    return router.stateService.target('atlas.notFound', undefined, {
      location: false,
    });
  });

  router.transitionService.onSuccess({}, () => {
    window.scrollTo({ top: 0 });
  });

  router.urlService.rules.initial({ state: 'atlas.gallery' });
  router.urlService.rules.otherwise({ state: 'atlas.notFound' });
  return router;
}
