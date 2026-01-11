import { visitWithFeatures } from '../support/e2e';

describe('hash location plugin', () => {
  it('loads app with hash routing', () => {
    visitWithFeatures('/', { 'location-plugin': 'hash' });
    // Hash plugin uses # in URL
    cy.url().should('include', '#');
  });
});

describe('navigation location plugin', () => {
  it('loads app with navigation API routing', () => {
    visitWithFeatures('/', { 'location-plugin': 'navigation' });
    cy.window().its('navigation').should('exist');
  });
});

describe('pushState location plugin', () => {
  it('loads app with pushState routing', () => {
    visitWithFeatures('/', { 'location-plugin': 'pushState' });
    // pushState uses clean URLs without hash
    cy.url().should('not.include', '#');
  });
});
