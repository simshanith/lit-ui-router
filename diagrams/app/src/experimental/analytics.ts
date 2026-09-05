/**
 * EXPERIMENTAL — one page_view per successful transition.
 *
 * The gtag snippet itself is injected at STAGE time (generator/stage-site.mjs)
 * and only when VITE_GOOGLE_ANALYTICS_TRACKING_ID is set, so this module never
 * loads a tracker: it only reports to one the page already has. The stock
 * snippet counts the first load; every SPA navigation after that is invisible
 * to it, hence onSuccess — the url in the address bar is final by then.
 */
import type { UIRouterLit } from 'lit-ui-router';

type Gtag = (command: 'event', name: 'page_view', params: Record<string, string>) => void;

export function installAnalytics(router: UIRouterLit): void {
  router.transitionService.onSuccess({}, () => {
    const gtag = (window as Window & { gtag?: Gtag }).gtag;
    if (!gtag) return;
    gtag('event', 'page_view', {
      page_location: location.href,
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  });
}
