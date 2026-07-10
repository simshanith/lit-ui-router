import { defineConfig } from 'cypress';

export default defineConfig({
  allowCypressEnv: false,
  fileServerFolder: '.',
  videosFolder: 'cypress/videos-docs',
  screenshotsFolder: 'cypress/screenshots-docs',
  video: true,
  chromeWebSecurity: false,
  e2e: {
    // Wrangler serves all of docs/dist at :8787; the sample-app suites scope
    // themselves to /app/ and /app-mobx/, so nothing renders the docs pages.
    baseUrl: `http://localhost:8787/`,
    specPattern: './src/docs/**/*.cy.{js,jsx,ts,tsx}',
    // The sample-app support file adds feature-flag query helpers the docs
    // site has no use for.
    supportFile: false,
  },
});
