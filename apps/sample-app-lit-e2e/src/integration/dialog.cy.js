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

  // Render/design assertions (modal `in` class, backdrop dim, centering,
  // card width, deny-closes) live in the component spec:
  // apps/sample-app-shared/src/app/global/Dialog.spec.ts

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
