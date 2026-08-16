import { visitWithFeatures } from '../support/e2e';

const EMAIL_ADDRESS = 'myself@angular.dev';
const CONTACT = 'Delia Hunter';

/**
 * Navigation controls are anchors and carry an href; plain actions, and the
 * three controls that cannot be links, stay buttons and carry none.
 *
 * The button/anchor split is the point — asserting `contains(...)` alone would
 * pass either way, so every assertion here names the element.
 */
describe('link semantics', () => {
  let appConfig = null;
  const warnings = [];

  beforeEach(() => {
    warnings.length = 0;
    // captures uiSref's assignHref warning, which only fires in lit's dev
    // build. an event hook rather than visit's onBeforeLoad, so it composes
    // with visitWithFeatures' own (which seeds the location plugin)
    cy.on('window:before:load', (win) => {
      const warn = win.console.warn;
      win.console.warn = (...args) => {
        warnings.push(args.join(' '));
        warn.apply(win.console, args);
      };
    });

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

  const expectNoAssignHrefWarning = () =>
    cy
      .wrap(warnings)
      .should((all) => expect(all.join('\n')).not.to.contain('assignHref'));

  it('renders the home tiles as anchors with hrefs', () => {
    visitWithFeatures('/home');
    ['Messages', 'Contacts', 'Preferences'].forEach((label) => {
      // contains(selector, text) yields the anchor; get().contains(text)
      // would narrow to the deepest descendant holding the text
      cy.contains('a.btn', label).should('have.attr', 'href');
    });
    cy.get('.home.buttons button').should('not.exist');
    cy.screenshot('home-tiles');
  });

  it('renders the welcome buttons as anchors with hrefs', () => {
    visitWithFeatures('/welcome');
    cy.contains('a.btn', 'Messages').should('have.attr', 'href');
    cy.contains('a.btn', 'Contacts').should('have.attr', 'href');
    cy.contains('a.btn', 'Preferences').should('have.attr', 'href');
    cy.screenshot('welcome');
  });

  it('navigates on a plain click of a converted control', () => {
    visitWithFeatures('/welcome');
    cy.contains('a.btn', 'Contacts').click();
    cy.url().should('include', '/contacts');
  });

  it('renders one New Contact control, an anchor with an href', () => {
    visitWithFeatures('/contacts');
    // the nested <a><button> gave two tab stops; there is one control now
    cy.contains('a.btn', 'New Contact').should('have.attr', 'href');
    cy.get('button').contains('New Contact').should('not.exist');
    cy.screenshot('contact-list');
  });

  it('keeps Edit Contact an anchor and Message a button', () => {
    visitWithFeatures('/contacts');
    cy.contains(CONTACT).click();

    cy.contains('a.btn', 'Edit Contact').should('have.attr', 'href');

    // mymessages.compose takes a non-url `message` param, so an href here
    // would be a lossy link — assignHref: 'auto' withholds it
    // not.have.attr yields the attribute value, so re-query before clicking
    cy.contains('button.btn', 'Message').should('not.have.attr', 'href');
    cy.contains('button.btn', 'Message').click();
    cy.url().should('include', '/compose');
  });

  it('keeps Cancel a button with no href, and it still navigates', () => {
    visitWithFeatures('/contacts');
    cy.contains(CONTACT).click();
    cy.contains('a.btn', 'Edit Contact').click();
    cy.url().should('include', 'edit');

    cy.contains('button.btn', 'Cancel').should('not.have.attr', 'href');
    cy.contains('button.btn', 'Cancel').click();
    cy.url().should('not.include', 'edit');
  });

  it('keeps message rows as <tr> with no href, and they still navigate', () => {
    visitWithFeatures('/mymessages');
    cy.url().should('include', '/mymessages/inbox');
    cy.get('table tbody tr').first().should('not.have.attr', 'href');
    cy.get('table tbody tr').first().click();
    cy.url().should('match', /\/inbox\/.+/);
    cy.screenshot('message-list');
  });

  it('logs no assignHref warning on any of these views', () => {
    visitWithFeatures('/home');
    cy.contains('Messages');
    expectNoAssignHrefWarning();

    visitWithFeatures('/contacts');
    cy.contains('New Contact');
    expectNoAssignHrefWarning();

    visitWithFeatures('/mymessages');
    cy.get('table tbody tr').should('exist');
    expectNoAssignHrefWarning();
  });
});
