import { defineConfig } from 'cypress';

// Port declared once in .config/mise/config.toml; no literal fallback so an
// unset value fails loudly instead of drifting (#697).
const port = process.env.DOCS_DEV_PORT;
if (!port)
  throw new Error(
    'DOCS_DEV_PORT is unset — run this through mise, or set it yourself',
  );

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
