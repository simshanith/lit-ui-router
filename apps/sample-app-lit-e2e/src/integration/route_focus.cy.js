import { visitWithFeatures } from '../support/e2e';

const EMAIL_ADDRESS = 'myself@angular.dev';

const APP_TITLE = 'UI-Router Lit sample app';

const { ENTER, TAB } = Cypress.Keyboard.Keys;

const subjectLink = (row) => cy.get('table tbody tr').eq(row).find('a');

/**
 * Focus stays on what the user activated within a section, and moves to the
 * new view's h1 on a section change — in every location mode, so the Navigation
 * API's default focus reset must not leak through.
 */
describe('focus and titles across route changes', () => {
  let appConfig = null;

  beforeEach(() => {
    const applyAppConfig = () => {
      window.sessionStorage.clear();
      window.sessionStorage.setItem('appConfig', appConfig);
    };

    if (!appConfig) {
      visitWithFeatures('/login');
      cy.get('select')
        .contains('myself')
        .parent('select')
        .select(EMAIL_ADDRESS);
      cy.get('button').contains('Log in').click();
      cy.url()
        .should('include', '/home')
        .then(() => {
          appConfig = sessionStorage.getItem('appConfig');
        })
        .then(applyAppConfig);
    } else {
      applyAppConfig();
    }
  });

  it('keeps focus on a message subject opened with Enter', () => {
    visitWithFeatures('/mymessages');
    cy.url().should('include', '/mymessages/inbox');
    cy.title().should('eq', `Inbox — ${APP_TITLE}`);

    subjectLink(0).focus();
    cy.press(ENTER);
    cy.url().should('match', /\/inbox\/.+/);
    cy.get('.message h2')
      .invoke('text')
      .then((subject) => {
        cy.title().should('eq', `${subject.trim()} — ${APP_TITLE}`);
      });

    subjectLink(0).then(($link) => {
      cy.focused().should(($focused) => {
        expect($focused[0]).to.equal($link[0]);
      });
    });

    cy.press(TAB);
    subjectLink(1).then(($link) => {
      cy.focused().should(($focused) => {
        expect($focused[0]).to.equal($link[0]);
      });
    });
  });

  it('focuses the heading of a section opened from the nav tabs', () => {
    visitWithFeatures('/mymessages');
    cy.url().should('include', '/mymessages/inbox');

    cy.contains('nav a', 'Contacts').focus();
    cy.press(ENTER);
    cy.url().should('include', '/contacts');
    cy.focused().should('match', 'main h1').and('have.text', 'Contacts');
    cy.title().should('eq', `Contacts — ${APP_TITLE}`);
  });
});
