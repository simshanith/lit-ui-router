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
