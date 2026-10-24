import { defineConfig } from 'cf/config';

export default defineConfig({
  worker: {
    name: 'release-diffs',
    compatibilityDate: '2026-07-01',
    entrypoint: './worker/index.ts',
    // Reached only through the docs worker's service binding, so neither production nor a Preview gets a URL.
    workersDev: false,
    previewUrls: false,
    observability: { enabled: true },
  },
});
