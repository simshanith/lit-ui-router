/**
 * The client half of src/routes.ts: the same names and urls, with components
 * and resolves hung off them.
 */
import { hashLocationPlugin, pushStateLocationPlugin } from '@uirouter/core';
import type { Transition } from '@uirouter/core';
import { UIRouterLit } from 'lit-ui-router/pure';
import type { LitStateDeclaration } from 'lit-ui-router';
import { navigationLocationPlugin } from 'ui-router-navigation-location-plugin';
import type { UIRouterNavigateEvent } from 'ui-router-navigation-location-plugin';
import { ARTIFACT } from './mode.ts';
import { FILTER_PARAMS, FOCUS_PARAMS, SHEET_ALIASES, urlOf } from './routes.ts';
import type { ExtraRow, Manifest, SheetRow } from './manifest.ts';
import { findExtra, findSheet } from './manifest.ts';
import { loadFragment, loadManifest } from './runtime.ts';
import { titleFor } from './titles.ts';
import {
  AboutView,
  BricksView,
  CityView,
  GalleryView,
  LogView,
  NotFoundView,
  SheetView,
  ShellView,
  SpecimenView,
} from './views.ts';

/**
 * A 3D plate's state, `atlas.<id>`: the city and its working twin share the
 * view, the element and the generated wiring, and differ only in their row.
 */
function sceneState(id: string): LitStateDeclaration {
  const name = `atlas.${id}`;
  return {
    name,
    url: urlOf(name),
    params: FOCUS_PARAMS,
    component: CityView,
    // DEPENDENCIES ON DEMAND: the <model-viewer> element is a resolve, so the
    // router fetches its chunk (and the three.js it carries) while it enters the
    // state, and no route without a model ever pays for it. The wiring is a
    // generated module (src/generated/city-init.js) handed the module resolved here.
    resolve: [
      {
        token: 'extra',
        deps: ['manifest'],
        resolveFn: (manifest: Manifest): ExtraRow => {
          const row = findExtra(manifest, id);
          if (!row) throw new Error(`no ${id} row in the manifest`);
          return row;
        },
      },
      {
        token: 'fragment',
        deps: ['extra'],
        resolveFn: (extra: ExtraRow): Promise<string> => loadFragment(extra),
      },
      { token: 'viewer', resolveFn: (): Promise<unknown> => import('@google/model-viewer') },
    ],
  };
}

