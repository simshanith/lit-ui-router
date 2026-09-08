import { LOCATION_PLUGIN, visitWithFeatures, syncUrl } from '../support/e2e.ts';

/**
 * The manual page_view budget per location plugin. gtag's enhanced measurement
 * patches history.pushState/replaceState and listens for popstate, so the app
 * must send exactly what those hooks cannot see, and nothing else:
 *
 * - pushState — nothing at all; gtag sees load, pushes and traversals itself.
 * - navigation — `navigation.navigate()` never touches history, so a forward
 *   move is ours. The cold load has no `navigate` event (gtag's own config call
 *   counts it) and a back still fires popstate (gtag counts that too).
 * - hash — history is never touched, so every transition is ours.
 *
 * Counts are cumulative from load, which keeps the assertions free of any
 * mid-test reset that could race a transition's onSuccess.
 *
 * Runs per lane (`cypress run --expose LOCATION_PLUGIN=...`), which is the
 * point: this is the guard that the sample apps' Navigation API default cannot
 * silently drop page views.
 */
const EXPECTED = {
  navigation: { load: 0, forward: 1, back: 1 },
  hash: { load: 1, forward: 2, back: 3 },
  pushState: { load: 0, forward: 0, back: 0 },
};

// unseeded lanes run the app default, which is the Navigation API (#656)
const lane = LOCATION_PLUGIN || 'navigation';
const expected = EXPECTED[lane];

describe(`gtag page_view under the ${lane} location plugin`, () => {
  let pageViews;

  beforeEach(() => {
    pageViews = [];
    // before load: ga.js only reports to a gtag the page already has, and the
    // e2e build sets no tracking id, so nothing overwrites this stub.
    visitWithFeatures('/welcome', {}, (win) => {
      win.gtag = (command, name, params) => {
        if (command === 'event' && name === 'page_view') pageViews.push(params);
      };
    });
    cy.get('ui-router').should('exist');
  });

  it(`counts ${expected.load} on the cold load and ${expected.forward} after a forward navigation`, () => {
    cy.then(() => {
      expect(pageViews, 'manual page_views on load').to.have.length(
        expected.load,
      );
    });
    // the router's own url() push, the same move an in-app link makes
    syncUrl('/home');
    cy.location('href').should('contain', 'home');
    cy.then(() => {
      expect(pageViews, 'manual page_views after a push').to.have.length(
        expected.forward,
      );
    });
  });

  it(`still counts ${expected.back} after a back traversal`, () => {
    syncUrl('/home');
    cy.location('href').should('contain', 'home');
    cy.go('back');
    cy.location('href').should('contain', 'welcome');
    cy.then(() => {
      expect(pageViews, 'manual page_views after a back').to.have.length(
        expected.back,
      );
    });
  });

  it('reports the route it actually landed on, undoubled', () => {
    syncUrl('/home');
    cy.location('href').should('contain', 'home');
    cy.then(() => {
      // /app/home, never /app/home/home — location.pathname already carries the
      // route under pushState and the Navigation API.
      pageViews.forEach(({ page_location: sent }) => {
        expect(sent, 'page_location').to.not.match(/\/home\/home$/);
      });
    });
  });
});
