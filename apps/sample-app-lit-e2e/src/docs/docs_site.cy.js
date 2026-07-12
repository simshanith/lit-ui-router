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
          // Flagships are indexable; only the exhibits carry noindex.
          expect(response.headers, `${mount}${path}`).to.not.have.property(
            'x-robots-tag',
          );
        });
      }
    }
  });

  it('serves a real 404 for unknown urls under the spa mounts', () => {
    // Flagship mounts keep static 404 pages (not the shell): 404/200
    // byte-identical shells read as soft-404s and muddy entrance analytics.
    for (const url of [
      '/app/definitely-not-a-route',
      '/app/contacts/1/edit/extra',
      '/app-mobx/definitely-not-a-route',
    ]) {
      cy.request({ url, failOnStatusCode: false }).then((response) => {
        expect(response.status, url).to.eq(404);
        expect(response.body).to.include('<title>404 | Lit UI Router</title>');
        expect(response.headers, url).to.not.have.property('link');
      });
    }
  });

  it('serves the shell at 200 for everything under the naive exhibit', () => {
    // The not-found-naive rung: the classic SPA-host fallback (the soft-404
    // anti-pattern baseline) — no server routing at all.
    for (const url of [
      '/not-found-naive',
      '/not-found-naive/anything/at/all',
    ]) {
      cy.request(url).then((response) => {
        expect(response.status, url).to.eq(200);
        expect(response.body).to.include('<title>UI-Router Lit sample app');
        // Exhibit responses opt out of indexing: this rung IS the soft-404.
        expect(response.headers['x-robots-tag'], url).to.eq('noindex');
      });
    }
  });

  it('serves the app shell at 404 under the shell-404 exhibit mount', () => {
    // The /not-found-spa exhibit: every path is an honest 404 whose body IS
    // the app shell — the other 404 pattern, demonstrated side by side.
    for (const url of [
      '/not-found-spa',
      '/not-found-spa/',
      '/not-found-spa/any/path',
    ]) {
      cy.request({ url, failOnStatusCode: false }).then((response) => {
        expect(response.status, url).to.eq(404);
        expect(response.body).to.include('<title>UI-Router Lit sample app');
        expect(response.headers, url).to.not.have.property('link');
        expect(response.headers['x-robots-tag'], url).to.eq('noindex');
      });
    }
  });

  it('boots the in-app 404 state on a direct exhibit load', () => {
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
