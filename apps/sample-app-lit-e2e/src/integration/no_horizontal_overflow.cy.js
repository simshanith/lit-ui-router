import { visitWithFeatures } from '../support/e2e';

const EMAIL_ADDRESS = 'myself@angular.dev';

describe('logged-in layout', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    visitWithFeatures('/login');
    cy.get('select').contains('myself').parent('select').select(EMAIL_ADDRESS);
    cy.get('button').contains('Log in').click();
    cy.url().should('include', '/home');
  });

  ['/home', '/mymessages', '/contacts', '/prefs'].forEach((path) => {
    it(`fits the viewport width on ${path}`, () => {
      visitWithFeatures(path);
      cy.get('.navheader .nav-tabs').should('be.visible');

      cy.document().then((doc) => {
        const { clientWidth, scrollWidth } = doc.documentElement;
        expect(scrollWidth, 'document scrollWidth').to.be.at.most(clientWidth);

        const overhanging = [...doc.querySelectorAll('*')]
          .filter((el) => el.getBoundingClientRect().right > clientWidth + 0.5)
          .map((el) => el.tagName.toLowerCase() + '.' + el.className);
        expect(overhanging, 'elements past the right edge').to.be.empty;
      });
    });
  });
});
