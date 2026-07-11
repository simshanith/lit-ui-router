// Feature param for location plugin (settable via `cypress run --expose LOCATION_PLUGIN=hash`)
export const LOCATION_PLUGIN =
  // Cypress.expose(key) is typed `any`.
  (Cypress.expose('LOCATION_PLUGIN') as string | undefined) || '';

function featureQuery(features: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(features)) {
    params.set(`feature-${key}`, value);
  }

  const locationPlugin: string = features['location-plugin'] || LOCATION_PLUGIN;
  // Add default location plugin if set and not already specified
  if (locationPlugin) {
    params.set('feature-location-plugin', locationPlugin);
  }

  return { query: params.toString(), isHashMode: locationPlugin === 'hash' };
}

export function visitWithFeatures(
  path: string,
  features: Record<string, string> = {},
) {
  const { query, isHashMode } = featureQuery(features);
  const url = query
    ? isHashMode
      ? `?${query}#${path}`
      : `${path}?${query}`
    : isHashMode
      ? `#${path}`
      : path;
  return cy.visit(url);
}

/**
 * Visits the app root with no trailing slash (`/app`, not `/app/`) — the entry
 * the docs site links to. `baseUrl` carries the trailing slash, so the root
 * can't be reached with a relative `cy.visit`.
 */
export function visitRootWithFeatures(features: Record<string, string> = {}) {
  const { query } = featureQuery(features);
  const root = (Cypress.config('baseUrl') ?? '').replace(/\/+$/, '');
  return cy.visit(query ? `${root}?${query}` : root);
}

interface UIRouterElement extends HTMLElement {
  uiRouter?: { urlService: { url: (newUrl: string) => void } };
}

/**
 * Drives a client-side URL change through the running app's router, like an
 * in-app link. Direct loads of unmatched URLs get the server 404 instead
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
      element.uiRouter!.urlService.url(path);
    });
}
