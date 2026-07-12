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
    // Only embed-unique content proves the asset deployed, not a fallback.
    cy.request('/examples/helloworld/')
      .its('body')
      .should('include', 'Hello World - lit-ui-router Tutorial');
  });

  it('serves a real 404 for unknown urls', () => {
    cy.request({ url: '/definitely-missing', failOnStatusCode: false }).then(
      (response) => {
        expect(response.status).to.eq(404);
        // The title proves the vitepress 404 page rendered, not a null body.
        expect(response.body).to.include('<title>404 | Lit UI Router</title>');
      },
    );
  });

  it('serves the app shell for real routes under the spa mounts', () => {
    for (const mount of ['/app', '/app-mobx']) {
      // The root (hash-mode home) plus a static and a parameterized route.
      for (const path of ['/', '/welcome', '/contacts/1/edit']) {
        cy.request(`${mount}${path}`).then((response) => {
          expect(response.status, `${mount}${path}`).to.eq(200);
          // Prefix only: the mobx shell's title carries a " (MobX)" suffix.
          expect(response.body).to.include('<title>UI-Router Lit sample app');
        });
      }
    }
  });

  it('serves the per-app 404 page for unknown urls under the spa mounts', () => {
    for (const mount of ['/app', '/app-mobx']) {
      for (const path of [
        '/definitely-not-a-route',
        '/contacts/1/edit/extra',
      ]) {
        const url = `${mount}${path}`;
        cy.request({ url, failOnStatusCode: false }).then((response) => {
          expect(response.status, url).to.eq(404);
          // Prefix only: the mobx page's title carries a " (MobX)" suffix.
          expect(response.body).to.include(
            '<title>404 | UI-Router Lit sample app',
          );
          // The page drives the user back into the app that owns the mount.
          expect(response.body).to.include(`href="${mount}/welcome"`);
          expect(response.headers['content-type'], url).to.include('text/html');
          // Not a route, so no canonical Link header (unlike shell 200s).
          expect(response.headers, url).to.not.have.property('link');
        });
      }
    }
  });
});
