import { defineConfig } from 'cypress';
import installLogsPrinter from 'cypress-terminal-report/src/installLogsPrinter.js';

import { e2eUrl } from './scripts/base-url.ts';

export default defineConfig({
  fileServerFolder: '.',
  fixturesFolder: './src/fixtures',
  modifyObstructiveCode: false,
  video: true,
  chromeWebSecurity: false,
  e2e: {
    baseUrl: e2eUrl('app/'),
    specPattern: './src/integration/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: './src/support/e2e.ts',
    setupNodeEvents(on) {
      installLogsPrinter(on);
    },
  },
});
