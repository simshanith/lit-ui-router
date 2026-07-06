import { visitWithFeatures } from '../support/e2e';

const EMAIL_ADDRESS = 'myself@angular.dev';

const readStoredFlags = (win) =>
  JSON.parse(win.sessionStorage.getItem('featureFlags') ?? '{}');

describe('feature flags panel', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    visitWithFeatures('/login');
    cy.get('select').contains('myself').parent('select').select(EMAIL_ADDRESS);
    cy.get('button').contains('Log in').click();
    cy.url().should('include', '/home');

    cy.get('button.btn').contains('Preferences').click();
    cy.contains('Reset All Data');
    cy.get('feature-flags-panel')
      .shadow()
      .find('select')
      .first()
      .as('pluginSelect');
  });

  it('stores an explicit location plugin selection', () => {
    cy.get('@pluginSelect').select('Hash');
    cy.window().then((win) => {
      expect(readStoredFlags(win)['location-plugin']).to.equal('hash');
    });
  });

  it('removes the stored preference when Auto-detect is selected', () => {
    cy.get('@pluginSelect').select('Hash');
    cy.get('@pluginSelect').select('Auto-detect');
    cy.window().then((win) => {
      expect(readStoredFlags(win)).to.not.have.property('location-plugin');
    });
  });
});
