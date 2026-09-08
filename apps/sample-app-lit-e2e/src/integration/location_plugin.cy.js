import { LOCATION_PLUGIN, visitWithFeatures } from '../support/e2e.ts';

/**
 * Which location plugin each lane actually boots with, read off the banner
 * `configureRouter` logs.
 *
 * The unseeded lanes (`vanilla`, `mobx`) run the app's own resolution, so this
 * is the guard that the default really is the Navigation API. Without it the
 * default is only ever asserted by absence: a re-added `VITE_SAMPLE_APP_
 * LOCATION_PLUGIN` pin, or a Cypress browser without the Navigation API, would
 * quietly downgrade those lanes to pushState and turn the suite into two
 * copies of the pushState lane while staying green.
 */
const EXPECTED_PLUGIN = {
  '': 'navigationLocationPlugin',
  pushState: 'pushStateLocationPlugin',
  hash: 'hashLocationPlugin',
};

const expected = EXPECTED_PLUGIN[LOCATION_PLUGIN];
const lane = LOCATION_PLUGIN || 'unseeded';

describe(`location plugin resolution in the ${lane} lane`, () => {
  it(`boots ${expected}`, () => {
    const banners = [];
    // before load, so the banner `configureRouter` logs on boot is captured
    visitWithFeatures('/welcome', {}, (win) => {
      const info = win.console.info.bind(win.console);
      win.console.info = (...args) => {
        banners.push(args.join(' '));
        info(...args);
      };
    });
    cy.get('ui-router').should('exist');
    cy.then(() => {
      expect(banners.join('\n'), 'location plugin banner').to.contain(expected);
    });
  });
});
