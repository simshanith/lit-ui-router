import {
  LOCATION_PLUGIN,
  visitRootWithFeatures,
  visitWithFeatures,
} from '../support/e2e';

describe('404 not found', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('routes the app root to welcome, not the 404 page', () => {
    visitRootWithFeatures();
    cy.contains('Welcome to the sample app!');
    cy.contains('404 Page Not Found').should('not.exist');
    cy.url().should('include', '/welcome');
  });

  // HashLocationService._set ignores the replace flag, so the root keeps its
  // history entry and Back re-resolves it to welcome in place, never reaching
  // the login entry. The 404 regression this pins is pushState/navigation only.
  const itPushesState = LOCATION_PLUGIN === 'hash' ? it.skip : it;

  itPushesState('does not 404 when navigating back to the app root', () => {
    visitWithFeatures('/login');
    visitRootWithFeatures();
    cy.contains('Welcome to the sample app!');

    // The root replaced its history entry, so Back skips it for the login page.
    // Without that, Back re-syncs the root, where otherwise() renders the 404.
    cy.go('back');
    cy.contains('Log In');
    cy.contains('404 Page Not Found').should('not.exist');
  });

  it('shows the 404 page for an unmatched URL', () => {
    visitWithFeatures('/no/such/page');
    cy.contains('404 Page Not Found');
    cy.get('code').contains('/no/such/page');
    // The unmatched URL stays in the address bar (the 404 state has no url)
    cy.url().should('include', '/no/such/page');
  });

  it('links back to the welcome page', () => {
    visitWithFeatures('/no/such/page');
    cy.contains('404 Page Not Found');
    cy.get('button').contains('Return to Welcome').click();
    cy.url().should('include', '/welcome');
    cy.contains('Welcome to the sample app!');
  });

  it('does not intercept future state URLs (lazy loading still works)', () => {
    // /mymessages matches the mymessages.** future state's wildcard rule, so
    // it must lazy load (then redirect to login via requiresAuth), not 404
    visitWithFeatures('/mymessages');
    cy.contains('Log In');
    cy.contains('404 Page Not Found').should('not.exist');
  });

  it('shows the 404 page for URLs unmatched after a future state lazy loads', () => {
    // matches the contacts.** wildcard prefix, so the module lazy loads;
    // after the re-sync no contacts state matches this URL, so otherwise fires
    visitWithFeatures('/contacts/no/such/contact');
    cy.contains('404 Page Not Found');
    cy.get('code').contains('/contacts/no/such/contact');
  });
});
