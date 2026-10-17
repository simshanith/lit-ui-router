import { LOCATION_PLUGIN, visitWithFeatures } from '../support/e2e.ts';

const APP_TITLE = 'UI-Router Lit sample app';

const EMAIL_ADDRESS = 'myself@angular.dev';

const lane = LOCATION_PLUGIN || 'navigation';

// gtag debounces history page_views; moves closer together than this collapse into one
const GTAG_SETTLE_MS = 2500;

/** Every event in a GA4 hit: the URL carries shared params, each body line one event. */
function eventsOf({ url, body }) {
  const shared = Object.fromEntries(new URL(url).searchParams);
  const lines = body ? body.split(/\r?\n/) : [''];

  return lines.map((line) => ({
    ...shared,
    ...Object.fromEntries(new URLSearchParams(line)),
  }));
}

/**
 * Opt-in: loads the real gtag.js, so it needs an app built or served with
 * `VITE_GOOGLE_ANALYTICS_TRACKING_ID` and skips otherwise. Run it alone with
 * `--spec`; with a tracking id set, ga.js replaces the stub `analytics.cy.js`
 * installs. Every Google request but the library itself is answered 204 here,
 * so no hit leaves the machine.
 *
 * The guard is gtag's own history page_view, which only a stream id with
 * enhanced measurement turns on; the pushState lane is the one that sees it on
 * every move. A placeholder id (`G-TEST000000`) gets a container without
 * enhanced measurement, so it exercises only the `config` and app page_views.
 */
describe(`real gtag.js hits under the ${lane} location plugin`, () => {
  let hits;

  beforeEach(() => {
    hits = [];
    cy.intercept({ hostname: /google|doubleclick/ }, (req) => {
      if (new URL(req.url).pathname === '/gtag/js') return;
      hits.push({ url: req.url, body: req.body });
      req.reply(204);
    });
  });

  it('keeps message subjects and contact names out of every dt', function () {
    const records = [];

    const noteRecordTitle = () =>
      cy.title().then((title) => {
        expect(title, 'document.title').to.not.equal(APP_TITLE);
        records.push(title.replace(` — ${APP_TITLE}`, ''));
      });

    const settle = () => cy.wait(GTAG_SETTLE_MS);

    visitWithFeatures('/login');
    // the login view has rendered, so ga.js has run
    cy.get('select').should('exist');
    cy.window().then((win) => {
      if (!('dataLayer' in win)) this.skip();
    });
    cy.get('select').contains('myself').parent('select').select(EMAIL_ADDRESS);
    cy.get('button').contains('Log in').click();
    cy.url().should('include', 'home');
    settle();

    cy.contains('.nav-tabs li a', 'Messages').click();
    cy.url().should('include', 'inbox');
    settle();
    cy.get('table tbody tr').eq(0).find('a').click();
    cy.url().should('match', /inbox\/.+/);
    cy.get('.message h2')
      .invoke('text')
      .then((subject) => {
        cy.title().should('eq', `${subject.trim()} — ${APP_TITLE}`);
      });
    noteRecordTitle();
    settle();

    cy.contains('.nav-tabs li a', 'Contacts').click();
    cy.url().should('include', 'contacts');
    settle();
    cy.get('.selectlist li a').contains('Finley').click();
    cy.url().should('match', /\/contacts\/[\w-]+$/);
    cy.title().should('contain', 'Finley');
    noteRecordTitle();
    settle();

    // traversals: popstate under pushState and the Navigation API
    cy.go('back');
    cy.url().should('match', /\/contacts$/);
    settle();
    cy.go('back');
    cy.url().should('match', /inbox\/.+/);
    settle();

    // a cold load onto a record: gtag.js may load after the route titles the page
    cy.reload();
    cy.get('.message h2').should('exist');
    noteRecordTitle();

    // gtag batches hits on a timer
    settle();
    settle();
    cy.then(() => {
      const events = hits.flatMap(eventsOf);

      expect(
        events.filter(({ en }) => en === 'page_view'),
        'page_view events',
      ).to.have.length.above(0);
      events.forEach(({ en, dt = '' }) => {
        records.forEach((record) => {
          expect(dt, `dt of ${en}`).to.not.contain(record);
        });
      });
    });
  });
});
