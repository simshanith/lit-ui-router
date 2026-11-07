import { expect, test, type LocationPlugin } from './fixtures.ts';

/**
 * Which location plugin each project actually boots with, read off the banner
 * `configureRouter` logs.
 *
 * The unseeded projects run the app's own resolution, so this is the guard
 * that the default really is the Navigation API. Without it the default is
 * only ever asserted by absence: a re-added `VITE_SAMPLE_APP_
 * LOCATION_PLUGIN` pin, or a browser without the Navigation API, would
 * quietly downgrade those projects to pushState while staying green.
 */
const EXPECTED_PLUGIN = {
  '': 'navigationLocationPlugin',
  pushState: 'pushStateLocationPlugin',
  hash: 'hashLocationPlugin',
} satisfies Record<LocationPlugin, string>;

test.describe("location plugin resolution in the project's lane", () => {
  test('boots the expected location plugin', async ({
    page,
    visit,
    locationPlugin,
  }) => {
    const banners: string[] = [];

    // before load, so the banner `configureRouter` logs on boot is captured
    page.on('console', (message) => {
      if (message.type() === 'info') banners.push(message.text());
    });
    await visit('/welcome');
    await expect(page.locator('ui-router')).toBeAttached();
    await expect
      .poll(() => banners.join('\n'), { message: 'location plugin banner' })
      .toContain(EXPECTED_PLUGIN[locationPlugin]);
  });
});
