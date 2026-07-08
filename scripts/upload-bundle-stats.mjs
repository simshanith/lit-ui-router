// Uploads bundle stats to Codecov from the built dist/ (turbo codecov:bundle,
// uncached) so the upload runs even when the vite build is a cache replay.
// Usage: node upload-bundle-stats.mjs <bundle-name> [build-dir=dist]
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
      // Match the former in-build vite plugin's scope (rollup-emitted assets
      // only): drop vite publicDir copies and the static-copied visualizer
      // images so the codecov size series does not step-change.
      // (ignorePatterns matches absolute paths unreliably; filter by name.)
      beforeReportUpload: async (report) => {
        report.assets = report.assets.filter(
          (asset) =>
            asset.name === 'index.html' || asset.name.startsWith('assets/'),
        );
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
