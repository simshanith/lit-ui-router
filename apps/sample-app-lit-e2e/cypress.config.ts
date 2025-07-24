import { defineConfig } from 'cypress';

export default defineConfig({
  fileServerFolder: '.',
  fixturesFolder: './src/fixtures',
  modifyObstructiveCode: false,
  video: true,
  chromeWebSecurity: false,
  e2e: {
    baseUrl: 'http://localhost:5173/app.html/',
    specPattern: './src/integration/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: './src/support/e2e.ts',
  },
});
