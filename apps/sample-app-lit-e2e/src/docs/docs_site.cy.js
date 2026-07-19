// A browser smoke of the deployed docs site. The worker's HTTP contract
// (statuses, redirects, noindex, shell aliasing, 404-page policy) lives in
// docs/worker/test/worker.test.ts, run against the worker module itself; the
// two cy.request specs kept here assert built-asset/assets-binding behavior
// that has no lower-level home.
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
    // Built-asset coverage, not worker logic: only embed-unique content
    // proves the asset deployed, not a fallback.
    cy.request('/examples/helloworld/')
      .its('body')
      .should('include', 'Hello World - lit-ui-router Tutorial');
  });

  it('serves a real 404 for unknown urls', () => {
    // Assets-binding behavior (not_found_handling: "404-page"), not worker
    // logic: the worker never runs for paths outside the mounts.
    cy.request({ url: '/definitely-missing', failOnStatusCode: false }).then(
      (response) => {
        expect(response.status).to.eq(404);
        // The title proves the vitepress 404 page rendered, not a null body.
        expect(response.body).to.include('<title>404 | Lit UI Router</title>');
      },
    );
  });

  it('renders real routes client-side under every aliased exhibit', () => {
    // The regression this fix addresses. Each aliased exhibit serves the one
    // base-agnostic vanilla shell, whose client derives its base from
    // location.pathname at boot and renders the real route — where the shared
    // /app shell used to resolve every foreign prefix to the in-app 404 (e.g.
    // "No state matched the URL /simulated-routing/welcome").
    for (const mount of [
      '/not-found-spa',
      '/simulated-routing',
      '/not-found-naive',
    ]) {
      cy.visit(`${mount}/welcome`);
      cy.contains('Welcome to the sample app!');
      cy.location('pathname').should('eq', `${mount}/welcome`);
    }
  });

  it('shows the soft-404: the client renders its 404 view on a naive miss', () => {
    // The naive rung's whole lesson: the server answers 200 for a path that
    // does not exist (pinned in the worker's node tests), yet the client —
    // correctly based at /not-found-naive/ — resolves it to the in-app 404
    // view. Server and client disagree; that gap IS the anti-pattern.
    cy.visit('/not-found-naive/definitely-not-a-route');
    cy.contains('404 Page Not Found');
  });

  it('boots the in-app 404 state on a direct miss under the shell-404 exhibit', () => {
    cy.visit('/not-found-spa/definitely-not-a-route', {
      failOnStatusCode: false,
    });
    cy.contains('404 Page Not Found');
    // The unmatched url stays in the address bar (the 404 state is url-less).
    cy.location('pathname').should(
      'eq',
      '/not-found-spa/definitely-not-a-route',
    );
  });
});
