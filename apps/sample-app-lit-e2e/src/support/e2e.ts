// Suite-wide location plugin (settable via `cypress run --expose LOCATION_PLUGIN=hash`)
export const LOCATION_PLUGIN =
  // Cypress.expose(key) is typed `any`.
  (Cypress.expose('LOCATION_PLUGIN') as string | undefined) || '';

function featureQuery(features: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(features)) {
    params.set(`feature-${key}`, value);
  }

  const locationPlugin: string = features['location-plugin'] || LOCATION_PLUGIN;
  return { query: params.toString(), isHashMode: locationPlugin === 'hash' };
}

// hash routing never rewrites location.search, so a query param would pin the flag as URL-overridden
function seedLocationPlugin(win: Cypress.AUTWindow) {
  if (!LOCATION_PLUGIN) return;
  const flags = JSON.parse(
    win.sessionStorage.getItem('featureFlags') ?? '{}',
  ) as Record<string, unknown>;
  flags['location-plugin'] = LOCATION_PLUGIN;
  win.sessionStorage.setItem('featureFlags', JSON.stringify(flags));
}

export function visitWithFeatures(
  path: string,
  features: Record<string, string> = {},
) {
  const { query, isHashMode } = featureQuery(features);
  // Hash-mode visits target the bare mount (`/app-hash`, not `/app-hash/`):
  // the dedicated hash mount serves the shell at 200 there with no redirect
  // (the flagship mounts 302 their root to /welcome, which would rewrite the
  // path under the hash on every visit — the reason hash mode gets its own
  // mount). Consecutive visits then differ only by hash, as hash routing
  // intends.
  const root = (Cypress.config('baseUrl') ?? '').replace(/\/+$/, '');
  const url = query
    ? isHashMode
      ? `${root}?${query}#${path}`
      : `${path}?${query}`
    : isHashMode
      ? `${root}#${path}`
      : path;
  return cy.visit(url, { onBeforeLoad: seedLocationPlugin });
}

/**
 * Visits the app root with no trailing slash (`/app`, not `/app/`) — the entry
 * the docs site links to. `baseUrl` carries the trailing slash, so the root
 * can't be reached with a relative `cy.visit`.
 */
export function visitRootWithFeatures(features: Record<string, string> = {}) {
  const { query } = featureQuery(features);
  const root = (Cypress.config('baseUrl') ?? '').replace(/\/+$/, '');
  return cy.visit(query ? `${root}?${query}` : root, {
    onBeforeLoad: seedLocationPlugin,
  });
}

interface UIRouterElement extends HTMLElement {
  uiRouter?: {
    urlService: { url: (newUrl: string, replace?: boolean) => void };
  };
}

/**
 * Drives a client-side URL change through the running app's router, like an
 * in-app link. Direct loads of unmatched URLs get the static server 404
 * (see src/docs/docs_site.cy.js), so the in-router 404 is only reachable this way.
 */
export function syncUrl(path: string) {
  return cy
    .get('ui-router')
    .should(($el) => {
      const element = $el[0] as UIRouterElement;
      expect(element.uiRouter, 'ui-router element upgraded').to.be.an('object');
    })
    .then(($el) => {
      const element = $el[0] as UIRouterElement;
      // replace: false — url()'s default replace goes through replaceState in
      // the app's replace-aware hash service, which fires no hashchange, so
      // the router would never sync. A push navigates in every location mode.
      element.uiRouter!.urlService.url(path, false);
    });
}
