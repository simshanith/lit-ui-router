import { defineConfig } from 'cypress';

import { e2eUrl } from './scripts/base-url.ts';

export default defineConfig({
  fileServerFolder: '.',
  videosFolder: 'cypress/videos-docs',
  screenshotsFolder: 'cypress/screenshots-docs',
  video: true,
  chromeWebSecurity: false,
  e2e: {
    // The origin serves all of www/lit-ui-router.dev/dist; the sample-app suites
    // scope themselves to /app/, /app-mobx/, /app-effect/ and /app-signals/, so
    // nothing renders the docs pages.
    baseUrl: e2eUrl(''),
    specPattern: './src/docs/**/*.cy.{js,jsx,ts,tsx}',
    // The sample-app support file adds feature-flag query helpers the docs
    // site has no use for.
    supportFile: false,
  },
});
