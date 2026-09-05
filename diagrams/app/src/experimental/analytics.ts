/**
 * EXPERIMENTAL — one page_view per successful transition.
 *
 * The gtag snippet itself is injected at STAGE time (generator/stage-site.mjs)
 * and only when VITE_GOOGLE_ANALYTICS_TRACKING_ID is set, so this module never
 * loads a tracker: it only reports to one the page already has. The staged
 * config sets send_page_view:false, so THIS hook owns every page_view — the
 * first transition included. onSuccess, because the address bar is final by
 * then. Enhanced measurement's history-change page_view (a stream setting)
 * only patches pushState; the Navigation API plugin bypasses it, and the
 * pushState fallback would double-count — turn that toggle off in the stream.
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
