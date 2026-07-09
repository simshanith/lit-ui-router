describe('docs site', () => {
  it('renders the home page', () => {
    cy.visit('/');
    cy.title().should('match', /Lit UI Router/);
    // VitePress 1 emits `class="VPNavBar"`, VitePress 2 `class="VPNavBar home
    // top"` — match the prefix so the smoke survives a major bump.
    cy.get('[class*="VPNavBar"]').should('be.visible');
    cy.get('#app').should('not.be.empty');
  });

  it('navigates without a full page load', () => {
    cy.visit('/');
    cy.window().then((win) => {
      win.hydrationProbe = true;
    });
    cy.get('a[href="/guides/"]').first().click();
    cy.location('pathname').should('eq', '/guides/');
    // A full reload drops the probe; surviving it proves the client router
    // took the navigation, so the page hydrated.
    cy.window().its('hydrationProbe').should('be.true');
  });

  it('renders the generated api reference', () => {
    cy.visit('/api/');
    cy.title().should('match', /API Overview/);
    cy.get('h1').should('exist');
  });

  it('mounts the ExampleEmbed theme component', () => {
    cy.visit('/tutorial/live-examples');
    cy.get('.example-embed iframe[src="/examples/helloworld/"]').should(
      'exist',
    );
    // The iframe and .restart-btn are server-rendered. The icon inside it is a
    // client-only dynamic import, so it appears only once Vue has mounted.
    cy.get('.restart-btn sp-icon-refresh').should('exist');
  });

  it('serves the embedded example apps same-origin', () => {
    cy.request('/examples/helloworld/').its('status').should('eq', 200);
  });
});
