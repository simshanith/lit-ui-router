// Feature param for location plugin (can be set via Cypress env)
export const LOCATION_PLUGIN = Cypress.env('LOCATION_PLUGIN') || '';

export function visitWithFeatures(
  path: string,
  features: Record<string, string> = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(features)) {
    params.set(`feature-${key}`, value);
  }

  const locationPlugin: string = features['location-plugin'] || LOCATION_PLUGIN;
  // Add default location plugin if set and not already specified
  if (locationPlugin) {
    params.set('feature-location-plugin', locationPlugin);
  }
  const isHashMode = locationPlugin === 'hash';
  const query = params.toString();
  const url = query ?
                  isHashMode ? `?${query}#${path}` : `${path}?${query}` :
                  isHashMode ? `#${path}`          : path;
  return cy.visit(url);
}

// Global hooks that run after all tests
after(() => {
  console.log('All test suites completed');
  cy.request('/e2e-done', { failOnStatusCode: false, timeout: 0 });
});
