import { visitWithFeatures } from '../support/e2e';

// @api-viewer/docs is imported dynamically behind `enable-api-docs`, so the
// element upgrades a tick after the template renders — the retries cover it.
describe('api docs viewer', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('lazy-loads the element definition and renders its tabs', () => {
    visitWithFeatures('/home', { 'enable-api-docs': 'true' });

    cy.get('api-docs')
      .should(($el) => {
        expect($el[0].shadowRoot, '<api-docs> upgraded').to.not.equal(null);
      })
      .shadow()
      .find('api-viewer-tab')
      .should('have.length.greaterThan', 0);

    cy.get('api-docs').shadow().contains('api-viewer-tab', 'Properties');
    cy.get('api-docs').shadow().contains('api-viewer-tab', 'Attributes');
  });

  it('never loads the element when the flag is off', () => {
    visitWithFeatures('/home', { 'enable-api-docs': 'false' });

    cy.contains('a.btn', 'Contacts').should('have.attr', 'href');
    cy.get('api-docs').should('not.exist');
    cy.window().then((win) => {
      expect(
        win.customElements.get('api-docs'),
        'api-docs not defined',
      ).to.equal(undefined);
    });
  });
});
