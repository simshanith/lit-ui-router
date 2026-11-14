import { defineConfig } from 'cf/config';

export default defineConfig({
  worker: {
    name: 'lit-ui-router-docs-v1',
    compatibilityDate: '2026-07-01',
    // Reached only through the docs worker's service binding, so it gets no URL of its own.
    workersDev: false,
    previewUrls: false,
    // The docs site's URL behaviour: clean URLs, and the snapshot's own 404 page at status 404.
    assets: {
      htmlHandling: 'auto-trailing-slash',
      notFoundHandling: '404-page',
    },
  },
});
