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

// Seeds session storage, not the query string: hash routing never rewrites location.search, so a query param would pin the flag as URL-overridden (select disabled) all session.
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
  const url = query
    ? isHashMode
      ? `?${query}#${path}`
      : `${path}?${query}`
    : isHashMode
      ? `#${path}`
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
