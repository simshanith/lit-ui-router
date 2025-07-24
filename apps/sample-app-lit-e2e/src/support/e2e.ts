// Global hooks that run after all tests
after(() => {
  console.log('All test suites completed');
  cy.request('/e2e-done', { failOnStatusCode: false, timeout: 0 });
});
