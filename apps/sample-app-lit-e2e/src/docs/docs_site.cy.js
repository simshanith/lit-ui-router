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
    cy.visit('/tutorial/live-examples');
    // The refresh icon only renders after Vue mounts (see the ExampleEmbed
    // spec below), so waiting on it keeps the click from racing hydration.
    cy.get('.restart-btn sp-icon-refresh').should('exist');
    cy.window().then((win) => {
      win.hydrationProbe = true;
    });
    // "Guides" now lives in the "Docs" nav flyout, which VitePress opens on
    // mouseenter. A plain button click races that handler — mouseenter opens
    // it, then the button's own click toggles it shut — so hover to reveal.
    cy.contains('.VPNavBar .VPFlyout', 'Docs').trigger('mouseenter');
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
    // A typedoc-authored page must list real exports; an empty or stale
    // generation would render the shell without them.
    cy.visit('/api/reference/');
    // Scoped to main: the sidebar also links UIRouterLit, but collapsed.
    cy.contains('main a', 'UIRouterLit').should('be.visible');
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
    // Wrangler's SPA fallback answers every path with 200 + the docs
    // homepage, so only embed-unique content proves the asset deployed.
    cy.request('/examples/helloworld/')
      .its('body')
      .should('include', 'Hello World - lit-ui-router Tutorial');
  });
});
