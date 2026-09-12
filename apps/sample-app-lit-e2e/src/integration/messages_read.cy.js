import { visitWithFeatures } from '../support/e2e';

const EMAIL_ADDRESS = 'myself@angular.dev';

const unreadRows = () =>
  cy.get('table tbody tr').filter(':has(td i.fa-circle)');

// the list stays mounted across message opens (#755), so the read column must re-render off the store commit
describe('unread dots in the message list', () => {
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

  it('clears the unread dot of an opened message while the list stays mounted', () => {
    visitWithFeatures('/mymessages/inbox');
    cy.url().should('include', '/mymessages/inbox');

    // the inbox ships three messages, all unread
    unreadRows().should('have.length', 3);

    // open the first unread message
    unreadRows().first().click();
    cy.url().should('match', /\/mymessages\/inbox\/[\w-]+$/);
    cy.get('table tbody tr.active td i.fa-circle').should('not.exist');
    unreadRows().should('have.length', 2);

    // messageId -> messageId without leaving the list
    unreadRows().first().click();
    cy.url().should('match', /\/mymessages\/inbox\/[\w-]+$/);
    cy.get('table tbody tr.active td i.fa-circle').should('not.exist');
    unreadRows().should('have.length', 1);
  });
});
