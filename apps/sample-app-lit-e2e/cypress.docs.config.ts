import { defineConfig } from 'cypress';

// Port declared once in .config/mise/config.toml; no literal fallback so an
// unset value fails loudly instead of drifting (#697).
const port = process.env.DOCS_DEV_PORT;
if (!port) throw new Error('DOCS_DEV_PORT is unset — run this through mise');

export default defineConfig({
  allowCypressEnv: false,
  fileServerFolder: '.',
  videosFolder: 'cypress/videos-docs',
  screenshotsFolder: 'cypress/screenshots-docs',
  video: true,
  chromeWebSecurity: false,
  e2e: {
    // Wrangler serves all of www/lit-ui-router.dev/dist; the sample-app suites scope
    // themselves to /app/ and /app-mobx/, so nothing renders the docs pages.
    baseUrl: `http://localhost:${port}/`,
    specPattern: './src/docs/**/*.cy.{js,jsx,ts,tsx}',
    // The sample-app support file adds feature-flag query helpers the docs
    // site has no use for.
    supportFile: false,
  },
});