export const states: LitStateDeclaration[] = [
  {
    name: 'atlas',
    abstract: true,
    component: ShellView,
    // Resolved once for the whole shell; children read it through their own
    // deps, and the runtime's DrawingSet reads it once, so the rail costs one fetch.
    resolve: [{ token: 'manifest', resolveFn: loadManifest }],
  },
  // The key index's filter rides the url: same params as the server half.
  {
    name: 'atlas.gallery',
    url: urlOf('atlas.gallery'),
    params: FILTER_PARAMS,
    component: GalleryView,
  },
  {
    name: 'atlas.sheet',
    url: urlOf('atlas.sheet'),
    params: FOCUS_PARAMS,
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
  sceneState('city'),
  sceneState('plant'),
  {
    name: 'atlas.bricks',
    url: urlOf('atlas.bricks'),
    params: FOCUS_PARAMS,
    component: BricksView,
    // DEPENDENCIES ON DEMAND: the same <model-viewer> resolve as the city's, so
    // the element's chunk is fetched by the plates in the round and no other state;
    // the wiring is a generated module (src/generated/bricks-init.js).
    resolve: [
      {
        token: 'extra',
        deps: ['manifest'],
        resolveFn: (manifest: Manifest): ExtraRow => {
          const row = findExtra(manifest, 'bricks');
          if (!row) throw new Error('no bricks row in the manifest');
          return row;
        },
      },
      {
        token: 'fragment',
        deps: ['extra'],
        resolveFn: (extra: ExtraRow): Promise<string> => loadFragment(extra),
      },
      { token: 'viewer', resolveFn: (): Promise<unknown> => import('@google/model-viewer') },
    ],
  },
  {
    name: 'atlas.specimen',
    url: urlOf('atlas.specimen'),
    component: SpecimenView,
    // DEPENDENCIES ON DEMAND, again: the specimen's element — its mock sheet's
    // whole stylesheet, and the Google Fonts <link> its connectedCallback
    // injects — is a resolve, so the webfonts are fetched by this state and by
    // no other page in the app.
    resolve: [
      {
        token: 'specimen',
        resolveFn: (): Promise<unknown> => import('./specimen.ts'),
      },
    ],
  },
  {
    name: 'atlas.office',
    url: urlOf('atlas.office'),
    redirectTo: { state: 'atlas.sheet', params: { num: 'A2' } },
  },
  { name: 'atlas.about', url: urlOf('atlas.about'), component: AboutView },
  // The issue log reads the shell's already-resolved manifest — no resolve of
  // its own, and no second fetch.
  { name: 'atlas.log', url: urlOf('atlas.log'), component: LogView },
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

/**
 * Whether the navigation under way is a traverse. The browser restores a
 * traverse's own scroll position; every other new page starts at the top.
 */
let traversing = false;
if (NAVIGATION_API) {
  (window as Window & { navigation: Navigation }).navigation.addEventListener(
    'navigate',
    (event) => {
      traversing = event.navigationType === 'traverse';
    },
  );
}

/** A new page starts at the top. */
export function scrollToTop(): void {
  if (traversing) return;
  window.scrollTo({ top: 0 });
}

/**
 * Holds the top through the frames after a view swap: Mobile Safari's scrolling
 * thread puts the offset it last knew back, clamped to the new page, over a
 * scroll made before the swap committed. Under a held view-transition snapshot
 * the frames run once it is released, which is when that happens.
 */
export function holdTop(): void {
  let frames = 12;
  const tick = (): void => {
    scrollToTop();
    if (--frames > 0) requestAnimationFrame(tick);
  };
  tick();
}

/** A dynamic param change such as `focus`: no state entered or exited. */
export function isParamOnlyChange(transition: Transition): boolean {
  return transition.entering().length === 0 && transition.exiting().length === 0;
}

/**
 * A change that keeps the reader on the page: a dynamic param, or a filter
 * change inside the key index — the gallery is deliberately not dynamic
 * (routes.ts), so a chip re-enters it, a re-render rather than a page change.
 * Stated once here because ui-router's hook criteria have no "every pair but
 * this one" form, so the scroll and the slideshow test this same predicate.
 */
export function isInPlaceChange(transition: Transition): boolean {
  if (isParamOnlyChange(transition)) return true;
  return transition.from().name === 'atlas.gallery' && transition.to().name === 'atlas.gallery';
}

export function createRouter(): UIRouterLit {
  const router = new UIRouterLit();
  if (ARTIFACT) router.plugin(hashLocationPlugin);
  else if (!NAVIGATION_API) router.plugin(pushStateLocationPlugin);
  else {
    // The plugin intercepts its own navigate() calls and asks for the options
    // once the transition has committed, so the tail of successfulTransitions
    // is this navigation's; an in-place change keeps the reader's scroll and focus.
    router.plugin(navigationLocationPlugin, {
      intercept: (event: UIRouterNavigateEvent): NavigationInterceptOptions => {
        const committed = event.info.uiRouter.globals.successfulTransitions.peekTail();
        const inPlace = committed && isInPlaceChange(committed);
        return {
          scroll: inPlace ? 'manual' : 'after-transition',
          focusReset: inPlace ? 'manual' : 'after-transition',
        };
      },
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
  // An aliased id ('14') redirects the same way, to the plate it names.
  router.transitionService.onBefore({ to: 'atlas.sheet' }, async (transition) => {
    const manifest = await loadManifest();
    const num = String(transition.params().num);
    const row = findSheet(manifest, SHEET_ALIASES[num] ?? num);
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
    // An in-place change stays on the page it re-renders; everything else is a
    // new page and starts at the top.
    if (!isInPlaceChange(transition)) {
      scrollToTop();
      void document.querySelector('ui-view')?.updateComplete.then(holdTop);
    }
    // The prerendered pages carry these titles; the SPA keeps them current.
    const to = transition.to().name;
    const sheet =
      to === 'atlas.sheet' ? (transition.injector().get('sheet') as SheetRow) : undefined;
    document.title = titleFor(to, sheet);
  });

  // CONSUMER FINDING: `initial({ state })` matches the path alone and targets
  // the state with NO params, so a first load of /?subject=city landed on the
  // unfiltered gallery with the query erased. The function form hands the
  // search through; the key index's deep links depend on it.
  router.urlService.rules.initial((_match, url) => ({
    state: 'atlas.gallery',
    params: url?.search ?? {},
  }));
  router.urlService.rules.otherwise({ state: 'atlas.notFound' });
  return router;
}
