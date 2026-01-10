const GOOGLE_ANALYTICS_TRACKING_ID = import.meta.env
  .VITE_GOOGLE_ANALYTICS_TRACKING_ID;

function initGoogleAnalytics() {
  (function (i, s, o, g, r, a, m) {
    ((a = s.createElement(o)), (m = s.getElementsByTagName(o)[0]));
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

function trackPageView(event) {
  if (!event || !window.gtag) {
    return;
  }
  if (import.meta.env.VITE_SAMPLE_APP_PUSH_STATE) {
    console.debug('manual gtag page_view tracking skipped', event);
  } else {
    console.debug('gtag page_view', event);
    window.gtag('event', 'page_view', event);
  }
}

function trackException(event) {
  if (!event || !window.gtag) {
    return;
  }
  console.debug('gtag exception', event);
  window.gtag('event', 'exception', event);
}

export default function googleAnalyticsHook(transitionService) {
  const path = (trans) => {
    const formattedRoute = trans.$to().url.format(trans.params());
    const withSitePrefix = location.pathname + formattedRoute;
    return `/${withSitePrefix
      .split('/')
      .filter((x) => x)
      .join('/')}`;
  };

  const error = (trans) => {
    const err = trans.error();
    const type = err && err.hasOwnProperty('type') ? err.type : '_';
    const message = err && err.hasOwnProperty('message') ? err.message : '_';
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
      trackPageView({
        page_location: path(trans),
      }),
    {
      priority: -10000,
    },
  );
  transitionService.onError({}, (trans) => error(trans), { priority: -10000 });
}
