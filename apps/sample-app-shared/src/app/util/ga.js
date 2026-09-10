import { resolveLocationPlugin } from './featureDetection.js';

const GOOGLE_ANALYTICS_TRACKING_ID = import.meta.env
  .VITE_GOOGLE_ANALYTICS_TRACKING_ID;

function initGoogleAnalytics() {
  (function (i, s, o, g, r, a, m) {
    a = s.createElement(o);
    m = s.getElementsByTagName(o)[0];
    a.async = 1;
    a.src = g;
    m.parentNode.insertBefore(a, m);
    i[r] = i[r] || [];
  })(
    window,
    document,
    'script',
    `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_TRACKING_ID}`,
    'dataLayer',
  );
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GOOGLE_ANALYTICS_TRACKING_ID);
}

if (GOOGLE_ANALYTICS_TRACKING_ID) {
  initGoogleAnalytics();
}

/** The navigation kinds gtag's history hooks never observe. */
const UNSEEN_BY_GTAG = new Set(['push', 'replace']);

/**
 * Installs a second, NON-intercepting `navigate` listener beside the
 * interceptor in `router.config.ts`, and returns a take-once reader for the
 * last navigation kind. Take-once so a transition that ran without a `navigate`
 * event cannot reuse an earlier one's kind.
 */
function recordNavigationType() {
  let last = '';
  window.navigation.addEventListener('navigate', (event) => {
    last = event.navigationType;
  });
  return () => {
    const seen = last;
    last = '';
    return seen;
  };
}

/**
 * Whether this transition is one gtag cannot count for itself. Enhanced
 * measurement's history-events toggle is ON for the stream, so gtag patches
 * `history.pushState`/`replaceState`, listens for `popstate`, and counts the
 * initial load from its own `config` call. Send exactly the gaps and nothing
 * else, or the stream double-counts.
 */
function pageViewIsOurs(locationPlugin, takeNavigationType) {
  // hash: history is never touched, so every move is ours.
  if (locationPlugin === 'hash') return true;
  // navigation: `navigation.navigate()` bypasses the patched history methods,
  // but a traverse still fires popstate and the cold load is gtag's `config`.
  if (locationPlugin === 'navigation') {
    return UNSEEN_BY_GTAG.has(takeNavigationType());
  }
  // pushState: gtag already sees load, pushes and traversals.
  return false;
}

function trackPageView(event, isOurs) {
  if (!event) {
    return;
  }
  if (!isOurs) {
    console.debug('manual gtag page_view tracking skipped', event);
    return;
  }
  if (!window.gtag) {
    return;
  }
  console.debug('gtag page_view', event);
  window.gtag('event', 'page_view', event);
}

function trackException(event) {
  if (!event || !window.gtag) {
    return;
  }
  console.debug('gtag exception', event);
  window.gtag('event', 'exception', event);
}

export default function googleAnalyticsHook(transitionService) {
  const locationPlugin = resolveLocationPlugin();
  const takeNavigationType =
    locationPlugin === 'navigation' ? recordNavigationType() : () => '';

  const path = (trans) => {
    // States declared without a url (the 404 state) have no UrlMatcher to
    // format; their attempted path is already in location.pathname.
    const urlMatcher = trans.$to().url;
    const formattedRoute = urlMatcher ? urlMatcher.format(trans.params()) : '';
    // Under hash the route lives in the fragment, so location.pathname is the
    // bare mount and the formatted route completes it. Under pushState and the
    // Navigation API the pathname already carries the route, and concatenating
    // would double it (/app/home/home).
    const withSitePrefix =
      locationPlugin === 'hash'
        ? location.pathname + formattedRoute
        : location.pathname;
    return `/${withSitePrefix
      .split('/')
      .filter((x) => x)
      .join('/')}`;
  };

  const error = (trans) => {
    const err = trans.error();
    const type =
      err && Object.prototype.hasOwnProperty.call(err, 'type') ? err.type : '_';
    const message =
      err && Object.prototype.hasOwnProperty.call(err, 'message')
        ? err.message
        : '_';
    if (type === 6) {
      trackException({
        error_description: message,
        fatal: false,
      });
    }
  };

  transitionService.onSuccess(
    {},
    (trans) =>
      // read the kind first: it must be consumed on every transition, sent or not
      trackPageView(
        {
          page_location: path(trans),
        },
        pageViewIsOurs(locationPlugin, takeNavigationType),
      ),
    {
      priority: -10000,
    },
  );
  transitionService.onError({}, (trans) => error(trans), { priority: -10000 });
}
