// Uploads bundle stats to Codecov from the built dist/ (turbo codecov:bundle,
// uncached) so the upload runs even when the vite build is a cache replay.
// Usage: node upload-bundle-stats.mjs <bundle-name> [build-dir=dist]
import fs from 'node:fs/promises';
import path from 'node:path';

import { createAndUploadReport } from '@codecov/bundle-analyzer';

const [bundleName, buildDir = 'dist'] = process.argv.slice(2);

if (!bundleName) {
  console.error('usage: upload-bundle-stats.mjs <bundle-name> [build-dir]');
  process.exit(1);
}

if (!process.env.CODECOV_TOKEN) {
  console.log(`[codecov] CODECOV_TOKEN unset; skipping ${bundleName} bundle stats upload.`);
  process.exit(0);
}

// Provenance filter: report only what rollup emitted (vite build.manifest),
// not publicDir copies or vite-plugin-static-copy files. The emitted html
// itself is not a manifest entry, so allow it explicitly; .vite/manifest.json
// is absent from its own emit list and falls out automatically.
const manifestPath = path.join(buildDir, '.vite', 'manifest.json');
let manifest;
try {
  manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
} catch (error) {
  // A missing manifest means build.manifest regressed in the vite config;
  // silently uploading an empty report would be worse than failing.
  console.error(`[codecov] ${bundleName}: cannot read ${manifestPath}:`, error);
  process.exit(1);
}
const emitted = new Set(['index.html']);
for (const entry of Object.values(manifest)) {
  emitted.add(entry.file);
  for (const file of entry.css ?? []) emitted.add(file);
  for (const file of entry.assets ?? []) emitted.add(file);
}

try {
  const report = await createAndUploadReport(
    [buildDir],
    {
      bundleName,
      uploadToken: process.env.CODECOV_TOKEN,
      gitService: 'github',
      telemetry: false,
      enableBundleAnalysis: true,
    },
    {
      // Membership in the manifest-derived set, not name patterns.
      // (The analyzer's own ignorePatterns matches the absolute paths it
      // feeds micromatch unreliably; likely an upstream bug.)
      beforeReportUpload: async (report) => {
        report.assets = report.assets.filter((asset) => emitted.has(asset.name));
        return report;
      },
    },
  );
  const { assets } = JSON.parse(report);
  const total = assets.reduce((sum, a) => sum + a.size, 0);
  console.log(`[codecov] Uploaded ${bundleName} bundle stats: ${assets.length} assets, ${total} bytes.`);
} catch (error) {
  // Availability of codecov must not gate CI (parity with the former
  // in-build plugin, which swallowed upload errors).
  console.error(`[codecov] ${bundleName} bundle stats upload failed:`, error);
}
