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

  it('serves the per-app 404 page for unknown urls under the spa mounts', () => {
    // The flagship rung (not-found-static): a dedicated 404 page, not the
    // shell — 404/200 byte-identical shells read as soft-404s and muddy
    // entrance analytics. The page drives the user back into its own app.
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
          expect(response.body).to.include(`href="${mount}/welcome"`);
          expect(response.headers['content-type'], url).to.include('text/html');
          // Not a route, so no canonical Link header (unlike shell 200s).
          expect(response.headers, url).to.not.have.property('link');
          // Flagships stay indexable; only the exhibits carry noindex.
          expect(response.headers, url).to.not.have.property('x-robots-tag');
        });
      }
    }
  });

  it('302s the flagship mount root — hash mode is not first-class there', () => {
    // A hash client enters at the bare mount; the browser GETs it with the
    // route in the (unsent) fragment. The flagship root 302s to /welcome,
    // moving the browser to a new path — so a flagship mount can't host a hash
    // app. That limitation is the reason for the dedicated /app-hash mount.
    for (const mount of ['/app', '/app-mobx']) {
      cy.request({ url: mount, followRedirect: false }).then((response) => {
        expect(response.status, mount).to.eq(302);
        expect(response.headers.location, mount).to.eq(`${mount}/welcome`);
      });
    }
  });

  it('serves the hash-demo shell at 200 at its root, with no redirect', () => {
    // The dedicated hash mount: the fragment carries the route, so the server
    // only ever sees the bare mount and must serve the shell there without a
    // 302 (a redirect would strip the fragment's route on entry). Both the
    // bare and trailing-slash forms answer 200 with the hash shell; the mount
    // is a real demo, not an exhibit, so it stays indexable.
    for (const url of ['/app-hash', '/app-hash/']) {
      cy.request({ url, followRedirect: false }).then((response) => {
        expect(response.status, url).to.eq(200);
        expect(response.body, url).to.include(
          '<title>UI-Router Lit sample app',
        );
        expect(response.headers, url).to.not.have.property('x-robots-tag');
      });
    }
    // A mistyped deep path (never produced by a hash client) is an honest 404.
    cy.request({
      url: '/app-hash/no/such/route',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(404);
    });
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

  it('serves the honest-404 SPA exhibit — 200 for real routes, 404-shell for misses', () => {
    // The /not-found-spa exhibit is the flagship shape plus one difference: a
    // miss serves the app shell at an honest 404 (the `otherwise` projection —
    // a status'd shell) instead of the flagship's static 404 page. Real routes
    // and the root redirect earn a shell-200, exactly like the flagship.
    cy.request({ url: '/not-found-spa', followRedirect: false }).then(
      (response) => {
        expect(response.status, '/not-found-spa').to.eq(302);
        expect(response.headers.location).to.eq('/not-found-spa/welcome');
        expect(response.headers['x-robots-tag']).to.eq('noindex');
      },
    );
    // Real routes (static and parameterized) serve the shell at 200.
    for (const path of ['/welcome', '/contacts/1/edit']) {
      const url = `/not-found-spa${path}`;
      cy.request(url).then((response) => {
        expect(response.status, url).to.eq(200);
        expect(response.body).to.include('<title>UI-Router Lit sample app');
        expect(response.headers['x-robots-tag'], url).to.eq('noindex');
      });
    }
    // A genuine miss serves the shell at an honest 404 — the body IS the app
    // shell (the other 404 pattern, side by side with the flagship's static
    // page), and a 404 carries no canonical Link.
    for (const url of ['/not-found-spa/any/path', '/not-found-spa/nope']) {
      cy.request({ url, failOnStatusCode: false }).then((response) => {
        expect(response.status, url).to.eq(404);
        expect(response.body).to.include('<title>UI-Router Lit sample app');
        expect(response.headers, url).to.not.have.property('link');
        expect(response.headers['x-robots-tag'], url).to.eq('noindex');
      });
    }
  });

  it('computes full router verdicts under the simulate exhibit', () => {
    // The simulated-routing rung: same tables, every verdict computed by a
    // headless @uirouter/core transition server-side.
    cy.request({
      url: '/simulated-routing/?flag=1',
      followRedirect: false,
    }).then((response) => {
      expect(response.status).to.eq(302);
      expect(response.headers.location).to.eq(
        '/simulated-routing/welcome?flag=1',
      );
      expect(response.headers['x-robots-tag']).to.eq('noindex');
    });
    cy.request('/simulated-routing/welcome').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.include('<title>UI-Router Lit sample app');
      expect(response.headers['x-robots-tag']).to.eq('noindex');
    });
    cy.request({
      url: '/simulated-routing/garbage',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(404);
      expect(response.body).to.include('<title>UI-Router Lit sample app');
      expect(response.headers['x-robots-tag']).to.eq('noindex');
    });
  });

  it('renders real routes client-side under every aliased exhibit', () => {
    // The regression this fix addresses. Each exhibit now ships its own build
    // whose VITE_SAMPLE_APP_BASE_URL matches its prefix, so the client router
    // strips that prefix and renders the real route — where the shared /app
    // shell used to resolve every foreign prefix to the in-app 404 (e.g.
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

  it('shows the soft-404: naive serves 200, the client renders its 404 view', () => {
    // The naive rung's whole lesson: the server answers 200 for a path that
    // does not exist (bad for crawlers), yet the client — now correctly based
    // at /not-found-naive/ — resolves it to the in-app 404 view. Server and
    // client disagree; that gap IS the anti-pattern.
    cy.request('/not-found-naive/definitely-not-a-route')
      .its('status')
      .should('eq', 200);
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
