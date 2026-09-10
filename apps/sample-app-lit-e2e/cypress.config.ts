import { resolveWwwDevPort } from '@www/lit-ui-router.dev/dev-port.ts';
import { defineConfig } from 'cypress';

const port = resolveWwwDevPort();

export default defineConfig({
  allowCypressEnv: false,
  fileServerFolder: '.',
  fixturesFolder: './src/fixtures',
  modifyObstructiveCode: false,
  video: true,
  chromeWebSecurity: false,
  e2e: {
    baseUrl: `http://localhost:${port}/app/`,
    specPattern: './src/integration/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: './src/support/e2e.ts',
  },
});
