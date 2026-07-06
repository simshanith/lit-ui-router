import { visitWithFeatures } from '../support/e2e';

const EMAIL_ADDRESS = 'myself@angular.dev';

describe('confirmation dialog', () => {
  var _appConfig = null;
  beforeEach(() => {
    const applyAppConfig = () => {
      window.sessionStorage.clear();
      window.sessionStorage.setItem('appConfig', _appConfig);
    };

    if (!_appConfig) {
      visitWithFeatures('/login');
      cy.get('select')
        .contains('myself')
        .parent('select')
        .select(EMAIL_ADDRESS);
      cy.get('button').contains('Log in').click();
      cy.url()
        .should('include', '/home')
        .then(() => {
          _appConfig = sessionStorage.getItem('appConfig');
        })
        .then(applyAppConfig);
    } else {
      applyAppConfig();
    }
  });

  const openDeleteDialog = (name, id) => {
    visitWithFeatures('/contacts');
    cy.contains(name).click();
    cy.url().should('contain', id);
    cy.get('button').contains('Edit Contact').click();
    cy.url().should('contain', 'edit');
    cy.get('button').contains('Delete').click();

    cy.get('.dialog .content').as('dialog').should('be.visible');
    cy.get('@dialog').contains(`Delete contact: ${name}`);
    cy.get('@dialog').contains('Are you sure?');
  };

  it('renders the shared sample-app dialog design', () => {
    openDeleteDialog('Rios Sears', 'rsears');

    // white card horizontally centered over a dimmed backdrop
    cy.get('.dialog#modal').should('have.class', 'in');
    // dimmed backdrop (sits underneath the modal, so don't use `be.visible`)
    cy.get('.dialog .backdrop')
      .should('have.class', 'in')
      .and(($backdrop) => {
        expect(getComputedStyle($backdrop[0]).opacity).to.equal('0.5');
      });
    cy.get('.dialog .content').then(($content) => {
      const rect = $content[0].getBoundingClientRect();
      // Measure against the document's client width, not the configured
      // viewport: a classic (non-overlay) vertical scrollbar narrows the
      // layout area, shifting the centered card by half the scrollbar width.
      const layoutWidth = $content[0].ownerDocument.documentElement.clientWidth;
      const viewportCenter = layoutWidth / 2;
      const cardCenter = rect.left + rect.width / 2;
      expect(cardCenter).to.be.closeTo(viewportCenter, 2);
      expect(rect.width).to.be.lessThan(layoutWidth / 2);
    });
    cy.screenshot('delete-contact-dialog');

    cy.get('.dialog button').contains('No').click();
    cy.get('#backdrop').should('not.exist');
  });

  it('deletes the contact when confirmed', () => {
    openDeleteDialog('Delia Hunter', 'dhunter');

    cy.get('.dialog button').contains('Yes').click();
    cy.get('#backdrop').should('not.exist');
    cy.url().should('not.contain', 'dhunter');
    cy.get('.selectlist').contains('Delia Hunter').should('not.exist');
  });

  it('keeps the contact when dismissed by clicking outside', () => {
    openDeleteDialog('Underwood Owens', 'uowens');

    cy.get('.dialog#modal').click('bottom');
    cy.get('#backdrop').should('not.exist');
    cy.get('.selectlist').contains('Underwood Owens');
  });
});
