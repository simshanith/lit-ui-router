import { defineConfig } from 'cypress'

export default defineConfig({
  fileServerFolder: '.',
  fixturesFolder: './src/fixtures',
  modifyObstructiveCode: false,
  video: true,
  videosFolder: 'videos',
  screenshotsFolder: 'screenshots',
  chromeWebSecurity: false,
  e2e: {
    setupNodeEvents(on, config) {},
    specPattern: './src/integration/**/*.cy.{js,jsx,ts,tsx}',
  },
})
