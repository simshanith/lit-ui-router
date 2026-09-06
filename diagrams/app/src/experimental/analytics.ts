/**
 * EXPERIMENTAL — the page_views gtag CANNOT see for itself, and no others.
 *
 * The atlas shares the flagship's GA stream, and that stream keeps enhanced
 * measurement's "page changes based on browser history events" ON. gtag
 * therefore counts the initial load itself and hooks pushState / replaceState /
 * popstate, so the rule this module follows is: send exactly when the router
 * moved in a way gtag's hooks cannot observe. That is one case — the
 * Navigation API location plugin, whose `navigation.navigate()` never touches
 * `history.pushState`. Under the pushState fallback gtag already counts every
 * move, so nothing is sent at all; and inside the Navigation API path a
 * `traverse` (back / forward) still fires popstate, which gtag counts, so only
 * `push` and `replace` are ours. The initial load has no `navigate` event and
 * is gtag's. The gtag snippet itself is injected at STAGE time
 * (generator/stage-site.mjs) and only when VITE_GOOGLE_ANALYTICS_TRACKING_ID is
 * set, so this module never loads a tracker: it reports to one the page has.
 * onSuccess, because the address bar is final by then — and it runs after the
 * router's own onSuccess, which has already set document.title.
 */
import type { UIRouterLit } from 'lit-ui-router';
import { NAVIGATION_API } from '../router.ts';

type Gtag = (command: 'event', name: 'page_view', params: Record<string, string>) => void;

/** The navigation kinds gtag's history hooks never see. */
const OURS = new Set(['push', 'replace']);

export function installAnalytics(router: UIRouterLit): void {
  // Under the pushState fallback every move is already gtag's.
  if (!NAVIGATION_API) return;

  // A SECOND listener, beside router.ts's interceptor: this one only records.
  let kind = '';
  window.navigation.addEventListener('navigate', (event) => {
    kind = event.navigationType;
  });

  router.transitionService.onSuccess({}, () => {
    const seen = kind;
    kind = '';
    if (!OURS.has(seen)) return;
    const gtag = (window as Window & { gtag?: Gtag }).gtag;
    if (!gtag) return;
    gtag('event', 'page_view', {
      page_location: location.href,
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  });
}
